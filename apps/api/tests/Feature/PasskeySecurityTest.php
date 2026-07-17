<?php

namespace Tests\Feature;

use App\Models\Passkey;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Regresión del P1 de passkeys: la implementación no verificaba la afirmación
 * criptográfica WebAuthn. Diseño FAIL-CLOSED: el flujo solo se abriría con un
 * verificador WebAuthn real enlazado (App\Contracts\WebAuthnVerifier), que no
 * existe. Ninguna variable de entorno (PASSKEYS_ENABLED) puede reactivarlo.
 *
 * Cubre: registro, autenticación, challenge, expiración, replay, usuario
 * suspendido, 401/403/422/501, ausencia de secretos y el caso del flag en true.
 */
class PasskeySecurityTest extends TestCase
{
    use RefreshDatabase;

    private function userWithPasskey(array $attrs = [], string $credentialId = 'known-public-credential-id'): User
    {
        $user = User::factory()->create(array_merge([
            'password' => bcrypt('secret-password'),
            'two_factor_enabled' => true,
            'two_factor_methods' => ['email', 'passkey'],
        ], $attrs));

        Passkey::create([
            'user_id' => $user->id,
            'credential_id' => $credentialId,
            'public_key' => 'stored-public-key-secret',
            'label' => 'Test key',
        ]);

        return $user;
    }

    private function loginChallenge(User $user): array
    {
        return $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk()->json();
    }

    // ───────────────── Login / autenticación ─────────────────

    /** Núcleo del P1: verify NO emite token; queda fail-closed (501). */
    public function test_verify_refuses_to_issue_token(): void
    {
        $user = $this->userWithPasskey();
        $login = $this->loginChallenge($user);

        $this->postJson('/api/auth/passkey/verify', [
            'challenge' => $login['challenge'],
            'credential_id' => 'known-public-credential-id',
        ])
            ->assertStatus(501)
            ->assertJsonPath('code', 'PASSKEYS_NOT_IMPLEMENTED');

        $this->assertSame(0, $user->tokens()->count());
    }

    /**
     * REQUISITO EXPLÍCITO: incluso con PASSKEYS_ENABLED=true, si no hay
     * verificador WebAuthn real enlazado, NO se emite ningún token.
     * Esto demuestra que la variable de entorno no reactiva el flujo inseguro.
     */
    public function test_flag_true_alone_never_issues_a_token(): void
    {
        config(['auth.passkeys_enabled' => true]);
        // A propósito NO se enlaza App\Contracts\WebAuthnVerifier.

        $user = $this->userWithPasskey();
        $login = $this->loginChallenge($user);

        $response = $this->postJson('/api/auth/passkey/verify', [
            'challenge' => $login['challenge'],
            'credential_id' => 'known-public-credential-id',
        ])
            ->assertStatus(501)
            ->assertJsonPath('code', 'PASSKEYS_NOT_IMPLEMENTED');

        $this->assertNull($response->json('token'));
        $this->assertSame(0, $user->tokens()->count());
    }

    /** Con el flag activo, el registro tampoco se reactiva sin verificador real. */
    public function test_flag_true_alone_keeps_registration_blocked(): void
    {
        config(['auth.passkeys_enabled' => true]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/me/passkeys/options')
            ->assertStatus(501)
            ->assertJsonPath('code', 'PASSKEYS_NOT_IMPLEMENTED');

        $this->postJson('/api/me/passkeys', [
            'credential_id' => 'forged', 'public_key' => 'garbage',
        ])
            ->assertStatus(501)
            ->assertJsonPath('code', 'PASSKEYS_NOT_IMPLEMENTED');

        $this->assertDatabaseMissing('passkeys', ['credential_id' => 'forged']);
    }

    /** Reintentar (replay) el mismo challenge tampoco produce token. */
    public function test_replayed_verify_never_mints_token(): void
    {
        $user = $this->userWithPasskey();
        $login = $this->loginChallenge($user);

        foreach (range(1, 2) as $_) {
            $this->postJson('/api/auth/passkey/verify', [
                'challenge' => $login['challenge'],
                'credential_id' => 'known-public-credential-id',
            ])->assertStatus(501);
        }

        $this->assertSame(0, $user->tokens()->count());
    }

    /** Challenge inexistente/expirado → 422, nunca token. */
    public function test_verify_with_expired_or_unknown_challenge_returns_422(): void
    {
        $this->postJson('/api/auth/passkey/verify', [
            'challenge' => 'does-not-exist',
            'credential_id' => 'whatever',
        ])->assertStatus(422)->assertJsonValidationErrors('challenge');
    }

    /** Payload incompleto → 422 (contrato de validación intacto). */
    public function test_verify_validates_required_fields(): void
    {
        $this->postJson('/api/auth/passkey/verify', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['challenge', 'credential_id']);
    }

    /** Usuario suspendido → 423 ANTES del flujo passkey (motivo exacto, sin token). */
    public function test_suspended_user_is_blocked_before_passkey_flow(): void
    {
        $user = $this->userWithPasskey([
            'account_status' => User::ACCOUNT_SUSPENDED,
            'account_status_expires_at' => now()->addHour(),
        ]);
        Cache::put('2fa_challenge:suspended-challenge', $user->id, now()->addMinutes(10));

        $this->postJson('/api/auth/passkey/verify', [
            'challenge' => 'suspended-challenge',
            'credential_id' => 'known-public-credential-id',
        ])
            ->assertStatus(423)
            ->assertJsonPath('code', 'ACCOUNT_SUSPENDED');

        $this->assertSame(0, $user->tokens()->count());
    }

    /** El login ya no anuncia 'passkey' como método utilizable. */
    public function test_login_does_not_advertise_passkey_as_a_method(): void
    {
        $user = $this->userWithPasskey(['two_factor_methods' => ['email', 'passkey']]);

        $methods = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk()->json('methods');

        $this->assertNotContains('passkey', $methods);
        $this->assertContains('email', $methods);
    }

    /** Incluso con el flag activo (pero sin verificador), login no anuncia passkey. */
    public function test_login_does_not_advertise_passkey_even_with_flag_true(): void
    {
        config(['auth.passkeys_enabled' => true]);
        $user = $this->userWithPasskey(['two_factor_methods' => ['email', 'passkey']]);

        $methods = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk()->json('methods');

        $this->assertNotContains('passkey', $methods);
    }

    /** Usuario solo-passkey no queda sin opciones: cae a email (recovery sigue disponible). */
    public function test_passkey_only_user_falls_back_to_email(): void
    {
        $user = $this->userWithPasskey(['two_factor_methods' => ['passkey']]);

        $methods = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk()->json('methods');

        $this->assertSame(['email'], $methods);
    }

    // ───────────────── Registro ─────────────────

    /** Enrolar nuevas credenciales queda bloqueado (401 sin sesión). */
    public function test_store_requires_authentication(): void
    {
        $this->postJson('/api/me/passkeys', [
            'credential_id' => 'x', 'public_key' => 'y',
        ])->assertUnauthorized();
    }

    /** Autenticado pero passkeys no operativas → 501, y NO se persiste nada. */
    public function test_store_is_blocked_and_persists_nothing(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/me/passkeys', [
            'credential_id' => 'forged-credential',
            'public_key' => 'attacker-controlled-garbage',
        ])
            ->assertStatus(501)
            ->assertJsonPath('code', 'PASSKEYS_NOT_IMPLEMENTED');

        $this->assertDatabaseMissing('passkeys', ['credential_id' => 'forged-credential']);
    }

    /** El challenge de registro tampoco se emite. */
    public function test_register_options_are_blocked(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/me/passkeys/options')
            ->assertStatus(501)
            ->assertJsonPath('code', 'PASSKEYS_NOT_IMPLEMENTED');
    }

    // ───────────────── Compatibilidad: credenciales existentes ─────────────────

    /** Las passkeys ya guardadas se conservan; el bloqueo no las borra. */
    public function test_existing_passkeys_are_preserved_not_deleted(): void
    {
        $user = $this->userWithPasskey();

        $login = $this->loginChallenge($user);
        $this->postJson('/api/auth/passkey/verify', [
            'challenge' => $login['challenge'],
            'credential_id' => 'known-public-credential-id',
        ])->assertStatus(501);

        // La credencial sigue en la base tras el intento bloqueado.
        $this->assertDatabaseHas('passkeys', [
            'user_id' => $user->id,
            'credential_id' => 'known-public-credential-id',
        ]);
    }

    // ───────────────── Ausencia de secretos ─────────────────

    /**
     * REQUISITO EXPLÍCITO: ninguna respuesta filtra credential_id ni public_key
     * (ni stack trace), en el caso base y con el flag activo.
     */
    public function test_no_credential_id_or_public_key_is_leaked(): void
    {
        foreach ([false, true] as $i => $flag) {
            config(['auth.passkeys_enabled' => $flag]);

            $credential = "known-public-credential-{$i}";
            $user = $this->userWithPasskey(['email' => "leak-{$i}@example.test"], $credential);
            $login = $this->loginChallenge($user);

            $body = $this->postJson('/api/auth/passkey/verify', [
                'challenge' => $login['challenge'],
                'credential_id' => $credential,
            ])->getContent();

            $this->assertStringNotContainsString('stored-public-key-secret', $body);
            $this->assertStringNotContainsString($credential, $body);
            $this->assertStringNotContainsString('"trace"', $body);
            $this->assertStringNotContainsString('"exception"', $body);
        }
    }

    /** El listado de passkeys nunca devuelve credential_id ni public_key. */
    public function test_index_never_exposes_secret_columns(): void
    {
        $user = $this->userWithPasskey();
        Sanctum::actingAs($user);

        $body = $this->getJson('/api/me/passkeys')->assertOk()->getContent();

        $this->assertStringNotContainsString('known-public-credential-id', $body);
        $this->assertStringNotContainsString('stored-public-key-secret', $body);
    }
}

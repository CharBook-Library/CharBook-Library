<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_verify_email_persists_to_database(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email_verified_at' => null]);
        Sanctum::actingAs($user);

        // Simula el código emitido por send-verification.
        Cache::put("email_verify:{$user->id}", Hash::make('123456'), now()->addMinutes(30));

        $this->postJson('/api/auth/email/verify', ['code' => '123456'])
            ->assertOk()
            ->assertJsonPath('is_email_verified', true);

        // REGRESIÓN: email_verified_at no está en $fillable; update() lo
        // descartaba en silencio y el correo nunca quedaba verificado en BD.
        $this->assertNotNull($user->fresh()->email_verified_at);

        // El código ya no puede reutilizarse.
        $this->postJson('/api/auth/email/verify', ['code' => '123456'])
            ->assertStatus(422);
    }

    public function test_wrong_code_does_not_verify(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email_verified_at' => null]);
        Sanctum::actingAs($user);

        Cache::put("email_verify:{$user->id}", Hash::make('123456'), now()->addMinutes(30));

        $this->postJson('/api/auth/email/verify', ['code' => '999999'])->assertStatus(422);
        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_verified_user_passes_verified_email_middleware(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        Sanctum::actingAs($user);

        // Con el correo verificado, el gate deja pasar (422 de validación,
        // ya NO el 403 "verifica tu correo").
        $this->postJson('/api/me/works', [])->assertStatus(422);
    }

    public function test_unverified_user_gets_403_with_flag(): void
    {
        $user = User::factory()->create(['email_verified_at' => null]);
        Sanctum::actingAs($user);

        $this->postJson('/api/me/works', [])
            ->assertStatus(403)
            ->assertJsonPath('email_verified', false);
    }
}

<?php

namespace Tests\Feature;

use App\Models\Notification as AccountNotification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Laravel\Socialite\Facades\Socialite;
use Mockery;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AccountStatusTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['reader', 'admin', 'super_admin'] as $role) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        }
    }

    public function test_account_status_endpoint_requires_authentication_and_super_admin(): void
    {
        $target = User::factory()->create();

        $this->patchJson("/api/admin/users/{$target->id}/account-status", [
            'status' => 'banned',
            'reason' => 'Incumplimiento confirmado.',
        ])->assertUnauthorized();

        $admin = $this->userWithRole('admin');
        Sanctum::actingAs($admin);

        $this->patchJson("/api/admin/users/{$target->id}/account-status", [
            'status' => 'banned',
            'reason' => 'Incumplimiento confirmado.',
        ])->assertForbidden();

        $this->assertSame(User::ACCOUNT_ACTIVE, $target->fresh()->account_status);
    }

    public function test_suspend_validates_reason_and_future_expiration(): void
    {
        Sanctum::actingAs($this->userWithRole('super_admin'));
        $target = User::factory()->create();

        $this->patchJson("/api/admin/users/{$target->id}/account-status", [
            'status' => 'suspended',
        ])->assertUnprocessable()->assertJsonValidationErrors(['reason']);

        $this->patchJson("/api/admin/users/{$target->id}/account-status", [
            'status' => 'suspended',
            'reason' => 'Revision temporal.',
            'suspended_until' => now()->subMinute()->toIso8601String(),
        ])->assertUnprocessable()->assertJsonValidationErrors(['suspended_until']);
    }

    public function test_active_user_can_login_and_every_sanctum_route_uses_account_middleware(): void
    {
        $active = User::factory()->create();

        $this->postJson('/api/auth/login', [
            'email' => $active->email,
            'password' => 'password',
        ])->assertOk()->assertJsonStructure(['token']);

        foreach (app('router')->getRoutes() as $route) {
            $middleware = $route->gatherMiddleware();
            if (in_array('auth:sanctum', $middleware, true)) {
                $this->assertContains(
                    'account.active',
                    $middleware,
                    'Falta account.active en '.$route->uri()
                );
            }
        }
    }

    public function test_super_admin_can_create_permanent_suspension_and_ban(): void
    {
        $super = $this->userWithRole('super_admin');
        $permanent = User::factory()->create();
        $banned = User::factory()->create();
        Sanctum::actingAs($super);

        $this->patchJson("/api/admin/users/{$permanent->id}/account-status", [
            'status' => 'suspended',
            'reason' => 'Suspension permanente confirmada.',
            'suspended_until' => null,
        ])->assertOk()
            ->assertJsonPath('account_status', User::ACCOUNT_SUSPENDED)
            ->assertJsonPath('account_status_expires_at', null);

        $this->patchJson("/api/admin/users/{$banned->id}/account-status", [
            'status' => 'banned',
            'reason' => 'Infraccion grave confirmada.',
        ])->assertOk()->assertJsonPath('account_status', User::ACCOUNT_BANNED);

        Sanctum::actingAs($permanent);
        $this->getJson('/api/user')
            ->assertStatus(423)
            ->assertJsonPath('suspended_until', null);
    }

    public function test_super_admin_can_suspend_and_tokens_are_revoked_and_action_is_audited(): void
    {
        $super = $this->userWithRole('super_admin');
        $target = User::factory()->create();
        $target->createToken('existing-session');

        Sanctum::actingAs($super);
        $until = now()->addDay()->startOfSecond();

        $this->patchJson("/api/admin/users/{$target->id}/account-status", [
            'status' => 'suspended',
            'reason' => 'Revision interna sensible.',
            'suspended_until' => $until->toIso8601String(),
        ])
            ->assertOk()
            ->assertJsonPath('account_status', User::ACCOUNT_SUSPENDED)
            ->assertJsonPath('account_status_changed_by.id', $super->id);

        $fresh = $target->fresh();
        $this->assertSame(User::ACCOUNT_SUSPENDED, $fresh->account_status);
        $this->assertSame($super->id, $fresh->account_status_changed_by);
        $this->assertSame(0, $fresh->tokens()->count());

        $notice = AccountNotification::where('user_id', $target->id)
            ->where('type', 'account_status')
            ->firstOrFail();
        $this->assertStringNotContainsString('sensible', $notice->body);

        $this->assertDatabaseHas('admin_audit_logs', [
            'admin_id' => $super->id,
            'action' => 'user.account_restricted',
            'entity_id' => $target->id,
            'reason' => 'Revision interna sensible.',
        ]);
    }

    public function test_suspended_and_banned_accounts_cannot_login_or_use_authenticated_routes(): void
    {
        $suspended = User::factory()->create([
            'account_status' => User::ACCOUNT_SUSPENDED,
            'account_status_expires_at' => now()->addHour(),
        ]);

        $this->postJson('/api/auth/login', [
            'email' => $suspended->email,
            'password' => 'password',
        ])->assertStatus(423)->assertJsonPath('code', 'ACCOUNT_SUSPENDED');

        Sanctum::actingAs($suspended);
        $this->getJson('/api/user')
            ->assertStatus(423)
            ->assertJsonPath('account_status', User::ACCOUNT_SUSPENDED);

        $banned = User::factory()->create(['account_status' => User::ACCOUNT_BANNED]);
        $this->postJson('/api/auth/login', [
            'email' => $banned->email,
            'password' => 'password',
        ])->assertStatus(423)->assertJsonPath('code', 'ACCOUNT_BANNED');
    }

    public function test_suspension_blocks_2fa_and_passkey_token_issuers_before_external_work(): void
    {
        Notification::fake();
        $user = User::factory()->create([
            'account_status' => User::ACCOUNT_SUSPENDED,
            'account_status_expires_at' => now()->addHour(),
            'two_factor_enabled' => true,
            'two_factor_methods' => ['email', 'passkey'],
        ]);
        Cache::put('2fa_challenge:blocked-challenge', $user->id, now()->addMinutes(10));

        $this->postJson('/api/auth/two-factor/challenge', [
            'challenge' => 'blocked-challenge',
            'method' => 'email',
        ])->assertStatus(423)->assertJsonPath('code', 'ACCOUNT_SUSPENDED');

        $this->postJson('/api/auth/passkey/verify', [
            'challenge' => 'blocked-challenge',
            'credential_id' => 'anything',
        ])->assertStatus(423)->assertJsonPath('code', 'ACCOUNT_SUSPENDED');

        Notification::assertNothingSent();
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_google_callback_blocks_banned_user_without_calling_real_google(): void
    {
        $user = User::factory()->create([
            'email' => 'blocked-google@example.test',
            'account_status' => User::ACCOUNT_BANNED,
        ]);

        $googleUser = (object) [
            'email' => $user->email,
            'name' => $user->name,
            'id' => 'google-blocked-id',
            'avatar' => null,
        ];
        $driver = Mockery::mock();
        $driver->shouldReceive('stateless')->once()->andReturnSelf();
        $driver->shouldReceive('user')->once()->andReturn($googleUser);
        Socialite::shouldReceive('driver')->once()->with('google')->andReturn($driver);

        $this->get('/auth/google/callback')
            ->assertRedirect(rtrim((string) config('app.frontend_url'), '/').'/login?error=account_banned');

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_super_admin_can_reactivate_with_audited_reason(): void
    {
        $super = $this->userWithRole('super_admin');
        $target = User::factory()->create([
            'account_status' => User::ACCOUNT_BANNED,
            'account_status_reason' => 'Original restriction.',
            'account_status_changed_at' => now()->subDay(),
        ]);
        Sanctum::actingAs($super);

        $this->patchJson("/api/admin/users/{$target->id}/account-status", [
            'status' => 'active',
            'reason' => 'Apelacion aprobada.',
        ])->assertOk()->assertJsonPath('account_status', User::ACCOUNT_ACTIVE);

        $fresh = $target->fresh();
        $this->assertSame(User::ACCOUNT_ACTIVE, $fresh->account_status);
        $this->assertNull($fresh->account_status_reason);
        $this->assertDatabaseHas('admin_audit_logs', [
            'admin_id' => $super->id,
            'action' => 'user.account_reactivated',
            'reason' => 'Apelacion aprobada.',
        ]);
    }

    public function test_expired_suspension_reactivates_automatically_and_is_audited(): void
    {
        $user = User::factory()->create([
            'account_status' => User::ACCOUNT_SUSPENDED,
            'account_status_reason' => 'Temporal.',
            'account_status_expires_at' => now()->subMinute(),
        ]);
        Sanctum::actingAs($user);

        $this->getJson('/api/user')->assertOk();

        $this->assertSame(User::ACCOUNT_ACTIVE, $user->fresh()->account_status);
        $this->assertDatabaseHas('admin_audit_logs', [
            'admin_id' => null,
            'action' => 'user.suspension_expired',
            'entity_id' => $user->id,
        ]);
    }

    public function test_super_admin_cannot_suspend_self_or_leave_no_active_super_admin(): void
    {
        $onlySuper = $this->userWithRole('super_admin');
        Sanctum::actingAs($onlySuper);

        $this->patchJson("/api/admin/users/{$onlySuper->id}/account-status", [
            'status' => 'suspended',
            'reason' => 'Accion insegura.',
            'suspended_until' => now()->addDay()->toIso8601String(),
        ])->assertUnprocessable()->assertJsonValidationErrors(['status']);

        $this->assertSame(User::ACCOUNT_ACTIVE, $onlySuper->fresh()->account_status);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}

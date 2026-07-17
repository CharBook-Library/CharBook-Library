<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Mantenimiento del registro de auditoría (borrado selectivo, purga por
 * antigüedad y vaciado total) + purga de métricas de rendimiento de la API.
 * Solo super_admin; cada borrado queda re-auditado.
 */
class AuditLogMaintenanceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['reader', 'admin', 'super_admin'] as $role) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        }
        config(['cache.default' => 'array']);
        Cache::clear();
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function seedLog(string $action, ?int $daysAgo = 0): int
    {
        return DB::table('admin_audit_logs')->insertGetId([
            'admin_id' => null,
            'action' => $action,
            'entity_type' => 'test',
            'created_at' => now()->subDays($daysAgo),
        ]);
    }

    // ───────────────── Autorización ─────────────────

    public function test_maintenance_requires_super_admin(): void
    {
        $this->deleteJson('/api/admin/audit-logs', ['ids' => [1]])->assertUnauthorized();

        Sanctum::actingAs($this->userWithRole('admin'));
        $this->deleteJson('/api/admin/audit-logs', ['ids' => [1]])->assertForbidden();
        $this->deleteJson('/api/admin/audit-logs/all', ['confirm' => 'ELIMINAR_AUDITORIA'])->assertForbidden();
        $this->deleteJson('/api/admin/audit-logs/older-than/30')->assertForbidden();
        $this->postJson('/api/admin/system/metrics/clear')->assertForbidden();
    }

    // ───────────────── Borrado selectivo ─────────────────

    public function test_delete_selected_removes_only_chosen_entries_and_is_audited(): void
    {
        Sanctum::actingAs($this->userWithRole('super_admin'));

        $keep = $this->seedLog('books.publish');
        $a = $this->seedLog('reports.resolve');
        $b = $this->seedLog('users.suspend');

        $this->deleteJson('/api/admin/audit-logs', ['ids' => [$a, $b]])
            ->assertOk()
            ->assertJsonPath('deleted', 2);

        $this->assertDatabaseHas('admin_audit_logs', ['id' => $keep]);
        $this->assertDatabaseMissing('admin_audit_logs', ['id' => $a]);
        $this->assertDatabaseMissing('admin_audit_logs', ['id' => $b]);
        // El borrado quedó re-auditado.
        $this->assertDatabaseHas('admin_audit_logs', ['action' => 'audit.delete_selected']);
    }

    public function test_delete_selected_validates_ids(): void
    {
        Sanctum::actingAs($this->userWithRole('super_admin'));

        $this->deleteJson('/api/admin/audit-logs', [])->assertUnprocessable();
        $this->deleteJson('/api/admin/audit-logs', ['ids' => ['x']])->assertUnprocessable();
    }

    // ───────────────── Purga por antigüedad ─────────────────

    public function test_purge_older_than_removes_only_old_entries(): void
    {
        Sanctum::actingAs($this->userWithRole('super_admin'));

        $old = $this->seedLog('books.publish', 90);
        $recent = $this->seedLog('reports.resolve', 5);

        $this->deleteJson('/api/admin/audit-logs/older-than/30')
            ->assertOk()
            ->assertJsonPath('deleted', 1);

        $this->assertDatabaseMissing('admin_audit_logs', ['id' => $old]);
        $this->assertDatabaseHas('admin_audit_logs', ['id' => $recent]);
        $this->assertDatabaseHas('admin_audit_logs', ['action' => 'audit.purge_old']);
    }

    public function test_purge_rejects_out_of_range_days(): void
    {
        Sanctum::actingAs($this->userWithRole('super_admin'));

        $this->deleteJson('/api/admin/audit-logs/older-than/3')->assertStatus(422);
        $this->deleteJson('/api/admin/audit-logs/older-than/400')->assertStatus(422);
    }

    // ───────────────── Vaciado total ─────────────────

    public function test_delete_all_requires_explicit_confirmation(): void
    {
        Sanctum::actingAs($this->userWithRole('super_admin'));
        $this->seedLog('books.publish');

        $this->deleteJson('/api/admin/audit-logs/all', [])->assertUnprocessable();
        $this->deleteJson('/api/admin/audit-logs/all', ['confirm' => 'no'])->assertUnprocessable();
        $this->assertDatabaseHas('admin_audit_logs', ['action' => 'books.publish']);

        $this->deleteJson('/api/admin/audit-logs/all', ['confirm' => 'ELIMINAR_AUDITORIA'])
            ->assertOk();

        // Solo sobrevive la entrada que audita el propio vaciado.
        $this->assertDatabaseMissing('admin_audit_logs', ['action' => 'books.publish']);
        $this->assertSame(1, DB::table('admin_audit_logs')->count());
        $this->assertDatabaseHas('admin_audit_logs', ['action' => 'audit.delete_all']);
    }

    // ───────────────── Purga de métricas de rendimiento ─────────────────

    public function test_clear_metrics_wipes_request_counters_and_is_audited(): void
    {
        Sanctum::actingAs($this->userWithRole('super_admin'));

        $day = now()->format('Y-m-d');
        Cache::put("metrics:req:{$day}", 123, 3600);
        Cache::put("metrics:req:{$day}:5xx", 4, 3600);
        Cache::put("metrics:req:{$day}:b0", 50, 3600);
        Cache::put(\App\Http\Middleware\RecordRequestMetrics::LAST_5XX_KEY, [['path' => '/x']], 3600);
        Cache::put(\App\Http\Middleware\RecordRequestMetrics::SLOW_REQ_KEY, [['path' => '/y']], 3600);

        $this->postJson('/api/admin/system/metrics/clear')->assertOk();

        $this->assertNull(Cache::get("metrics:req:{$day}"));
        $this->assertNull(Cache::get("metrics:req:{$day}:5xx"));
        $this->assertNull(Cache::get("metrics:req:{$day}:b0"));
        $this->assertNull(Cache::get(\App\Http\Middleware\RecordRequestMetrics::LAST_5XX_KEY));
        $this->assertNull(Cache::get(\App\Http\Middleware\RecordRequestMetrics::SLOW_REQ_KEY));
        $this->assertDatabaseHas('admin_audit_logs', ['action' => 'system.clear_metrics']);

        // El panel de salud sigue respondiendo con métricas en cero.
        $this->getJson('/api/admin/system/health')
            ->assertOk()
            ->assertJsonPath('data.requests.today.total', 0);
    }
}

<?php

namespace Tests\Feature;

use App\Models\Author;
use App\Models\Book;
use App\Models\Report;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AdminAuditModerationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['reader', 'moderator', 'admin', 'super_admin'] as $role) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        }
    }

    public function test_audit_endpoints_require_super_admin_and_validate_filters(): void
    {
        $this->getJson('/api/admin/audit-logs')->assertUnauthorized();

        Sanctum::actingAs($this->userWithRole('admin'));
        $this->getJson('/api/admin/audit-logs')->assertForbidden();
        $this->getJson('/api/admin/audit-logs/actions')->assertForbidden();

        $superAdmin = $this->userWithRole('super_admin');
        $this->writeSanitizedAudit($superAdmin);
        Sanctum::actingAs($superAdmin);

        $this->getJson('/api/admin/audit-logs?action=SYSTEM.TEST&search=demo')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.action', 'system.test');

        $this->getJson('/api/admin/audit-logs?from=not-a-date')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('from');
        $this->getJson('/api/admin/audit-logs?from=2026-07-16&to=2026-07-15')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('to');
        $this->getJson('/api/admin/audit-logs/actions')
            ->assertOk()
            ->assertJsonPath('data.0', 'system.test');

        $changes = (string) DB::table('admin_audit_logs')->value('changes');
        $this->assertStringNotContainsString('plain-password', $changes);
        $this->assertStringNotContainsString('private-token', $changes);
        $this->assertStringContainsString('***', $changes);
    }

    public function test_moderation_hide_is_atomic_and_writes_audit_log(): void
    {
        $report = $this->reportFor('book', $this->book()->id);
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->patchJson("/api/admin/reports/{$report->id}/resolve", [
            'resolution_action' => 'hide',
            'resolution_notes' => 'Contenido ocultado tras revisión manual.',
        ])
            ->assertOk()
            ->assertJsonPath('effect.executed', true);

        $this->assertDatabaseHas('books', [
            'id' => $report->target_id,
            'is_hidden' => true,
            'is_published' => false,
        ]);
        $this->assertDatabaseHas('reports', [
            'id' => $report->id,
            'status' => Report::STATUS_RESOLVED,
            'resolution_action' => 'hide',
        ]);
        $this->assertDatabaseHas('admin_audit_logs', [
            'action' => 'report.resolve',
            'entity_id' => $report->target_id,
        ]);
    }

    public function test_failed_action_does_not_close_report(): void
    {
        $target = User::factory()->create();
        $report = $this->reportFor('user', $target->id);
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->patchJson("/api/admin/reports/{$report->id}/resolve", [
            'resolution_action' => 'hide',
            'resolution_notes' => 'Intento de ocultar una cuenta reportada.',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('resolution_action');

        $this->assertDatabaseHas('reports', [
            'id' => $report->id,
            'status' => Report::STATUS_OPEN,
            'resolved_by_id' => null,
        ]);
        $this->assertDatabaseMissing('admin_audit_logs', [
            'action' => 'report.resolve',
            'entity_id' => $target->id,
        ]);
    }

    public function test_moderation_returns_401_403_and_422_without_leaking_debug_data(): void
    {
        $report = $this->reportFor('book', $this->book()->id);

        $this->patchJson("/api/admin/reports/{$report->id}/resolve", [])
            ->assertUnauthorized();

        Sanctum::actingAs($this->userWithRole('reader'));
        $this->patchJson("/api/admin/reports/{$report->id}/resolve", [])
            ->assertForbidden();

        Sanctum::actingAs($this->userWithRole('moderator'));
        $response = $this->patchJson("/api/admin/reports/{$report->id}/resolve", [
            'resolution_action' => 'hide',
            'resolution_notes' => 'x',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('resolution_notes');

        $payload = $response->getContent();
        $this->assertStringNotContainsString('"trace"', $payload);
        $this->assertStringNotContainsString('"exception"', $payload);
    }

    public function test_report_filters_are_validated_and_closed_reports_cannot_be_dismissed_again(): void
    {
        $admin = $this->userWithRole('admin');
        Sanctum::actingAs($admin);

        $this->getJson('/api/admin/reports?status=invalid')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
        $this->getJson('/api/admin/reports?target_type=unknown')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('target_type');

        $report = $this->reportFor('book', $this->book()->id);
        $report->update([
            'status' => Report::STATUS_RESOLVED,
            'resolved_by_id' => $admin->id,
            'resolution_action' => 'none',
            'resolution_notes' => 'Resolución original protegida.',
            'resolved_at' => now(),
        ]);

        $this->patchJson("/api/admin/reports/{$report->id}/dismiss", [
            'resolution_notes' => 'Intento de sobrescritura.',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('report');

        $this->assertDatabaseHas('reports', [
            'id' => $report->id,
            'status' => Report::STATUS_RESOLVED,
            'resolution_notes' => 'Resolución original protegida.',
        ]);
        $this->assertDatabaseMissing('admin_audit_logs', [
            'action' => 'report.dismiss',
            'entity_id' => $report->target_id,
        ]);
    }

    private function writeSanitizedAudit(User $admin): void
    {
        $request = Request::create('/api/admin/test', 'POST');
        $request->setUserResolver(fn () => $admin);

        AuditLogger::log(
            $request,
            'system.test',
            entityType: 'system',
            entityId: 1,
            entityLabel: 'Demo record',
            reason: 'Demo audit',
            after: [
                'password' => 'plain-password',
                'nested' => ['access_token' => 'private-token'],
                'state' => 'ok',
            ],
        );
    }

    private function reportFor(string $type, int $id): Report
    {
        return Report::create([
            'reporter_id' => User::factory()->create()->id,
            'target_type' => $type,
            'target_id' => $id,
            'reason' => 'inappropriate',
            'details' => 'Contenido reportado para prueba aislada.',
            'status' => Report::STATUS_OPEN,
        ]);
    }

    private function book(): Book
    {
        $author = Author::create([
            'name' => 'Audit Test Author',
            'slug' => 'audit-test-author-' . str()->random(8),
        ]);

        return Book::create([
            'author_id' => $author->id,
            'title' => 'Audit Test Book',
            'slug' => 'audit-test-book-' . str()->random(8),
            'access_type' => 'free',
            'is_published' => true,
            'is_hidden' => false,
            'file_type' => 'epub',
        ]);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}

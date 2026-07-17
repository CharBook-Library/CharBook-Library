<?php

namespace Tests\Feature;

use App\Models\User;
use App\Providers\AppServiceProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class SystemHealthAdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['reader', 'admin', 'super_admin'] as $role) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        }

        Storage::fake('public');
        Http::preventStrayRequests();
        Cache::clear();
        config([
            'queue.default' => 'database',
            'cache.default' => 'array',
            'mail.default' => 'array',
            'scout.driver' => 'collection',
            'scout.meilisearch.host' => '',
            'services.stripe.secret' => '',
            'services.stripe.webhook_secret' => '',
            'services.google.client_id' => '',
            'services.google.client_secret' => '',
            'services.google_books.key' => '',
            'filesystems.disks.r2_books.bucket' => null,
            'filesystems.disks.r2_covers.bucket' => null,
        ]);
        Cache::forget(AppServiceProvider::WORKER_HEARTBEAT_KEY);
    }

    public function test_health_requires_super_admin_and_reports_stopped_worker_as_degraded(): void
    {
        $this->getJson('/api/admin/system/health')
            ->assertUnauthorized()
            ->assertJson(['message' => 'No autenticado.']);

        Sanctum::actingAs($this->userWithRole('admin'));
        $this->getJson('/api/admin/system/health')->assertForbidden();

        config([
            'services.google.client_id' => 'loadtest-client-id',
            'services.google.client_secret' => 'must-never-appear-in-json',
        ]);
        Cache::forget('health:summary');

        Sanctum::actingAs($this->userWithRole('super_admin'));
        $response = $this->getJson('/api/admin/system/health')
            ->assertOk()
            ->assertJsonPath('data.queue.status', 'degraded');

        $payload = $response->getContent();
        $this->assertStringNotContainsString('must-never-appear-in-json', $payload);
        $this->assertStringNotContainsString('"trace"', $payload);
        $this->assertStringNotContainsString('"exception"', $payload);
    }

    public function test_redis_and_database_queue_configuration_avoid_cross_environment_collisions(): void
    {
        $databases = array_map(
            static fn (string $connection): string => (string) config("database.redis.{$connection}.database"),
            ['default', 'cache', 'queue', 'session']
        );

        $this->assertCount(4, array_unique($databases));
        $this->assertNotSame(
            (string) config('database.redis.options.prefix'),
            (string) config('cache.prefix')
        );
        $this->assertSame('cache', config('cache.stores.redis.connection'));
        $this->assertSame('queue', config('queue.connections.redis.connection'));
        $this->assertSame(1900, config('queue.connections.redis.retry_after'));
        $this->assertSame(1900, config('queue.connections.database.retry_after'));
    }

    public function test_health_reports_required_redis_without_connecting_to_a_real_server(): void
    {
        config([
            'session.driver' => 'redis',
            'session.connection' => 'session',
        ]);

        $connection = Mockery::mock();
        $connection->shouldReceive('ping')->once()->andReturn(true);
        Redis::shouldReceive('connection')->once()->with('session')->andReturn($connection);

        Sanctum::actingAs($this->userWithRole('super_admin'));
        Cache::forget('health:summary');

        $this->getJson('/api/admin/system/health')
            ->assertOk()
            ->assertJsonPath('data.api.redis.required', true)
            ->assertJsonPath('data.api.redis.ok', true)
            ->assertJsonPath('data.api.redis.connections.0.name', 'session');
    }

    public function test_scheduler_heartbeat_raises_and_clears_the_operational_alert(): void
    {
        config(['health.scheduler.required' => true]);
        Sanctum::actingAs($this->userWithRole('super_admin'));
        Cache::forget('health:summary');

        $this->getJson('/api/admin/system/health')
            ->assertOk()
            ->assertJsonPath('data.scheduler.status', 'degraded')
            ->assertJsonFragment(['code' => 'scheduler_missing']);

        Cache::put(AppServiceProvider::SCHEDULER_HEARTBEAT_KEY, now()->timestamp, 3600);
        Cache::forget('health:summary');

        $response = $this->getJson('/api/admin/system/health')
            ->assertOk()
            ->assertJsonPath('data.scheduler.status', 'ok')
            ->assertJsonPath('data.scheduler.active', true);

        $this->assertStringNotContainsString('scheduler_missing', $response->getContent());
    }

    public function test_alert_ack_validates_input_audits_action_and_ignores_spoofed_forwarded_ip(): void
    {
        Sanctum::actingAs($this->userWithRole('super_admin'));

        $this->postJson('/api/admin/system/alerts/ack', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['id', 'acked']);

        $this->withHeader('X-Forwarded-For', '203.0.113.99')
            ->postJson('/api/admin/system/alerts/ack', [
                'id' => 'queue.worker_missing',
                'acked' => true,
            ])
            ->assertOk();

        $audit = DB::table('admin_audit_logs')
            ->where('action', 'system.alert_ack')
            ->first();

        $this->assertNotNull($audit);
        $this->assertNotSame('203.0.113.99', $audit->ip);
    }

    public function test_forwarded_ip_is_accepted_only_from_an_explicitly_trusted_proxy(): void
    {
        config(['trustedproxy.proxies' => ['127.0.0.1']]);
        Sanctum::actingAs($this->userWithRole('super_admin'));

        $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1'])
            ->withHeader('X-Forwarded-For', '203.0.113.99')
            ->postJson('/api/admin/system/alerts/ack', [
                'id' => 'queue.worker_missing',
                'acked' => true,
            ])
            ->assertOk();

        $audit = DB::table('admin_audit_logs')
            ->where('action', 'system.alert_ack')
            ->first();

        $this->assertNotNull($audit);
        $this->assertSame('203.0.113.99', $audit->ip);
    }

    public function test_super_admin_can_inspect_and_cancel_waiting_jobs_but_not_reserved_jobs(): void
    {
        Sanctum::actingAs($this->userWithRole('super_admin'));
        $now = now()->timestamp;

        $pendingId = DB::table('jobs')->insertGetId([
            'queue' => 'default',
            'payload' => json_encode(['displayName' => 'Tests\\PendingJob']),
            'attempts' => 0,
            'reserved_at' => null,
            'available_at' => $now,
            'created_at' => $now,
        ]);
        $reservedId = DB::table('jobs')->insertGetId([
            'queue' => 'default',
            'payload' => json_encode(['displayName' => 'Tests\\ReservedJob']),
            'attempts' => 1,
            'reserved_at' => $now,
            'available_at' => $now,
            'created_at' => $now,
        ]);

        Cache::forget('health:summary');
        $this->getJson('/api/admin/system/queue')
            ->assertOk()
            ->assertJsonPath('data.ready.0.id', $pendingId)
            ->assertJsonPath('data.processing.0.id', $reservedId);

        $this->deleteJson("/api/admin/system/queue/pending/{$pendingId}")
            ->assertOk();
        $this->assertDatabaseMissing('jobs', ['id' => $pendingId]);
        $this->assertDatabaseHas('admin_audit_logs', [
            'action' => 'system.queue_cancel_job',
            'entity_id' => $pendingId,
        ]);

        $this->deleteJson("/api/admin/system/queue/pending/{$reservedId}")
            ->assertUnprocessable();
        $this->assertDatabaseHas('jobs', ['id' => $reservedId]);
    }

    public function test_failed_job_action_rejects_invalid_payload_without_running_artisan(): void
    {
        Sanctum::actingAs($this->userWithRole('super_admin'));

        $this->postJson('/api/admin/system/failed-jobs/retry', [
            'uuid' => ['not-a-string'],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('uuid');
    }

    // ─────────────────────────────────────────────────────────────
    // Regresión: panel de salud resiliente (bug "Malformed UTF-8")
    // ─────────────────────────────────────────────────────────────

    /**
     * Caso real reproducido: PostgreSQL localizado en Windows escribió en
     * laravel.log un FATAL en Windows-1252 (0xE1 = á). recentErrors() lo
     * devolvía tal cual y json_encode tiraba TODO el panel con 500.
     */
    public function test_health_survives_non_utf8_log_entries_and_hides_credentials(): void
    {
        $originalStorage = storage_path();
        $tmp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'charbook-health-' . uniqid();
        mkdir($tmp . DIRECTORY_SEPARATOR . 'logs', 0777, true);
        file_put_contents(
            $tmp . DIRECTORY_SEPARATOR . 'logs' . DIRECTORY_SEPARATOR . 'laravel.log',
            "[2026-07-16 18:01:02] local.ERROR: SQLSTATE[08006] [7] FATAL:  el sistema de base"
                . " de datos est\xE1 en modo de recuperaci\xF3n password=supersecreta\n"
        );

        $this->app->useStoragePath($tmp);

        try {
            Sanctum::actingAs($this->userWithRole('super_admin'));
            Cache::forget('health:summary');

            $response = $this->getJson('/api/admin/system/health')->assertOk();

            $message = $response->json('data.errors.recent.0.message');
            $this->assertIsString($message);
            $this->assertTrue(mb_check_encoding($message, 'UTF-8'));
            $this->assertStringContainsString('está en modo de recuperación', $message);
            $this->assertStringNotContainsString('supersecreta', $response->getContent());
        } finally {
            $this->app->useStoragePath($originalStorage);
            @unlink($tmp . DIRECTORY_SEPARATOR . 'logs' . DIRECTORY_SEPARATOR . 'laravel.log');
            @rmdir($tmp . DIRECTORY_SEPARATOR . 'logs');
            @rmdir($tmp);
        }
    }

    /**
     * Redis exigido por la config pero SIN extensión phpredis ni predis
     * instalados (el caso real de esta máquina): la tarjeta de Redis debe
     * degradarse, no producir un 500.
     */
    public function test_health_reports_missing_redis_extension_without_500(): void
    {
        config(['queue.default' => 'redis']);

        Sanctum::actingAs($this->userWithRole('super_admin'));
        Cache::forget('health:summary');

        $response = $this->getJson('/api/admin/system/health')
            ->assertOk()
            ->assertJsonPath('data.api.redis.required', true)
            ->assertJsonPath('data.api.redis.ok', false)
            ->assertJsonPath('data.api.redis.connections.0.name', 'queue');

        // El resto de tarjetas sigue presente y sin stack traces.
        $this->assertTrue($response->json('data.api.db.ok'));
        $this->assertIsArray($response->json('data.queue'));
        $this->assertStringNotContainsString('"trace"', $response->getContent());
    }

    /**
     * CACHE_STORE=database con la tabla cache ausente: el resumen se calcula
     * sin cachear (rememberSafe), la tarjeta de cache refleja el fallo y los
     * demás componentes siguen visibles.
     */
    public function test_health_survives_broken_database_cache_store(): void
    {
        Sanctum::actingAs($this->userWithRole('super_admin'));

        config(['cache.default' => 'database']);
        \Illuminate\Support\Facades\Schema::drop('cache');

        $response = $this->getJson('/api/admin/system/health')
            ->assertOk()
            ->assertJsonPath('data.api.cache.ok', false)
            ->assertJsonPath('data.api.db.ok', true)
            ->assertJsonFragment(['code' => 'cache_down']);

        $this->assertSame('critical', $response->json('data.overall.status'));
        $this->assertIsArray($response->json('data.queue'));
        $this->assertIsArray($response->json('data.requests'));
        $this->assertIsArray($response->json('data.presence'));
    }

    /**
     * Un chequeo individual que lanza excepción (tabla book_views ausente →
     * gráficas) no impide mostrar el resto del panel.
     */
    public function test_health_isolates_a_failing_check_from_the_rest(): void
    {
        Sanctum::actingAs($this->userWithRole('super_admin'));

        \Illuminate\Support\Facades\Schema::drop('book_views');
        Cache::forget('health:summary');

        $response = $this->getJson('/api/admin/system/health')
            ->assertOk()
            ->assertJsonPath('data.api.db.ok', true);

        // Las gráficas caen a series en cero (14 días), sin romper el resto.
        $reads = $response->json('data.charts.reader_activity_by_day');
        $this->assertCount(14, $reads);
        $this->assertSame(0, array_sum(array_column($reads, 'count')));
        $this->assertIsArray($response->json('data.queue'));
        $this->assertIsArray($response->json('data.active_users'));
    }

    /**
     * Servicio externo (Meilisearch) con timeout: la tarjeta cae a crítico
     * con su alerta, sin congelar ni tumbar el panel.
     */
    public function test_health_reports_external_service_timeout_without_freezing(): void
    {
        config([
            'scout.driver' => 'meilisearch',
            'scout.meilisearch.host' => 'http://127.0.0.1:7700',
            'scout.meilisearch.key' => '',
        ]);
        Http::fake(function () {
            throw new \Illuminate\Http\Client\ConnectionException('cURL error 28: Connection timed out');
        });

        Sanctum::actingAs($this->userWithRole('super_admin'));
        Cache::forget('health:summary');
        Cache::forget('health:meilisearch');

        $this->getJson('/api/admin/system/health')
            ->assertOk()
            ->assertJsonPath('data.meilisearch.ok', false)
            ->assertJsonFragment(['code' => 'meili_down']);
    }

    /** Worker con heartbeat reciente → cola operativa (contraparte del degradado). */
    public function test_active_worker_heartbeat_reports_queue_ok(): void
    {
        Cache::put(AppServiceProvider::WORKER_HEARTBEAT_KEY, now()->timestamp, 3600);

        Sanctum::actingAs($this->userWithRole('super_admin'));
        Cache::forget('health:summary');

        $this->getJson('/api/admin/system/health')
            ->assertOk()
            ->assertJsonPath('data.queue.status', 'ok')
            ->assertJsonPath('data.queue.worker.active', true);
    }

    /** El JSON conserva el contrato completo que espera lib/api-admin.ts. */
    public function test_health_json_contract_matches_frontend_expectations(): void
    {
        Sanctum::actingAs($this->userWithRole('super_admin'));
        Cache::forget('health:summary');

        $this->getJson('/api/admin/system/health')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'overall' => ['status', 'components', 'active_alerts'],
                    'api' => [
                        'ok', 'laravel', 'php', 'environment', 'debug',
                        'db' => ['ok', 'driver', 'latency_ms', 'active_connections', 'checked_at'],
                        'cache' => ['ok', 'driver', 'latency_ms'],
                        'redis' => ['required', 'client', 'ok', 'latency_ms', 'connections'],
                        'storage' => ['ok', 'disk'],
                        'disk' => ['status', 'free_gb', 'total_gb', 'used_pct', 'path', 'warning_pct', 'critical_pct'],
                    ],
                    'queue' => [
                        'driver', 'status', 'status_reason', 'pending_ready', 'pending_total',
                        'delayed', 'processing', 'failed', 'max_attempts_pending',
                        'oldest_ready_seconds',
                        'worker' => ['active', 'last_heartbeat', 'seconds_since_heartbeat'],
                    ],
                    'scheduler' => ['required', 'active', 'status', 'last_heartbeat', 'seconds_since_heartbeat', 'stale_seconds'],
                    'stripe' => ['configured', 'mode', 'webhook_configured', 'ping', 'checked_at'],
                    'services',
                    'meilisearch',
                    'errors' => ['log_exists', 'size_mb', 'recent'],
                    'failed_jobs' => ['total', 'jobs'],
                    'requests' => ['today', 'yesterday', 'by_day', 'last_5xx', 'slow_requests', 'slow_threshold_ms'],
                    'active_users' => ['online_now', 'last_24h', 'new_this_week', 'total'],
                    'presence' => ['online_count', 'guests_online', 'online_users'],
                    'files' => ['scanned'],
                    'charts' => ['new_users_by_day', 'reader_activity_by_day', 'errors_by_day'],
                    'alerts',
                    'generated_at',
                ],
            ]);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}

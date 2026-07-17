<?php

namespace App\Services\Health;

use App\Http\Controllers\Api\PresenceController;
use App\Http\Middleware\RecordRequestMetrics;
use App\Providers\AppServiceProvider;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;

/**
 * Health checks del sistema — toda la lógica de cálculo vive aquí,
 * fuera del controlador. Reglas:
 *
 *  - Umbrales SOLO desde config/health.php (nunca hardcodeados).
 *  - Cada chequeo está aislado con try/catch: un servicio caído degrada
 *    su tarjeta, nunca congela el dashboard completo.
 *  - Pings externos (Stripe, Meilisearch) llevan timeout corto y cache
 *    propia más larga que la del resumen.
 *  - El resumen completo se cachea unos segundos para soportar varios
 *    admins con auto-refresh sin recalcular todo por petición.
 *
 * Estados: ok | warning | degraded | critical
 * (Operativo / Advertencia / Degradado / Crítico en la UI).
 */
class HealthCheckService
{
    public const ALERTS_SEEN_KEY = 'health:alerts:seen';
    public const ALERTS_ACKED_KEY = 'health:alerts:acked';

    public function __construct(
        private readonly FileIntegrityScanner $fileScanner,
    ) {}

    /**
     * Resumen completo del sistema (cacheado brevemente).
     */
    public function summary(): array
    {
        $ttl = (int) config('health.summary_cache_seconds', 10);

        return $this->rememberSafe('health:summary', $ttl, function () {
            $api = $this->apiStatus();
            $queue = $this->queueStatus();
            $scheduler = $this->schedulerStatus();
            $stripe = $this->stripeStatus();
            $meili = $this->meilisearchStatus();
            $errors = $this->recentErrors();
            $failedJobs = $this->failedJobs();
            $requests = $this->requestMetrics();
            $files = $this->fileIntegrity();

            $alerts = $this->buildAlerts($api, $queue, $scheduler, $stripe, $meili, $errors, $failedJobs, $requests);
            $overall = $this->overallStatus($api, $queue, $scheduler, $stripe, $meili, $alerts);
            $charts = $this->charts($errors);
            // recent_all solo alimenta la gráfica de errores por día — no
            // viaja al frontend (hasta 500 entradas inflarían el payload).
            unset($errors['recent_all']);

            return [
                'overall' => $overall,
                'api' => $api,
                'queue' => $queue,
                'scheduler' => $scheduler,
                'stripe' => $stripe,
                'meilisearch' => $meili,
                'services' => $this->externalServices($stripe, $meili),
                'errors' => $errors,
                'failed_jobs' => $failedJobs,
                'requests' => $requests,
                'active_users' => $this->activeUsers(),
                'presence' => $this->presence(),
                'files' => $files,
                'charts' => $charts,
                'alerts' => $alerts,
                'generated_at' => now()->toIso8601String(),
            ];
        });
    }

    /**
     * Cache::remember tolerante: si el store de cache está caído (p. ej.
     * CACHE_STORE=database sin la tabla cache), se calcula sin cachear en
     * lugar de tirar el endpoint completo. La tarjeta de cache ya refleja
     * la causa raíz por su propio chequeo.
     */
    private function rememberSafe(string $key, int $ttl, \Closure $callback): mixed
    {
        try {
            return Cache::remember($key, $ttl, $callback);
        } catch (\Throwable) {
            return $callback();
        }
    }

    // ════════════════════════════════════════════════════════
    // API / infraestructura
    // ════════════════════════════════════════════════════════

    private function apiStatus(): array
    {
        // ── Base de datos: latencia + conexiones activas ──
        $db = [
            'ok' => false,
            'driver' => config('database.default'),
            'latency_ms' => null,
            'active_connections' => null,
            'checked_at' => now()->toIso8601String(),
        ];
        try {
            $t0 = microtime(true);
            DB::select('select 1');
            $db['ok'] = true;
            $db['latency_ms'] = round((microtime(true) - $t0) * 1000, 1);

            if ($db['driver'] === 'pgsql') {
                $row = DB::select(
                    'SELECT count(*) AS c FROM pg_stat_activity WHERE datname = current_database()'
                );
                $db['active_connections'] = (int) ($row[0]->c ?? 0);
            }
        } catch (\Throwable $e) {
            $db['error'] = $this->sanitize($e->getMessage());
        }

        // ── Cache: roundtrip real con latencia ──
        $cache = ['ok' => false, 'driver' => config('cache.default'), 'latency_ms' => null];
        try {
            $key = 'health-check-' . uniqid();
            $t0 = microtime(true);
            Cache::put($key, 'ok', 10);
            $ok = Cache::pull($key) === 'ok';
            $cache['latency_ms'] = round((microtime(true) - $t0) * 1000, 1);
            $cache['ok'] = $ok;
        } catch (\Throwable $e) {
            $cache['error'] = $this->sanitize($e->getMessage());
        }

        $redis = $this->redisStatus();

        // ── Storage público escribible ──
        $storage = ['ok' => false, 'disk' => 'public'];
        try {
            $probe = 'health-probe.txt';
            Storage::disk('public')->put($probe, (string) now()->timestamp);
            $storage['ok'] = Storage::disk('public')->exists($probe);
            Storage::disk('public')->delete($probe);
        } catch (\Throwable $e) {
            $storage['error'] = $this->sanitize($e->getMessage());
        }

        // ── Disco: umbrales centralizados ──
        $warnPct = (float) config('health.disk.warning_pct');
        $critPct = (float) config('health.disk.critical_pct');
        $disk = [
            'status' => 'ok',
            'free_gb' => null,
            'total_gb' => null,
            'used_pct' => null,
            'path' => storage_path(),
            'warning_pct' => $warnPct,
            'critical_pct' => $critPct,
        ];
        try {
            $free = disk_free_space(storage_path());
            $total = disk_total_space(storage_path());
            if ($free !== false && $total !== false && $total > 0) {
                $disk['free_gb'] = round($free / 1073741824, 1);
                $disk['total_gb'] = round($total / 1073741824, 1);
                $disk['used_pct'] = round((1 - $free / $total) * 100, 1);
                $disk['status'] = $disk['used_pct'] >= $critPct
                    ? 'critical'
                    : ($disk['used_pct'] >= $warnPct ? 'warning' : 'ok');
            }
        } catch (\Throwable) {
            // sin acceso al disco → valores null
        }

        return [
            'ok' => $db['ok'] && $cache['ok'] && $storage['ok']
                && (! $redis['required'] || $redis['ok']),
            'laravel' => app()->version(),
            'php' => PHP_VERSION,
            'environment' => app()->environment(),
            'debug' => (bool) config('app.debug'),
            'db' => $db,
            'cache' => $cache,
            'redis' => $redis,
            'storage' => $storage,
            'disk' => $disk,
        ];
    }

    /**
     * Comprueba solo las conexiones Redis que el entorno realmente utiliza.
     * Nunca devuelve host, credenciales ni URLs de conexion.
     */
    private function redisStatus(): array
    {
        $connections = [];

        if (config('cache.default') === 'redis') {
            $connections[] = (string) config('cache.stores.redis.connection', 'cache');
        }
        if (config('queue.default') === 'redis') {
            $connections[] = (string) config('queue.connections.redis.connection', 'queue');
        }
        if (config('session.driver') === 'redis') {
            $connections[] = (string) (config('session.connection') ?: 'session');
        }

        $connections = array_values(array_unique(array_filter($connections)));
        $status = [
            'required' => $connections !== [],
            'client' => config('database.redis.client'),
            'ok' => null,
            'latency_ms' => null,
            'connections' => [],
        ];

        if ($connections === []) {
            return $status;
        }

        $totalLatency = 0.0;
        $allOk = true;

        foreach ($connections as $connection) {
            $item = ['name' => $connection, 'ok' => false, 'latency_ms' => null];
            try {
                $t0 = microtime(true);
                $pong = Redis::connection($connection)->ping();
                $item['latency_ms'] = round((microtime(true) - $t0) * 1000, 1);
                $item['ok'] = $pong === true || strtoupper((string) $pong) === 'PONG';
                $totalLatency += $item['latency_ms'];
            } catch (\Throwable $e) {
                $item['error'] = $this->sanitize($e->getMessage());
            }

            $allOk = $allOk && $item['ok'];
            $status['connections'][] = $item;
        }

        $status['ok'] = $allOk;
        $status['latency_ms'] = round($totalLatency, 1);

        return $status;
    }

    // ════════════════════════════════════════════════════════
    // Cola: salud REAL (worker + pendientes + retrasados + edad)
    // ════════════════════════════════════════════════════════

    private function queueStatus(): array
    {
        $cfg = config('health.queue');
        $driver = config('queue.default');

        $status = [
            'driver' => $driver,
            'status' => 'ok',
            'status_reason' => null,
            'pending_ready' => null,     // listos para ejecutarse YA
            'pending_total' => null,
            'delayed' => null,           // programados a futuro (esperar es normal)
            'processing' => null,        // reservados por un worker
            'failed' => 0,
            'max_attempts_pending' => null,
            'oldest_ready_seconds' => null,
            'worker' => [
                'active' => false,
                'last_heartbeat' => null,
                'seconds_since_heartbeat' => null,
            ],
        ];

        // Heartbeat del worker (lo escribe Queue::looping en AppServiceProvider)
        try {
            $hb = (int) Cache::get(AppServiceProvider::WORKER_HEARTBEAT_KEY, 0);
            if ($hb > 0) {
                $age = now()->timestamp - $hb;
                $status['worker'] = [
                    'active' => $age < (int) $cfg['worker_stale_seconds'],
                    'last_heartbeat' => date(DATE_ATOM, $hb),
                    'seconds_since_heartbeat' => $age,
                ];
            }
        } catch (\Throwable) {
            // cache caída: se refleja en el chequeo de cache
        }

        try {
            $status['failed'] = (int) DB::table('failed_jobs')->count();

            if ($driver === 'database') {
                $now = now()->timestamp;

                $status['processing'] = (int) DB::table('jobs')->whereNotNull('reserved_at')->count();
                $status['delayed'] = (int) DB::table('jobs')
                    ->whereNull('reserved_at')->where('available_at', '>', $now)->count();

                $ready = DB::table('jobs')
                    ->whereNull('reserved_at')->where('available_at', '<=', $now);
                $status['pending_ready'] = (int) $ready->count();
                $status['max_attempts_pending'] = $status['pending_ready'] > 0
                    ? (int) (clone $ready)->max('attempts')
                    : null;

                // OJO: la antigüedad se mide SOLO sobre jobs LISTOS. Un job
                // programado a futuro (p. ej. wait-unlock de 48 h) no es un
                // atasco, es el comportamiento esperado.
                $oldestReady = $status['pending_ready'] > 0
                    ? (int) (clone $ready)->min('available_at')
                    : null;
                if ($oldestReady !== null) {
                    $status['oldest_ready_seconds'] = max(0, $now - $oldestReady);
                }
                $status['pending_total'] = $status['pending_ready']
                    + $status['delayed'] + $status['processing'];
            } elseif ($driver === 'redis') {
                $queue = Queue::connection('redis');
                $name = (string) config('queue.connections.redis.queue', 'default');

                $status['pending_total'] = (int) $queue->size($name);
                $status['pending_ready'] = method_exists($queue, 'pendingSize')
                    ? (int) $queue->pendingSize($name)
                    : null;
                $status['delayed'] = method_exists($queue, 'delayedSize')
                    ? (int) $queue->delayedSize($name)
                    : null;
                $status['processing'] = method_exists($queue, 'reservedSize')
                    ? (int) $queue->reservedSize($name)
                    : null;
            }
        } catch (\Throwable $e) {
            $status['error'] = $this->sanitize($e->getMessage());
        }

        // ── Cálculo del estado (jobs fallidos NO hacen "sana" a la cola) ──
        [$level, $reason] = $this->queueLevel($status, $cfg, $driver);
        $status['status'] = $level;
        $status['status_reason'] = $reason;

        return $status;
    }

    private function queueLevel(array $s, array $cfg, string $driver): array
    {
        if ($driver === 'sync') {
            return ['ok', 'Cola síncrona: los jobs se ejecutan al instante.'];
        }

        $ready = (int) ($s['pending_ready'] ?? 0);
        $oldest = $s['oldest_ready_seconds'];
        $workerActive = (bool) $s['worker']['active'];

        if ($ready > 0 && ! $workerActive) {
            return ['critical', 'Hay jobs listos pero ningún worker activo los está procesando.'];
        }
        if ($oldest !== null && $oldest >= (int) $cfg['oldest_ready_critical_seconds']) {
            $mins = round($oldest / 60);
            return ['critical', "El job listo más antiguo lleva {$mins} min esperando."];
        }
        if ($oldest !== null && $oldest >= (int) $cfg['oldest_ready_warning_seconds']) {
            $mins = round($oldest / 60);
            return ['degraded', "Se acumulan jobs: el más antiguo espera {$mins} min."];
        }
        if (! $workerActive) {
            return ['degraded', 'Ningún worker activo: los próximos jobs no se procesarán hasta arrancar queue:work.'];
        }
        if (($s['failed'] ?? 0) > 0) {
            return ['warning', "{$s['failed']} job(s) fallidos pendientes de revisar."];
        }

        return ['ok', 'Worker activo y sin atascos.'];
    }

    private function schedulerStatus(): array
    {
        $required = (bool) config('health.scheduler.required', false);
        $staleSeconds = (int) config('health.scheduler.stale_seconds', 180);
        $heartbeat = 0;

        try {
            $heartbeat = (int) Cache::get(AppServiceProvider::SCHEDULER_HEARTBEAT_KEY, 0);
        } catch (\Throwable) {
            // El chequeo de cache ya refleja la causa raiz.
        }

        $age = $heartbeat > 0 ? max(0, now()->timestamp - $heartbeat) : null;
        $active = $age !== null && $age < $staleSeconds;

        return [
            'required' => $required,
            'active' => $active,
            'status' => $required && ! $active ? 'degraded' : 'ok',
            'last_heartbeat' => $heartbeat > 0 ? date(DATE_ATOM, $heartbeat) : null,
            'seconds_since_heartbeat' => $age,
            'stale_seconds' => $staleSeconds,
        ];
    }

    // ════════════════════════════════════════════════════════
    // Stripe / Meilisearch (pings cacheados)
    // ════════════════════════════════════════════════════════

    private function stripeStatus(): array
    {
        $ttl = (int) config('health.external_ping_cache_seconds', 60);

        return $this->rememberSafe('health:stripe', $ttl, function () {
            $secret = (string) config('services.stripe.secret');
            $webhook = (string) config('services.stripe.webhook_secret');

            $status = [
                'configured' => $secret !== '',
                'mode' => str_starts_with($secret, 'sk_live_') ? 'live'
                    : (str_starts_with($secret, 'sk_test_') ? 'test' : null),
                'webhook_configured' => $webhook !== '',
                'ping' => null,
                'checked_at' => now()->toIso8601String(),
            ];

            if ($secret === '') {
                return $status;
            }

            try {
                $curl = new \Stripe\HttpClient\CurlClient();
                $curl->setConnectTimeout((int) config('health.stripe.connect_timeout', 3));
                $curl->setTimeout((int) config('health.stripe.timeout', 5));
                \Stripe\ApiRequestor::setHttpClient($curl);

                $t0 = microtime(true);
                (new \Stripe\StripeClient($secret))->balance->retrieve();

                $status['ping'] = [
                    'ok' => true,
                    'latency_ms' => (int) round((microtime(true) - $t0) * 1000),
                ];
            } catch (\Throwable $e) {
                $status['ping'] = ['ok' => false, 'error' => $this->sanitize($e->getMessage())];
            }

            return $status;
        });
    }

    private function meilisearchStatus(): ?array
    {
        $host = (string) config('scout.meilisearch.host');
        if (config('scout.driver') !== 'meilisearch' || $host === '') {
            return null; // no configurado → no se muestra
        }

        $ttl = (int) config('health.external_ping_cache_seconds', 60);

        return $this->rememberSafe('health:meilisearch', $ttl, function () use ($host) {
            $key = (string) config('scout.meilisearch.key');
            $timeout = (int) config('health.meilisearch.timeout', 3);
            $headers = $key !== '' ? ['Authorization' => "Bearer {$key}"] : [];

            $result = [
                'configured' => true,
                'ok' => false,
                'latency_ms' => null,
                'documents' => null,
                'indexes' => null,
                'tasks_pending' => null,
                'checked_at' => now()->toIso8601String(),
            ];

            try {
                $t0 = microtime(true);
                $health = Http::withHeaders($headers)
                    ->connectTimeout(2)->timeout($timeout)
                    ->get(rtrim($host, '/') . '/health');
                $result['latency_ms'] = (int) round((microtime(true) - $t0) * 1000);
                $result['ok'] = $health->ok() && $health->json('status') === 'available';

                if ($result['ok']) {
                    $stats = Http::withHeaders($headers)
                        ->connectTimeout(2)->timeout($timeout)
                        ->get(rtrim($host, '/') . '/stats');
                    if ($stats->ok()) {
                        $indexes = (array) $stats->json('indexes', []);
                        $result['indexes'] = count($indexes);
                        $result['documents'] = array_sum(
                            array_map(fn ($i) => (int) ($i['numberOfDocuments'] ?? 0), $indexes)
                        );
                    }

                    $tasks = Http::withHeaders($headers)
                        ->connectTimeout(2)->timeout($timeout)
                        ->get(rtrim($host, '/') . '/tasks', [
                            'statuses' => 'enqueued,processing',
                            'limit' => 1,
                        ]);
                    if ($tasks->ok()) {
                        $result['tasks_pending'] = (int) ($tasks->json('total') ?? 0);
                    }
                }
            } catch (\Throwable $e) {
                $result['error'] = $this->sanitize($e->getMessage());
            }

            return $result;
        });
    }

    /**
     * Servicios externos: SOLO los realmente configurados en este entorno.
     */
    private function externalServices(array $stripe, ?array $meili): array
    {
        $services = [];

        if ($stripe['configured']) {
            $services[] = [
                'key' => 'stripe',
                'label' => 'Stripe',
                'status' => $stripe['ping']
                    ? ($stripe['ping']['ok'] ? 'ok' : 'critical')
                    : 'unknown',
                'detail' => $stripe['mode'] ? "modo {$stripe['mode']}" : null,
            ];
        }

        if ($meili !== null) {
            $services[] = [
                'key' => 'meilisearch',
                'label' => 'Meilisearch',
                'status' => $meili['ok'] ? 'ok' : 'critical',
                'detail' => $meili['ok'] && $meili['documents'] !== null
                    ? number_format($meili['documents']) . ' docs indexados'
                    : 'búsqueda instantánea',
            ];
        }

        if (config('services.google.client_id') && config('services.google.client_secret')) {
            $services[] = [
                'key' => 'google_oauth',
                'label' => 'Google OAuth',
                'status' => 'configured',
                'detail' => 'login con Google',
            ];
        }

        if (config('services.google_books.key')) {
            $services[] = [
                'key' => 'google_books',
                'label' => 'Google Books',
                'status' => 'configured',
                'detail' => 'metadata de libros',
            ];
        }

        $mailer = (string) config('mail.default');
        if ($mailer !== '' && $mailer !== 'log' && $mailer !== 'array') {
            $services[] = [
                'key' => 'mail',
                'label' => 'Correo',
                'status' => 'configured',
                'detail' => "driver {$mailer}",
            ];
        }

        if (config('filesystems.disks.r2_books.bucket') || config('filesystems.disks.r2_covers.bucket')) {
            $services[] = [
                'key' => 'storage_r2',
                'label' => 'Almacenamiento R2',
                'status' => 'configured',
                'detail' => 'EPUB/PDF y portadas externas',
            ];
        }

        return $services;
    }

    // ════════════════════════════════════════════════════════
    // Errores del log
    // ════════════════════════════════════════════════════════

    private function recentErrors(): array
    {
        $path = storage_path('logs/laravel.log');
        if (! is_file($path)) {
            return ['log_exists' => false, 'size_mb' => 0, 'recent' => [], 'recent_all' => []];
        }

        $size = filesize($path) ?: 0;
        $chunk = (int) config('health.log.tail_bytes', 524288);

        $fh = @fopen($path, 'rb');
        if ($fh === false) {
            return [
                'log_exists' => true,
                'size_mb' => round($size / 1048576, 2),
                'recent' => [],
                'recent_all' => [],
                'readable' => false,
            ];
        }
        if ($size > $chunk) {
            @fseek($fh, -$chunk, SEEK_END);
        }
        $tail = (string) @stream_get_contents($fh);
        fclose($fh);

        $entries = [];
        preg_match_all(
            '/^\[(\d{4}-\d{2}-\d{2}[ T][\d:.,+]+)\]\s+\w+\.(ERROR|CRITICAL|ALERT|EMERGENCY)\s*:\s*(.*)$/m',
            $tail,
            $matches,
            PREG_SET_ORDER
        );

        foreach ($matches as $m) {
            $message = trim($m[3]);
            $brace = strpos($message, ' {"');
            if ($brace !== false) {
                $message = substr($message, 0, $brace);
            }
            $entries[] = [
                'timestamp' => $m[1],
                'level' => $m[2],
                'message' => $this->sanitize(mb_substr($message, 0, 300)),
            ];
        }

        return [
            'log_exists' => true,
            'size_mb' => round($size / 1048576, 2),
            'recent' => array_slice(array_reverse($entries), 0, 15),
            'recent_all' => array_slice($entries, -500),
            'readable' => true,
        ];
    }

    private function failedJobs(): array
    {
        try {
            $total = (int) DB::table('failed_jobs')->count();
            $jobs = DB::table('failed_jobs')
                ->orderByDesc('failed_at')
                ->limit(20)
                ->get(['id', 'uuid', 'connection', 'queue', 'exception', 'failed_at'])
                ->map(fn ($j) => [
                    'id' => $j->id,
                    'uuid' => $j->uuid,
                    'connection' => $j->connection,
                    'queue' => $j->queue,
                    'exception' => $this->sanitize(mb_substr(strtok((string) $j->exception, "\n") ?: '', 0, 250)),
                    'failed_at' => $j->failed_at,
                ])
                ->values();

            return ['total' => $total, 'jobs' => $jobs];
        } catch (\Throwable $e) {
            return ['total' => 0, 'jobs' => [], 'error' => $this->sanitize($e->getMessage())];
        }
    }

    // ════════════════════════════════════════════════════════
    // Métricas de peticiones (middleware RecordRequestMetrics)
    // ════════════════════════════════════════════════════════

    private function requestMetrics(): array
    {
        $buckets = (array) config('health.requests.duration_buckets');

        $empty = [
            'total' => 0,
            'errors_4xx' => 0,
            'errors_5xx' => 0,
            'error_rate_pct' => 0,
            'avg_ms' => null,
            'p95_ms' => null,
            'p99_ms' => null,
        ];

        try {
            $read = function (string $day) use ($buckets): array {
                $total = (int) Cache::get("metrics:req:{$day}", 0);
                $e4 = (int) Cache::get("metrics:req:{$day}:4xx", 0);
                $e5 = (int) Cache::get("metrics:req:{$day}:5xx", 0);
                $durSum = (int) Cache::get("metrics:req:{$day}:dur_sum", 0);

                $bucketCounts = [];
                foreach ($buckets as $i => $limit) {
                    $bucketCounts[] = (int) Cache::get("metrics:req:{$day}:b{$i}", 0);
                }
                $bucketCounts[] = (int) Cache::get("metrics:req:{$day}:b" . count($buckets), 0);

                return [
                    'total' => $total,
                    'errors_4xx' => $e4,
                    'errors_5xx' => $e5,
                    'error_rate_pct' => $total > 0 ? round((($e4 + $e5) / $total) * 100, 1) : 0,
                    'avg_ms' => $total > 0 ? (int) round($durSum / $total) : null,
                    'p95_ms' => $this->percentileFromBuckets($bucketCounts, $buckets, 0.95),
                    'p99_ms' => $this->percentileFromBuckets($bucketCounts, $buckets, 0.99),
                ];
            };

            $byDay = [];
            for ($i = 6; $i >= 0; $i--) {
                $day = now()->subDays($i)->format('Y-m-d');
                $stats = $read($day);
                $byDay[] = [
                    'date' => $day,
                    'total' => $stats['total'],
                    'errors' => $stats['errors_4xx'] + $stats['errors_5xx'],
                ];
            }

            return [
                'today' => $read(now()->format('Y-m-d')),
                'yesterday' => $read(now()->subDay()->format('Y-m-d')),
                'by_day' => $byDay,
                'last_5xx' => array_values(Cache::get(RecordRequestMetrics::LAST_5XX_KEY, [])),
                'slow_requests' => array_values(Cache::get(RecordRequestMetrics::SLOW_REQ_KEY, [])),
                'slow_threshold_ms' => (int) config('health.requests.slow_ms'),
            ];
        } catch (\Throwable $e) {
            // Cache caída: métricas vacías con la causa; el panel sigue vivo.
            return [
                'today' => $empty,
                'yesterday' => $empty,
                'by_day' => [],
                'last_5xx' => [],
                'slow_requests' => [],
                'slow_threshold_ms' => (int) config('health.requests.slow_ms'),
                'error' => $this->sanitize($e->getMessage()),
            ];
        }
    }

    /**
     * Percentil APROXIMADO a partir de los buckets de duración: devuelve el
     * límite superior del bucket donde cae el percentil. No es exacto (por
     * eso la UI lo marca con ≈), pero es 100% derivado de datos reales.
     */
    private function percentileFromBuckets(array $counts, array $limits, float $pct): ?int
    {
        $total = array_sum($counts);
        if ($total === 0) {
            return null;
        }

        $target = $total * $pct;
        $cumulative = 0;
        foreach ($counts as $i => $count) {
            $cumulative += $count;
            if ($cumulative >= $target) {
                // Último bucket = "más de X": reportamos su límite inferior.
                return $i < count($limits) ? (int) $limits[$i] : (int) end($limits);
            }
        }

        return (int) end($limits);
    }

    // ════════════════════════════════════════════════════════
    // Usuarios / presencia
    // ════════════════════════════════════════════════════════

    private function activeUsers(): array
    {
        try {
            $online = (int) DB::table('personal_access_tokens')
                ->where('last_used_at', '>=', now()->subMinutes(15))
                ->distinct('tokenable_id')->count('tokenable_id');

            return [
                'online_now' => $online,
                'last_24h' => (int) DB::table('personal_access_tokens')
                    ->where('last_used_at', '>=', now()->subDay())
                    ->distinct('tokenable_id')->count('tokenable_id'),
                'new_this_week' => (int) DB::table('users')
                    ->where('created_at', '>=', now()->subWeek())->count(),
                'total' => (int) DB::table('users')->count(),
            ];
        } catch (\Throwable $e) {
            return [
                'online_now' => 0,
                'last_24h' => 0,
                'new_this_week' => 0,
                'total' => 0,
                'error' => $this->sanitize($e->getMessage()),
            ];
        }
    }

    private function presence(): array
    {
        try {
            $window = (int) config('health.presence.online_window_minutes', 3);
            $threshold = now()->subMinutes($window);

            $online = DB::table('users')
                ->where('last_seen_at', '>=', $threshold)
                ->orderByDesc('last_seen_at')
                ->limit(24)
                ->get(['id', 'name', 'username', 'avatar', 'last_seen_at']);

            return [
                'online_count' => (int) DB::table('users')
                    ->where('last_seen_at', '>=', $threshold)->count(),
                'guests_online' => PresenceController::guestsOnline(),
                'online_users' => $online->map(fn ($u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'username' => $u->username,
                    'avatar' => $u->avatar,
                    'last_seen_at' => $u->last_seen_at,
                ])->values(),
            ];
        } catch (\Throwable $e) {
            return [
                'online_count' => 0,
                'guests_online' => 0,
                'online_users' => [],
                'error' => $this->sanitize($e->getMessage()),
            ];
        }
    }

    // ════════════════════════════════════════════════════════
    // Integridad de archivos (resultado del último análisis)
    // ════════════════════════════════════════════════════════

    private function fileIntegrity(): array
    {
        try {
            $last = $this->fileScanner->lastResult();
        } catch (\Throwable) {
            // Cache caída: sin resultado previo disponible.
            $last = null;
        }

        if ($last === null) {
            return ['scanned' => false];
        }

        return array_merge(['scanned' => true], $last);
    }

    // ════════════════════════════════════════════════════════
    // Gráficas
    // ════════════════════════════════════════════════════════

    private function charts(array $errors): array
    {
        $days = 14;
        $from = now()->subDays($days - 1)->startOfDay();

        try {
            $usersRaw = DB::table('users')
                ->selectRaw('DATE(created_at) as d, COUNT(*) as c')
                ->where('created_at', '>=', $from)
                ->groupBy('d')->pluck('c', 'd');

            $readsRaw = DB::table('book_views')
                ->selectRaw('DATE(last_viewed_at) as d, COUNT(*) as c')
                ->where('last_viewed_at', '>=', $from)
                ->groupBy('d')->pluck('c', 'd');
        } catch (\Throwable) {
            // BD caída o tabla ausente: gráficas vacías, el resto del panel sigue.
            $usersRaw = collect();
            $readsRaw = collect();
        }

        $newUsers = [];
        $readerActivity = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $day = now()->subDays($i)->format('Y-m-d');
            $newUsers[] = ['date' => $day, 'count' => (int) ($usersRaw[$day] ?? 0)];
            $readerActivity[] = ['date' => $day, 'count' => (int) ($readsRaw[$day] ?? 0)];
        }

        $errCounts = [];
        foreach ($errors['recent_all'] ?? [] as $e) {
            $d = substr($e['timestamp'], 0, 10);
            $errCounts[$d] = ($errCounts[$d] ?? 0) + 1;
        }
        $errorsByDay = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = now()->subDays($i)->format('Y-m-d');
            $errorsByDay[] = ['date' => $day, 'count' => (int) ($errCounts[$day] ?? 0)];
        }

        return [
            'new_users_by_day' => $newUsers,
            'reader_activity_by_day' => $readerActivity,
            'errors_by_day' => $errorsByDay,
        ];
    }

    // ════════════════════════════════════════════════════════
    // Alertas (con memoria de primera detección y "revisada")
    // ════════════════════════════════════════════════════════

    /**
     * Construye la lista de alertas activas. Cada alerta tiene un código
     * estable, así puede recordarse cuándo empezó y si fue marcada como
     * revisada. Cuando la condición desaparece, la alerta desaparece.
     */
    private function buildAlerts(
        array $api,
        array $queue,
        array $scheduler,
        array $stripe,
        ?array $meili,
        array $errors,
        array $failedJobs,
        array $requests,
    ): array {
        $raised = [];

        $raise = function (string $code, string $severity, string $service, string $message, ?string $link = null) use (&$raised) {
            $raised[$code] = compact('code', 'severity', 'service', 'message', 'link');
        };

        // Infraestructura
        if (! $api['db']['ok']) {
            $raise('db_down', 'critical', 'Base de datos', 'La base de datos no responde.');
        } elseif (($api['db']['latency_ms'] ?? 0) > (int) config('health.db.latency_warning_ms')) {
            $raise('db_slow', 'warning', 'Base de datos', "Latencia alta ({$api['db']['latency_ms']} ms).");
        }
        if (! $api['cache']['ok']) {
            $raise('cache_down', 'critical', 'Cache', 'La cache no funciona (afecta sesiones y métricas).');
        }
        if (! $api['storage']['ok']) {
            $raise('storage_down', 'critical', 'Storage', 'No se puede escribir en el storage público (subidas rotas).');
        }
        if ($api['environment'] === 'production' && $api['debug']) {
            $raise('debug_production', 'critical', 'Configuración', 'APP_DEBUG activado en producción: expone datos sensibles.');
        }

        // Disco
        if ($api['disk']['status'] === 'critical') {
            $raise('disk_critical', 'critical', 'Disco', "Disco casi lleno ({$api['disk']['used_pct']}% usado, {$api['disk']['free_gb']} GB libres).");
        } elseif ($api['disk']['status'] === 'warning') {
            $raise('disk_warning', 'warning', 'Disco', "Disco al {$api['disk']['used_pct']}% — planifica limpieza o ampliación.");
        }

        // Cola
        if ($queue['status'] === 'critical') {
            $raise('queue_critical', 'critical', 'Cola', $queue['status_reason'] ?? 'La cola está bloqueada.', '/admin/colas');
        } elseif ($queue['status'] === 'degraded') {
            $raise('queue_degraded', 'warning', 'Cola', $queue['status_reason'] ?? 'La cola va con retraso.', '/admin/colas');
        } elseif ($queue['status'] === 'warning' && ! $queue['worker']['active']) {
            $raise('worker_missing', 'warning', 'Cola', $queue['status_reason'] ?? 'Ningún worker activo.', '/admin/colas');
        }
        if (($failedJobs['total'] ?? 0) > 0) {
            $raise('failed_jobs', 'warning', 'Cola', "{$failedJobs['total']} job(s) fallidos pendientes de revisar.", '/admin/colas');
        }
        if ($scheduler['required'] && ! $scheduler['active']) {
            $raise(
                'scheduler_missing',
                'warning',
                'Scheduler',
                'El scheduler no registra actividad reciente; revisa cron o el timer systemd.'
            );
        }

        // Stripe
        if (! $stripe['configured']) {
            $raise('stripe_unconfigured', 'warning', 'Stripe', 'Stripe sin configurar: los pagos no funcionarán.');
        } else {
            if (! $stripe['webhook_configured']) {
                $raise('stripe_webhook_missing', 'warning', 'Stripe', 'Falta el webhook secret: las suscripciones no se sincronizarán.');
            }
            if ($stripe['ping'] && ! $stripe['ping']['ok']) {
                $raise('stripe_down', 'critical', 'Stripe', 'Stripe no responde al ping: los cobros pueden estar caídos.');
            }
            if ($api['environment'] === 'production' && $stripe['mode'] === 'test') {
                $raise('stripe_test_in_prod', 'warning', 'Stripe', 'Stripe está en modo TEST en producción.');
            }
        }

        // Meilisearch
        if ($meili !== null && ! $meili['ok']) {
            $raise('meili_down', 'critical', 'Meilisearch', 'El buscador no responde: la búsqueda instantánea está caída.');
        }

        // Log / API
        if (($errors['size_mb'] ?? 0) > (int) config('health.log.size_warning_mb')) {
            $raise('log_big', 'warning', 'Logs', "El log pesa {$errors['size_mb']} MB — conviene vaciarlo o rotarlo.");
        }
        if (($requests['today']['errors_5xx'] ?? 0) > 0) {
            $raise('api_5xx_today', 'warning', 'API', "{$requests['today']['errors_5xx']} error(es) 5xx hoy en la API.");
        }

        // ── Memoria de primera detección + estado revisada ──
        try {
            $seen = (array) Cache::get(self::ALERTS_SEEN_KEY, []);
            $acked = (array) Cache::get(self::ALERTS_ACKED_KEY, []);

            $nowIso = now()->toIso8601String();
            $newSeen = [];
            foreach ($raised as $code => $alert) {
                $newSeen[$code] = $seen[$code] ?? $nowIso;
            }
            Cache::put(
                self::ALERTS_SEEN_KEY,
                $newSeen,
                now()->addDays((int) config('health.alerts.seen_ttl_days', 30))
            );

            return array_values(array_map(fn ($a) => array_merge($a, [
                'id' => $a['code'],
                'first_seen' => $newSeen[$a['code']],
                'last_seen' => $nowIso,
                'acked' => isset($acked[$a['code']]),
            ]), $raised));
        } catch (\Throwable) {
            // Sin cache: devolvemos las alertas sin memoria (mejor que nada)
            return array_values(array_map(fn ($a) => array_merge($a, [
                'id' => $a['code'],
                'first_seen' => null,
                'last_seen' => now()->toIso8601String(),
                'acked' => false,
            ]), $raised));
        }
    }

    /** Marca/desmarca una alerta como revisada. */
    public function ackAlert(string $code, bool $acked): void
    {
        $map = (array) Cache::get(self::ALERTS_ACKED_KEY, []);
        if ($acked) {
            $map[$code] = now()->timestamp;
        } else {
            unset($map[$code]);
        }
        Cache::put(
            self::ALERTS_ACKED_KEY,
            $map,
            now()->addDays((int) config('health.alerts.ack_ttl_days', 7))
        );
        Cache::forget('health:summary');
    }

    // ════════════════════════════════════════════════════════
    // Estado general
    // ════════════════════════════════════════════════════════

    /**
     * Estado global del sistema calculado desde los componentes reales.
     * Con disco crítico o worker detenido, JAMÁS reporta "Operativo".
     */
    private function overallStatus(
        array $api,
        array $queue,
        array $scheduler,
        array $stripe,
        ?array $meili,
        array $alerts
    ): array
    {
        $components = [
            'db' => $api['db']['ok'] ? 'ok' : 'critical',
            'cache' => $api['cache']['ok'] ? 'ok' : 'critical',
            'storage' => $api['storage']['ok'] ? 'ok' : 'critical',
            'disk' => $api['disk']['status'],
            'queue' => $queue['status'],
            'scheduler' => $scheduler['status'],
            'stripe' => ! $stripe['configured'] ? 'warning'
                : ($stripe['ping'] === null || $stripe['ping']['ok'] ? 'ok' : 'critical'),
        ];
        if ($meili !== null) {
            $components['meilisearch'] = $meili['ok'] ? 'ok' : 'critical';
        }

        // Núcleo (BD/cache/storage/disco crítico) caído → CRÍTICO.
        $coreCritical = $components['db'] === 'critical'
            || $components['cache'] === 'critical'
            || $components['storage'] === 'critical'
            || $components['disk'] === 'critical'
            || $components['queue'] === 'critical';

        // Servicios esenciales no-núcleo caídos → DEGRADADO (el sitio
        // funciona pero pagos/búsqueda no).
        $essentialDown = ($components['stripe'] ?? null) === 'critical'
            || ($components['meilisearch'] ?? null) === 'critical'
            || $components['queue'] === 'degraded'
            || $components['scheduler'] === 'degraded';

        $hasWarnings = count(array_filter(
            $alerts,
            fn ($a) => ! $a['acked']
        )) > 0 || in_array('warning', $components, true);

        $status = $coreCritical ? 'critical'
            : ($essentialDown ? 'degraded'
                : ($hasWarnings ? 'warning' : 'ok'));

        return [
            'status' => $status,
            'components' => $components,
            'active_alerts' => count(array_filter($alerts, fn ($a) => ! $a['acked'])),
        ];
    }

    // ════════════════════════════════════════════════════════
    // Sanitización: los mensajes de error jamás exponen secretos
    // ════════════════════════════════════════════════════════

    private function sanitize(string $message): string
    {
        // Los drivers nativos (p. ej. PostgreSQL localizado en Windows) emiten
        // mensajes en Windows-1252/Latin-1; JsonResponse exige UTF-8 válido y
        // una sola cadena inválida tiraría el panel completo con un 500.
        if (! mb_check_encoding($message, 'UTF-8')) {
            $converted = @iconv('Windows-1252', 'UTF-8//IGNORE', $message);
            $message = $converted !== false
                ? $converted
                : mb_convert_encoding($message, 'UTF-8', 'ISO-8859-1');
        }

        // Ofusca cadenas tipo credencial (claves API, bearer, contraseñas en DSN)
        $message = preg_replace('/(sk_(?:live|test)_)[A-Za-z0-9]+/', '$1***', $message);
        $message = preg_replace('/(Bearer\s+)[A-Za-z0-9._\-]+/i', '$1***', $message);
        $message = preg_replace('/(password|pwd|secret|token|key)(=|:\s*)[^\s;,\'"]+/i', '$1$2***', $message);

        return $message;
    }
}

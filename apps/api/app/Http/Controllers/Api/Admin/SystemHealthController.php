<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use App\Services\Health\FileIntegrityScanner;
use App\Services\Health\HealthCheckService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Panel de salud del sistema — SOLO super_admin.
 * Controlador delgado: la lógica de cálculo vive en
 * App\Services\Health\{HealthCheckService, FileIntegrityScanner}.
 */
class SystemHealthController extends Controller
{
    public function __construct(
        private readonly HealthCheckService $health,
        private readonly FileIntegrityScanner $scanner,
    ) {}

    private function assertSuperAdmin(Request $request): void
    {
        abort_unless(
            $request->user()?->hasRole('super_admin'),
            403,
            'Solo el super administrador puede acceder a la salud del sistema.'
        );
    }

    /** GET /api/admin/system/health */
    public function health(Request $request): JsonResponse
    {
        $this->assertSuperAdmin($request);

        // JSON_INVALID_UTF8_SUBSTITUTE: el resumen incluye mensajes de error de
        // drivers y del log que pueden llegar en codificaciones ajenas a UTF-8
        // (PostgreSQL localizado en Windows). Un byte inválido debe degradar el
        // texto (U+FFFD), nunca tumbar el panel completo con un 500.
        return response()->json(['data' => $this->health->summary()], 200, [], JSON_INVALID_UTF8_SUBSTITUTE);
    }

    // ─────────────────────────── Integridad de archivos ───────────────────────────

    /** POST /api/admin/system/file-scan — ejecuta el análisis (acotado). */
    public function runFileScan(Request $request): JsonResponse
    {
        $this->assertSuperAdmin($request);

        $result = $this->scanner->scan();
        Cache::forget('health:summary');

        AuditLogger::log(
            $request,
            'system.file_scan',
            reason: "Análisis manual: {$result['checked_files']} archivos, {$result['issues_total']} problemas",
        );

        return response()->json([
            'data' => $result,
            'message' => "Análisis completado: {$result['checked_files']} archivos revisados, {$result['issues_total']} problema(s).",
        ]);
    }

    // ─────────────────────────── Alertas ───────────────────────────

    /** POST /api/admin/system/alerts/ack — marca/desmarca una alerta como revisada. */
    public function ackAlert(Request $request): JsonResponse
    {
        $this->assertSuperAdmin($request);

        $data = $request->validate([
            'id' => ['required', 'string', 'max:60'],
            'acked' => ['required', 'boolean'],
        ]);

        $this->health->ackAlert($data['id'], $data['acked']);

        AuditLogger::log(
            $request,
            $data['acked'] ? 'system.alert_ack' : 'system.alert_unack',
            entityType: 'alert',
            entityLabel: $data['id'],
        );

        return response()->json([
            'message' => $data['acked'] ? 'Alerta marcada como revisada.' : 'Alerta reactivada.',
        ]);
    }

    // ─────────────────────────── Cola: detalle + acciones ───────────────────────────

    /** GET /api/admin/system/queue — vista completa de la cola. */
    public function queueDetail(Request $request): JsonResponse
    {
        $this->assertSuperAdmin($request);

        $now = now()->timestamp;
        $mapJob = function ($j) use ($now) {
            $payload = json_decode((string) $j->payload, true);
            return [
                'id' => $j->id,
                'queue' => $j->queue,
                'name' => $payload['displayName'] ?? '(desconocido)',
                'attempts' => (int) $j->attempts,
                'age_seconds' => max(0, $now - (int) $j->created_at),
                'available_in_seconds' => max(0, (int) $j->available_at - $now),
                'reserved' => $j->reserved_at !== null,
            ];
        };

        $ready = DB::table('jobs')
            ->whereNull('reserved_at')->where('available_at', '<=', $now)
            ->orderBy('available_at')->limit(25)
            ->get(['id', 'queue', 'payload', 'attempts', 'created_at', 'available_at', 'reserved_at'])
            ->map($mapJob)->values();

        $delayed = DB::table('jobs')
            ->whereNull('reserved_at')->where('available_at', '>', $now)
            ->orderBy('available_at')->limit(25)
            ->get(['id', 'queue', 'payload', 'attempts', 'created_at', 'available_at', 'reserved_at'])
            ->map($mapJob)->values();

        $processing = DB::table('jobs')
            ->whereNotNull('reserved_at')
            ->orderBy('reserved_at')->limit(25)
            ->get(['id', 'queue', 'payload', 'attempts', 'created_at', 'available_at', 'reserved_at'])
            ->map($mapJob)->values();

        // El resumen (worker, contadores, estado) sale del mismo servicio
        // que alimenta el panel de salud — una sola fuente de verdad.
        $summary = $this->health->summary();

        return response()->json([
            'data' => [
                'status' => $summary['queue'],
                'ready' => $ready,
                'delayed' => $delayed,
                'processing' => $processing,
                'failed' => $summary['failed_jobs'],
                'generated_at' => now()->toIso8601String(),
            ],
        ], 200, [], JSON_INVALID_UTF8_SUBSTITUTE);
    }

    /** DELETE /api/admin/system/queue/pending/{id} — cancela un job en espera. */
    public function cancelPendingJob(Request $request, int $id): JsonResponse
    {
        $this->assertSuperAdmin($request);

        $job = DB::table('jobs')->where('id', $id)->first(['id', 'payload', 'reserved_at']);
        if (! $job) {
            return response()->json(['message' => 'El job ya no existe (quizá ya se procesó).'], 404);
        }
        if ($job->reserved_at !== null) {
            return response()->json(['message' => 'El job ya está en ejecución: no se puede cancelar.'], 422);
        }

        $payload = json_decode((string) $job->payload, true);
        $deleted = DB::table('jobs')
            ->where('id', $id)
            ->whereNull('reserved_at')
            ->delete();
        if ($deleted !== 1) {
            return response()->json([
                'message' => 'El job comenzó a ejecutarse y ya no se puede cancelar.',
            ], 422);
        }

        AuditLogger::log(
            $request,
            'system.queue_cancel_job',
            entityType: 'job',
            entityId: $id,
            entityLabel: $payload['displayName'] ?? null,
        );

        return response()->json(['message' => 'Job cancelado.']);
    }

    // ─────────────────────────── Jobs fallidos ───────────────────────────

    /** POST /api/admin/system/failed-jobs/retry  (body: uuid opcional → todos) */
    public function retryFailedJobs(Request $request): JsonResponse
    {
        $this->assertSuperAdmin($request);

        $data = $request->validate(['uuid' => ['nullable', 'string', 'max:100']]);
        $target = $data['uuid'] ?? 'all';

        Artisan::call('queue:retry', ['id' => [$target]]);

        AuditLogger::log($request, 'system.retry_failed_jobs', entityType: 'job', entityLabel: $target);

        return response()->json([
            'message' => $target === 'all'
                ? 'Todos los jobs fallidos fueron reencolados.'
                : 'Job reencolado.',
            'output' => trim(Artisan::output()),
        ]);
    }

    /** DELETE /api/admin/system/failed-jobs/{uuid} */
    public function forgetFailedJob(Request $request, string $uuid): JsonResponse
    {
        $this->assertSuperAdmin($request);

        Artisan::call('queue:forget', ['id' => $uuid]);

        AuditLogger::log($request, 'system.forget_failed_job', entityType: 'job', entityLabel: $uuid);

        return response()->json(['message' => 'Job fallido descartado.']);
    }

    /** DELETE /api/admin/system/failed-jobs */
    public function flushFailedJobs(Request $request): JsonResponse
    {
        $this->assertSuperAdmin($request);

        Artisan::call('queue:flush');

        AuditLogger::log($request, 'system.flush_failed_jobs');

        return response()->json(['message' => 'Todos los jobs fallidos fueron eliminados.']);
    }

    /**
     * POST /api/admin/system/metrics/clear — vacía las métricas de rendimiento
     * de la API (contadores por día, buckets de latencia, últimos 5xx y
     * peticiones lentas). Útil para resetear después de una prueba de carga o
     * si se acumulan datos que ya no interesan. Las métricas expiran solas a
     * los 15 días; esto solo adelanta esa limpieza.
     */
    public function clearMetrics(Request $request): JsonResponse
    {
        $this->assertSuperAdmin($request);

        $days = (int) config('health.requests.metrics_ttl_days', 15);
        $buckets = count((array) config('health.requests.duration_buckets', []));

        $cleared = 0;
        // Margen doble del TTL por si quedaron claves de días previos al cambio de TTL.
        for ($i = 0; $i <= $days * 2; $i++) {
            $day = now()->subDays($i)->format('Y-m-d');
            $keys = ["metrics:req:{$day}", "metrics:req:{$day}:4xx", "metrics:req:{$day}:5xx", "metrics:req:{$day}:dur_sum"];
            for ($b = 0; $b <= $buckets; $b++) {
                $keys[] = "metrics:req:{$day}:b{$b}";
            }
            foreach ($keys as $key) {
                if (Cache::forget($key)) {
                    $cleared++;
                }
            }
        }
        Cache::forget(\App\Http\Middleware\RecordRequestMetrics::LAST_5XX_KEY);
        Cache::forget(\App\Http\Middleware\RecordRequestMetrics::SLOW_REQ_KEY);
        Cache::forget('health:summary');

        AuditLogger::log(
            $request,
            'system.clear_metrics',
            reason: "Métricas de rendimiento de la API vaciadas ({$cleared} contadores)",
        );

        return response()->json(['message' => 'Métricas de rendimiento vaciadas.']);
    }

    /** POST /api/admin/system/logs/clear */
    public function clearLogs(Request $request): JsonResponse
    {
        $this->assertSuperAdmin($request);

        $path = storage_path('logs/laravel.log');
        $sizeMb = is_file($path) ? round(filesize($path) / 1048576, 2) : 0;
        if (is_file($path)) {
            file_put_contents($path, '');
        }

        AuditLogger::log($request, 'system.clear_logs', reason: "Log de {$sizeMb} MB vaciado");

        return response()->json(['message' => 'Log de errores vaciado.']);
    }
}

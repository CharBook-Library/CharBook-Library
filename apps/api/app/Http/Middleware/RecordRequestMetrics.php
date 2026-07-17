<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

/**
 * Monitoreo ligero de peticiones API para el panel de salud del sistema.
 *
 * Contadores por día en cache (driver database):
 *   metrics:req:{Y-m-d}          → total de requests
 *   metrics:req:{Y-m-d}:4xx/:5xx → errores
 *   metrics:req:{Y-m-d}:dur_sum  → suma de duraciones (ms) → promedio
 *   metrics:req:{Y-m-d}:b{i}     → buckets de duración → p95/p99 aproximados
 * más dos ring-buffers: últimos 5xx y peticiones lentas.
 *
 * Registrado con PREPEND en el grupo api: debe envolver a SubstituteBindings
 * para contar también los 404 de route-model-binding. Las excepciones se
 * cuentan en el catch y se relanzan intactas.
 *
 * Todo es best-effort: si la cache falla, el request sigue su curso normal.
 */
class RecordRequestMetrics
{
    public const LAST_5XX_KEY = 'metrics:last_5xx';
    public const SLOW_REQ_KEY = 'metrics:slow_req';

    public function handle(Request $request, Closure $next): Response
    {
        $t0 = microtime(true);

        try {
            $response = $next($request);
        } catch (\Throwable $e) {
            try {
                $this->record($request, $this->statusFromException($e), $this->elapsedMs($t0));
            } catch (\Throwable) {
                // Nunca romper la petición por culpa del monitoreo.
            }
            throw $e;
        }

        try {
            $this->record($request, $response->getStatusCode(), $this->elapsedMs($t0));
        } catch (\Throwable) {
            // Nunca romper la petición por culpa del monitoreo.
        }

        return $response;
    }

    private function elapsedMs(float $t0): int
    {
        return (int) round((microtime(true) - $t0) * 1000);
    }

    private function statusFromException(\Throwable $e): int
    {
        return match (true) {
            $e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface => $e->getStatusCode(),
            $e instanceof \Illuminate\Database\Eloquent\ModelNotFoundException => 404,
            $e instanceof \Illuminate\Validation\ValidationException => $e->status,
            $e instanceof \Illuminate\Auth\AuthenticationException => 401,
            $e instanceof \Illuminate\Auth\Access\AuthorizationException => 403,
            default => 500,
        };
    }

    private function record(Request $request, int $status, int $durationMs): void
    {
        // No contamos el propio panel de salud ni los heartbeats de presencia
        // para no inflar las métricas con el monitoreo mismo.
        $path = $request->path();
        if (str_starts_with($path, 'api/admin/system') || $path === 'api/presence/ping') {
            return;
        }

        $day = now()->format('Y-m-d');
        $ttl = now()->addDays((int) config('health.requests.metrics_ttl_days', 15));

        $this->increment("metrics:req:{$day}", $ttl);
        $this->increment("metrics:req:{$day}:dur_sum", $ttl, $durationMs);
        $this->increment("metrics:req:{$day}:b" . $this->bucketIndex($durationMs), $ttl);

        if ($status >= 500) {
            $this->increment("metrics:req:{$day}:5xx", $ttl);
            $this->pushRing(self::LAST_5XX_KEY, [
                'time' => now()->toIso8601String(),
                'method' => $request->method(),
                'path' => mb_substr($path, 0, 120),
                'status' => $status,
            ]);
        } elseif ($status >= 400) {
            $this->increment("metrics:req:{$day}:4xx", $ttl);
        }

        // Peticiones lentas: ruta + duración (sin query string ni payload,
        // para no filtrar información sensible).
        if ($durationMs >= (int) config('health.requests.slow_ms', 1000)) {
            $this->pushRing(self::SLOW_REQ_KEY, [
                'time' => now()->toIso8601String(),
                'method' => $request->method(),
                'path' => mb_substr($path, 0, 120),
                'ms' => $durationMs,
                'status' => $status,
            ]);
        }
    }

    /** Índice del bucket de duración según config health.requests.duration_buckets. */
    private function bucketIndex(int $ms): int
    {
        $buckets = (array) config('health.requests.duration_buckets', [100, 250, 500, 1000, 2500]);
        foreach ($buckets as $i => $limit) {
            if ($ms < (int) $limit) {
                return $i;
            }
        }

        return count($buckets); // último bucket abierto: "más de X"
    }

    private function increment(string $key, \DateTimeInterface $ttl, int $by = 1): void
    {
        // add() crea la clave con TTL si no existe; increment() no toca el TTL.
        Cache::add($key, 0, $ttl);
        Cache::increment($key, $by);
    }

    private function pushRing(string $key, array $entry, int $max = 20): void
    {
        $ring = Cache::get($key, []);
        array_unshift($ring, $entry);
        Cache::put($key, array_slice($ring, 0, $max), now()->addDays(7));
    }
}

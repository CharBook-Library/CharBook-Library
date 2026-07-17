<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: 'api',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Nota: NO usamos statefulApi() porque autenticamos con Bearer tokens
        // desde Next.js cross-origin, no con cookies de sesión.

        // ===== Middleware global =====
        $middleware->append(\App\Http\Middleware\SecurityHeaders::class);

        // La API siempre responde JSON: garantiza 401/403/422 limpios en vez
        // de intentar redirigir a la ruta web 'login' (que daría 500).
        $middleware->api(prepend: [
            \App\Http\Middleware\ForceJsonAccept::class,
        ]);

        // Monitoreo ligero: contadores diarios de requests/4xx/5xx para el
        // panel de salud del sistema (best-effort, nunca rompe la petición).
        // PREPEND: debe envolver a SubstituteBindings para contar también los
        // 404 de route-model-binding, que se lanzan antes de los "append".
        $middleware->api(prepend: [
            \App\Http\Middleware\RecordRequestMetrics::class,
        ]);

        // En produccion, CACHE_STORE=redis activa el limitador atomico de
        // Redis. El fallback local (database/array) conserva el middleware
        // estandar y no exige instalar Redis para desarrollar.
        if (env('CACHE_STORE', 'database') === 'redis') {
            $middleware->throttleWithRedis();
        }

        // ===== Aliases =====
        $middleware->alias([
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
            'admin' => \App\Http\Middleware\EnsureUserIsAdmin::class,
            'staff' => \App\Http\Middleware\EnsureUserIsStaff::class,
            'verified.email' => \App\Http\Middleware\EnsureEmailVerified::class,
            'entitlement' => \App\Http\Middleware\EnsureEntitlement::class,
            'account.active' => \App\Http\Middleware\EnsureAccountIsActive::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Respuestas JSON consistentes para errores en peticiones API.
        $exceptions->shouldRenderJsonWhen(function ($request) {
            return $request->is('api/*') || $request->expectsJson();
        });

        // Sin esto, una petición a una ruta auth:sanctum sin token intenta
        // redirigir a la ruta web 'login' (inexistente) y ocasiona un error 500.
        // En la API siempre debe devolver un error 401 en formato JSON.
        $exceptions->render(function (
            \Illuminate\Auth\AuthenticationException $e,
            $request
        ) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message' => 'No autenticado.',
                ], 401);
            }
        });
    })
    ->create();

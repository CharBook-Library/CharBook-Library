<?php

/*
|--------------------------------------------------------------------------
| Salud del sistema — umbrales y tiempos centralizados
|--------------------------------------------------------------------------
| Única fuente de verdad para el panel /admin/sistema. Nada de valores
| repetidos en controladores o servicios: todo sale de aquí y puede
| ajustarse por entorno vía variables de entorno.
*/

return [

    // Cache del resumen completo (evita recalcular en cada refetch del panel
    // y protege contra varios admins con auto-refresh simultáneo).
    'summary_cache_seconds' => env('HEALTH_SUMMARY_CACHE', 10),

    // Cache específico de pings externos (Stripe / Meilisearch): más largo,
    // porque son las comprobaciones lentas y con coste de red.
    'external_ping_cache_seconds' => env('HEALTH_EXTERNAL_PING_CACHE', 60),

    'disk' => [
        'warning_pct' => env('HEALTH_DISK_WARNING_PCT', 80),
        'critical_pct' => env('HEALTH_DISK_CRITICAL_PCT', 90),
    ],

    'db' => [
        'latency_warning_ms' => env('HEALTH_DB_LATENCY_WARNING_MS', 150),
    ],

    'queue' => [
        // Sin heartbeat del worker en este tiempo → worker inactivo.
        'worker_stale_seconds' => env('HEALTH_WORKER_STALE_SECONDS', 120),
        // Job LISTO (available_at vencido) esperando más de esto → degradado / crítico.
        'oldest_ready_warning_seconds' => env('HEALTH_QUEUE_READY_WARNING', 300),
        'oldest_ready_critical_seconds' => env('HEALTH_QUEUE_READY_CRITICAL', 1800),
    ],

    'scheduler' => [
        'required' => env('HEALTH_SCHEDULER_REQUIRED', env('APP_ENV') === 'production'),
        'stale_seconds' => env('HEALTH_SCHEDULER_STALE_SECONDS', 180),
    ],

    'log' => [
        'size_warning_mb' => env('HEALTH_LOG_WARNING_MB', 50),
        // Cuánta cola del log se lee para parsear errores (bytes).
        'tail_bytes' => 512 * 1024,
    ],

    'requests' => [
        // Peticiones por encima de esto entran al listado de "lentas".
        'slow_ms' => env('HEALTH_SLOW_REQUEST_MS', 1000),
        // Buckets (ms) para aproximar percentiles sin guardar cada muestra.
        'duration_buckets' => [100, 250, 500, 1000, 2500],
        'metrics_ttl_days' => 15,
    ],

    'stripe' => [
        'connect_timeout' => 3,
        'timeout' => 5,
    ],

    'meilisearch' => [
        'timeout' => 3,
    ],

    'presence' => [
        'online_window_minutes' => 3,
        'guest_ttl_seconds' => 300,
    ],

    'file_scan' => [
        // Tope de archivos revisados por análisis (mantiene el scan acotado).
        'max_books' => env('HEALTH_SCAN_MAX_BOOKS', 1000),
        // Resultado del análisis se conserva este tiempo.
        'result_ttl_days' => 30,
    ],

    'alerts' => [
        // Una alerta marcada como revisada se recuerda este tiempo.
        'ack_ttl_days' => 7,
        // Memoria de "primera vez vista" por alerta.
        'seen_ttl_days' => 30,
    ],
];

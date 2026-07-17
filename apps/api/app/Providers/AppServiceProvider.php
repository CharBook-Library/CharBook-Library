<?php

namespace App\Providers;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /** Cache key del heartbeat del worker de colas (lo lee el panel de salud). */
    public const WORKER_HEARTBEAT_KEY = 'health:worker_heartbeat';

    /** Cache key actualizada por cada tick real del scheduler. */
    public const SCHEDULER_HEARTBEAT_KEY = 'health:scheduler_heartbeat';

    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Heartbeat del worker de colas: Queue::looping se dispara en cada
        // iteración del loop del worker (incluso sin jobs), así el panel de
        // salud sabe si hay un worker VIVO y no solo si hay jobs fallidos.
        // Escritura perezosa (máx. 1 vez cada 30 s) para no castigar la cache.
        Queue::looping(function () {
            try {
                $last = (int) Cache::get(self::WORKER_HEARTBEAT_KEY, 0);
                if (now()->timestamp - $last > 30) {
                    Cache::put(self::WORKER_HEARTBEAT_KEY, now()->timestamp, 3600);
                }
            } catch (\Throwable) {
                // El monitoreo jamás debe tumbar al worker.
            }
        });
    }
}

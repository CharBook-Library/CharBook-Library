<?php

use Illuminate\Foundation\Inspiring;
use App\Providers\AppServiceProvider;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Cada schedule:run real deja una senal para detectar cron/timer detenidos.
Schedule::call(function (): void {
    Cache::put(AppServiceProvider::SCHEDULER_HEARTBEAT_KEY, now()->timestamp, 3600);
})->name('charbook:scheduler-heartbeat')->everyMinute()->withoutOverlapping();

// ===== Limpieza automática del centro de notificaciones =====
// Cada noche a las 3:00 AM borra:
//   - notificaciones LEÍDAS de más de 30 días
//   - notificaciones SIN LEER de más de 60 días
Schedule::command('notifications:purge')
    ->dailyAt('03:00')
    ->withoutOverlapping()
    ->runInBackground();

// ===== Salud del sistema =====
// Análisis diario de integridad de archivos (EPUB/PDF/portadas). El panel
// de salud muestra el resultado del último análisis con su fecha.
Schedule::command('charbook:scan-files')
    ->dailyAt('05:00')
    ->withoutOverlapping()
    ->runInBackground();

// ===== Backups cifrados =====
// Desactivados por defecto. En produccion requieren BACKUP_ENABLED y
// BACKUP_SCHEDULE_ENABLED, PostgreSQL, bucket privado y clave dedicada.
Schedule::command('charbook:backup --execute --scheduled')
    ->dailyAt((string) config('backup.daily_at', '03:30'))
    ->when(fn () => (bool) config('backup.schedule_enabled'))
    ->withoutOverlapping(360)
    ->onOneServer()
    ->runInBackground();

Schedule::command('charbook:backup-prune --execute --scheduled')
    ->dailyAt((string) config('backup.prune_at', '04:30'))
    ->when(fn () => (bool) config('backup.schedule_enabled'))
    ->withoutOverlapping(120)
    ->onOneServer()
    ->runInBackground();

// ===== Monetización =====
// Libera Creator Coins cuya retención antifraude venció (pending → available)
Schedule::command('charbook:release-creator-holds')
    ->hourly()
    ->withoutOverlapping()
    ->runInBackground();

// Creator Fund del mes anterior, el día 2 de cada mes a las 4:00
Schedule::command('charbook:creator-fund ' . now()->subMonth()->format('Y-m'))
    ->monthlyOn(2, '04:00')
    ->withoutOverlapping()
    ->runInBackground();

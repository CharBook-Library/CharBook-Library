<?php

namespace App\Console\Commands;

use App\Support\LoadTestEnvironment;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class CleanLoadTestData extends Command
{
    protected $signature = 'charbook:loadtest-clean
        {--force : Ejecuta sin interacción; requiere confirmación exacta}
        {--confirm= : Confirmación exacta CLEAN_CHARBOOK_LOADTEST}';

    protected $description = 'Vacía datos de aplicación únicamente en charbook_loadtest y conserva migraciones';

    public function handle(LoadTestEnvironment $environment): int
    {
        try {
            $database = $environment->assertSafe();
            $environment->assertExternalServicesDisabled();
        } catch (RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $target = $environment->targetSummary($database);
        $this->table(['APP_ENV', 'Driver', 'Host', 'Puerto', 'Base'], [[
            $target['environment'],
            $target['driver'],
            $target['host'],
            $target['port'],
            $target['database'],
        ]]);

        if ($this->option('force') && $this->option('confirm') !== 'CLEAN_CHARBOOK_LOADTEST') {
            $this->error('Limpieza cancelada: falta --confirm=CLEAN_CHARBOOK_LOADTEST.');

            return self::FAILURE;
        }
        if (! $this->option('force') && ! $this->confirm("¿Vaciar los datos de aplicación de {$database}?")) {
            $this->info('Operación cancelada.');

            return self::SUCCESS;
        }

        $tables = collect(DB::select(
            "select tablename from pg_tables where schemaname = current_schema() and tablename <> 'migrations'"
        ))
            ->pluck('tablename')
            ->filter(fn ($table) => is_string($table) && $table !== '')
            ->values();

        if ($tables->isNotEmpty()) {
            $quoted = $tables
                ->map(fn (string $table) => '"' . str_replace('"', '""', $table) . '"')
                ->implode(', ');
            DB::statement("TRUNCATE TABLE {$quoted} RESTART IDENTITY CASCADE");
        }

        Storage::disk('local')->deleteDirectory('loadtest');
        $this->info("Datos loadtest eliminados de {$database}; la tabla migrations se conservó.");

        return self::SUCCESS;
    }
}

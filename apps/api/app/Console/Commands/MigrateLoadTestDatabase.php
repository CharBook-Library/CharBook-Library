<?php

namespace App\Console\Commands;

use App\Support\LoadTestEnvironment;
use Illuminate\Console\Command;
use RuntimeException;

class MigrateLoadTestDatabase extends Command
{
    protected $signature = 'charbook:loadtest-migrate
        {--force : Ejecuta sin interacción; requiere confirmación exacta}
        {--confirm= : Confirmación exacta MIGRATE_CHARBOOK_LOADTEST}';

    protected $description = 'Ejecuta migraciones únicamente en la base PostgreSQL charbook_loadtest';

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

        if ($this->option('force') && $this->option('confirm') !== 'MIGRATE_CHARBOOK_LOADTEST') {
            $this->error('Migracion cancelada: falta --confirm=MIGRATE_CHARBOOK_LOADTEST.');

            return self::FAILURE;
        }
        if (! $this->option('force') && ! $this->confirm("¿Ejecutar migraciones en {$database}?")) {
            $this->info('Operación cancelada.');

            return self::SUCCESS;
        }

        return $this->call('migrate', ['--force' => true]);
    }
}

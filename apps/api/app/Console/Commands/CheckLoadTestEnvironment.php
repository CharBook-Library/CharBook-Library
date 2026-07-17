<?php

namespace App\Console\Commands;

use App\Support\LoadTestEnvironment;
use Illuminate\Console\Command;
use RuntimeException;

class CheckLoadTestEnvironment extends Command
{
    protected $signature = 'charbook:loadtest-check';

    protected $description = 'Verifica las guardas y servicios deshabilitados del entorno loadtest';

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
        $this->table(['Comprobación', 'Valor'], [
            ['APP_ENV', $target['environment']],
            ['Driver', $target['driver']],
            ['Host', $target['host']],
            ['Puerto', $target['port']],
            ['Base', $target['database']],
            ['Servicios externos', 'deshabilitados'],
        ]);
        $this->info('Entorno loadtest aprobado para operaciones aisladas.');

        return self::SUCCESS;
    }
}

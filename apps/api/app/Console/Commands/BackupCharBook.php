<?php

namespace App\Console\Commands;

use App\Services\Backups\BackupService;
use App\Services\Backups\PostgresBackup;
use App\Support\BackupEnvironment;
use Illuminate\Console\Command;
use RuntimeException;

class BackupCharBook extends Command
{
    protected $signature = 'charbook:backup
        {--execute : Crea y sube el backup cifrado}
        {--scheduled : Ejecucion no interactiva desde el scheduler}
        {--confirm= : Confirmacion exacta BACKUP_CHARBOOK para ejecucion manual}';

    protected $description = 'Valida o crea un backup cifrado de PostgreSQL y archivos de CharBook';

    public function handle(
        BackupEnvironment $environment,
        PostgresBackup $postgres,
        BackupService $backups
    ): int {
        $errors = $environment->diagnostics();
        if ($errors === []) {
            try {
                $postgres->assertBinariesAvailable();
            } catch (RuntimeException $e) {
                $errors[] = $e->getMessage();
            }
        }

        if (! $this->option('execute')) {
            $this->info('Dry-run de backup: no se escribieron datos.');
            if ($errors !== []) {
                foreach ($errors as $error) {
                    $this->warn($error);
                }

                return self::FAILURE;
            }
            $this->info('Configuracion y herramientas listas para una prueba en staging.');

            return self::SUCCESS;
        }

        if ($errors !== []) {
            foreach ($errors as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        if ($this->option('scheduled') && ! config('backup.schedule_enabled')) {
            $this->error('BACKUP_SCHEDULE_ENABLED debe ser true para ejecuciones programadas.');

            return self::FAILURE;
        }

        if (! $this->option('scheduled')
            && $this->option('confirm') !== 'BACKUP_CHARBOOK') {
            $this->error('Ejecucion cancelada: usa --confirm=BACKUP_CHARBOOK.');

            return self::FAILURE;
        }

        try {
            $result = $backups->create();
        } catch (\Throwable $e) {
            $this->error('El backup fallo. Revisa el log y la alerta de auditoria.');

            return self::FAILURE;
        }

        $this->info('Backup cifrado, subido y verificado.');
        $this->line('Ruta: '.$result['path']);
        $this->line('Archivos: '.$result['files'].'; bytes cifrados: '.$result['bytes']);

        return self::SUCCESS;
    }
}

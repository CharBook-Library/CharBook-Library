<?php

namespace App\Console\Commands;

use App\Services\Backups\BackupService;
use App\Support\BackupEnvironment;
use Illuminate\Console\Command;
use RuntimeException;

class RestoreCharBookBackup extends Command
{
    protected $signature = 'charbook:backup-restore
        {path : Ruta .cbk dentro de BACKUP_DISK}
        {--execute : Restaura la base aislada charbook_restoretest}
        {--confirm= : Confirmacion exacta RESTORE_CHARBOOK_RESTORETEST}';

    protected $description = 'Verifica un backup o restaura exclusivamente la base aislada de restore';

    public function handle(BackupEnvironment $environment, BackupService $backups): int
    {
        $path = (string) $this->argument('path');
        if (! $this->option('execute')) {
            return $this->call('charbook:backup-verify', ['path' => $path]);
        }

        try {
            $database = $environment->assertRestoreExecutionIsSafe();
        } catch (RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        if ($this->option('confirm') !== 'RESTORE_CHARBOOK_RESTORETEST') {
            $this->error('Restauracion cancelada: falta la confirmacion exacta.');

            return self::FAILURE;
        }

        $this->warn('Base aislada que sera reemplazada: '.$database);
        try {
            $backups->restoreDatabase($path);
        } catch (\Throwable $e) {
            $this->error('La restauracion fallo. Revisa el log operativo.');

            return self::FAILURE;
        }

        $this->info('Restauracion completada en charbook_restoretest.');

        return self::SUCCESS;
    }
}

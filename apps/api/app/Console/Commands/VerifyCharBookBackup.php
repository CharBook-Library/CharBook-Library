<?php

namespace App\Console\Commands;

use App\Services\Backups\BackupService;
use Illuminate\Console\Command;

class VerifyCharBookBackup extends Command
{
    protected $signature = 'charbook:backup-verify {path : Ruta .cbk dentro de BACKUP_DISK}';

    protected $description = 'Descarga, descifra y verifica un backup sin restaurar datos';

    public function handle(BackupService $backups): int
    {
        try {
            $result = $backups->verifyRemote((string) $this->argument('path'));
        } catch (\Throwable $e) {
            $this->error('El backup no supero la verificacion de integridad.');

            return self::FAILURE;
        }

        $this->info('Backup integro. No se restauraron datos.');
        $this->line('Creado: '.$result['created_at'].'; archivos: '.$result['files']);

        return self::SUCCESS;
    }
}

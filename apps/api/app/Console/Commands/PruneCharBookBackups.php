<?php

namespace App\Console\Commands;

use App\Services\Backups\BackupService;
use Illuminate\Console\Command;

class PruneCharBookBackups extends Command
{
    protected $signature = 'charbook:backup-prune
        {--execute : Elimina backups que superaron la retencion}
        {--scheduled : Ejecucion no interactiva desde el scheduler}
        {--confirm= : Confirmacion exacta PRUNE_CHARBOOK_BACKUPS}';

    protected $description = 'Lista o elimina backups cifrados vencidos segun la retencion';

    public function handle(BackupService $backups): int
    {
        if (! $this->option('execute')) {
            try {
                $expired = $backups->expiredBackups();
            } catch (\Throwable $e) {
                $this->error('No se pudo consultar la retencion del destino de backups.');

                return self::FAILURE;
            }
            $this->info('Dry-run de retencion: '.count($expired).' backup(s) vencido(s).');

            return self::SUCCESS;
        }

        if ($this->option('scheduled') && ! config('backup.schedule_enabled')) {
            $this->error('BACKUP_SCHEDULE_ENABLED debe ser true.');

            return self::FAILURE;
        }
        if (! $this->option('scheduled')
            && $this->option('confirm') !== 'PRUNE_CHARBOOK_BACKUPS') {
            $this->error('Limpieza cancelada: falta la confirmacion exacta.');

            return self::FAILURE;
        }

        try {
            $deleted = $backups->pruneExpired();
        } catch (\Throwable $e) {
            $this->error('La limpieza de retencion fallo.');

            return self::FAILURE;
        }

        $this->info("Se eliminaron {$deleted} backup(s) vencido(s).");

        return self::SUCCESS;
    }
}

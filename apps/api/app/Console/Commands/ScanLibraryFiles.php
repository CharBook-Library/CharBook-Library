<?php

namespace App\Console\Commands;

use App\Services\Health\FileIntegrityScanner;
use Illuminate\Console\Command;

class ScanLibraryFiles extends Command
{
    protected $signature = 'charbook:scan-files';

    protected $description = 'Analiza la integridad de los archivos de la biblioteca (EPUB/PDF/portadas) y persiste el resultado para el panel de salud';

    public function handle(FileIntegrityScanner $scanner): int
    {
        $result = $scanner->scan();

        $this->info(sprintf(
            'Análisis completado en %d ms: %d archivos revisados, %d problema(s).',
            $result['duration_ms'],
            $result['checked_files'],
            $result['issues_total'],
        ));

        foreach ($result['counts_by_type'] as $type => $count) {
            if ($count > 0) {
                $this->line("  - {$type}: {$count}");
            }
        }

        return self::SUCCESS;
    }
}

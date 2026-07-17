<?php

namespace App\Services\Health;

use App\Models\Book;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

/**
 * Análisis de integridad de archivos de la biblioteca.
 *
 * No basta con que un archivo exista: un EPUB debe ser un ZIP válido con
 * su container.xml y un PDF debe tener cabecera %PDF-. El análisis es
 * acotado (config health.file_scan.max_books) y sus resultados se
 * persisten en cache con timestamp para que el panel muestre el estado
 * del ÚLTIMO análisis sin re-escanear el disco en cada refresh.
 */
class FileIntegrityScanner
{
    public const RESULT_CACHE_KEY = 'health:file_integrity';

    /** Tipos de problema que reporta el análisis. */
    public const ISSUE_TYPES = [
        'archivo_faltante',      // file_path registrado pero no existe en disco
        'epub_invalido',         // existe pero no es un EPUB legible
        'pdf_ilegible',          // existe pero no tiene cabecera PDF
        'portada_faltante',      // cover_path registrado pero no existe
        'publicado_sin_archivo', // libro_completo publicado sin archivo ni URL
    ];

    /**
     * Ejecuta el análisis completo y persiste el resultado.
     */
    public function scan(): array
    {
        $t0 = microtime(true);
        $maxBooks = (int) config('health.file_scan.max_books', 1000);
        $disk = Storage::disk('public');

        $issues = [];
        $checkedFiles = 0;
        $deepCheckedFiles = 0;
        $remoteFiles = 0;
        $remoteCovers = 0;
        $remoteChecksFailed = 0;

        // ── 1) Archivos principales locales: existencia + validez real ──
        $withFiles = Book::query()
            ->whereNotNull('file_path')
            ->orderByDesc('updated_at')
            ->limit($maxBooks)
            ->get(['id', 'title', 'slug', 'file_path', 'creator_id']);

        foreach ($withFiles as $b) {
            $checkedFiles++;
            $location = $this->locate($b->file_path, 'r2_books');
            if ($location === 'missing') {
                $issues[] = $this->issue($b, 'archivo_faltante', $b->file_path);
                continue;
            }
            if ($location === 'unavailable') {
                $remoteChecksFailed++;
                continue;
            }
            if ($location === 'remote') {
                $remoteFiles++;
                continue;
            }

            $ext = strtolower(pathinfo($b->file_path, PATHINFO_EXTENSION));
            $absolute = $disk->path($b->file_path);
            $deepCheckedFiles++;

            if ($ext === 'epub' && ! $this->isValidEpub($absolute)) {
                $issues[] = $this->issue($b, 'epub_invalido', $b->file_path);
            } elseif ($ext === 'pdf' && ! $this->isReadablePdf($absolute)) {
                $issues[] = $this->issue($b, 'pdf_ilegible', $b->file_path);
            }
        }

        // ── 2) Portadas locales registradas ──
        $withCovers = Book::query()
            ->whereNotNull('cover_path')
            ->orderByDesc('updated_at')
            ->limit($maxBooks)
            ->get(['id', 'title', 'slug', 'cover_path', 'creator_id']);

        foreach ($withCovers as $b) {
            $checkedFiles++;
            $location = $this->locate($b->cover_path, 'r2_covers');
            if ($location === 'missing') {
                $issues[] = $this->issue($b, 'portada_faltante', $b->cover_path);
            } elseif ($location === 'unavailable') {
                $remoteChecksFailed++;
            } elseif ($location === 'remote') {
                $remoteCovers++;
            }
        }

        // ── 3) Libros completos publicados sin NINGÚN archivo ──
        Book::query()
            ->where('is_published', true)
            ->where('work_format', 'libro_completo')
            ->whereNull('file_path')
            ->whereNull('file_url')
            ->limit(200)
            ->get(['id', 'title', 'slug', 'creator_id'])
            ->each(function (Book $b) use (&$issues, &$checkedFiles) {
                $checkedFiles++;
                $issues[] = $this->issue($b, 'publicado_sin_archivo', null);
            });

        // ── 4) Distribución de disco por carpeta (medida real) ──
        $breakdown = $this->storageBreakdown();

        $countsByType = array_fill_keys(self::ISSUE_TYPES, 0);
        foreach ($issues as $i) {
            $countsByType[$i['type']]++;
        }

        $result = [
            'scanned_at' => now()->toIso8601String(),
            'duration_ms' => (int) round((microtime(true) - $t0) * 1000),
            'checked_books' => $withFiles->count(),
            'checked_files' => $checkedFiles,
            'deep_checked_files' => $deepCheckedFiles,
            'remote_files_verified' => $remoteFiles,
            'remote_covers_verified' => $remoteCovers,
            'remote_checks_failed' => $remoteChecksFailed,
            'warnings' => $remoteChecksFailed > 0
                ? ['No se pudo verificar R2 por completo; esos objetos no se marcaron como faltantes.']
                : [],
            'issues' => array_slice($issues, 0, 100),
            'issues_total' => count($issues),
            'counts_by_type' => $countsByType,
            'storage_breakdown' => $breakdown,
        ];

        Cache::put(
            self::RESULT_CACHE_KEY,
            $result,
            now()->addDays((int) config('health.file_scan.result_ttl_days', 30))
        );

        return $result;
    }

    /** Último resultado persistido, o null si nunca se analizó. */
    public function lastResult(): ?array
    {
        return Cache::get(self::RESULT_CACHE_KEY);
    }

    // ────────────────────────────────────────────────────────
    // Validadores
    // ────────────────────────────────────────────────────────

    /**
     * EPUB válido = ZIP que abre correctamente y contiene
     * META-INF/container.xml (lo mínimo que exige el estándar).
     */
    private function isValidEpub(string $absolutePath): bool
    {
        try {
            $zip = new \ZipArchive();
            if ($zip->open($absolutePath, \ZipArchive::RDONLY) !== true) {
                return false;
            }
            $hasContainer = $zip->locateName('META-INF/container.xml') !== false;
            $zip->close();

            return $hasContainer;
        } catch (\Throwable) {
            return false;
        }
    }

    /** PDF legible = empieza con la cabecera %PDF-. */
    private function isReadablePdf(string $absolutePath): bool
    {
        try {
            $fh = @fopen($absolutePath, 'rb');
            if (! $fh) {
                return false;
            }
            $head = fread($fh, 5);
            fclose($fh);

            return $head === '%PDF-';
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Localiza una ruta sin confundir archivos R2 con archivos locales
     * ausentes. Los objetos remotos solo se validan por existencia: para una
     * inspección profunda habría que descargarlos de forma controlada.
     *
     * @return 'local'|'remote'|'missing'|'unavailable'
     */
    private function locate(string $path, string $remoteDisk): string
    {
        if (Storage::disk('public')->exists($path)) {
            return 'local';
        }

        if (! filled(config("filesystems.disks.{$remoteDisk}.bucket"))) {
            return 'missing';
        }

        try {
            return Storage::disk($remoteDisk)->exists($path) ? 'remote' : 'missing';
        } catch (\Throwable) {
            return 'unavailable';
        }
    }

    /**
     * Tamaño real de cada carpeta de almacenamiento (MB). Se mide en el
     * análisis (no en cada refresh del panel) porque recorre el disco.
     */
    private function storageBreakdown(): array
    {
        $sizes = [];

        $publicRoot = Storage::disk('public')->path('');
        foreach (['books', 'covers', 'chapters', 'chapter-covers', 'pages'] as $dir) {
            $path = $publicRoot . DIRECTORY_SEPARATOR . $dir;
            if (is_dir($path)) {
                $sizes[$dir] = $this->dirSizeMb($path);
            }
        }

        $logsPath = storage_path('logs');
        if (is_dir($logsPath)) {
            $sizes['logs'] = $this->dirSizeMb($logsPath);
        }

        return $sizes;
    }

    private function dirSizeMb(string $path): float
    {
        $bytes = 0;
        try {
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS)
            );
            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $bytes += $file->getSize();
                }
            }
        } catch (\Throwable) {
            // Carpeta ilegible → devolvemos lo acumulado hasta el fallo.
        }

        return round($bytes / 1048576, 1);
    }

    private function issue(Book $b, string $type, ?string $detail): array
    {
        return [
            'id' => $b->id,
            'title' => $b->title,
            'slug' => $b->slug,
            'is_creator_work' => $b->creator_id !== null,
            'type' => $type,
            'detail' => $detail,
        ];
    }
}

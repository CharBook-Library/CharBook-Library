<?php

namespace App\Services\Backups;

use Illuminate\Support\Facades\Storage;
use RuntimeException;
use ZipArchive;

class BackupArchive
{
    public function build(string $databaseDump, string $destination): array
    {
        if (! is_file($databaseDump)) {
            throw new RuntimeException('No existe el volcado PostgreSQL temporal.');
        }

        $zip = new ZipArchive();
        if ($zip->open($destination, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('No se pudo crear el archivo ZIP de backup.');
        }

        $temporaryFiles = [];
        $maxFiles = (int) config('backup.limits.max_files');
        $maxFileBytes = (int) config('backup.limits.max_file_bytes');
        $maxTotalBytes = (int) config('backup.limits.max_total_bytes');
        $totalBytes = (int) filesize($databaseDump);
        if ($totalBytes < 1 || $totalBytes > $maxFileBytes) {
            $zip->close();
            @unlink($destination);
            throw new RuntimeException('El volcado PostgreSQL supera el limite permitido.');
        }
        $manifest = [
            'format' => 1,
            'created_at' => now()->toIso8601String(),
            'application' => (string) config('app.name'),
            'database' => [
                'format' => 'postgresql-custom',
                'path' => 'database/database.dump',
                'bytes' => filesize($databaseDump),
                'sha256' => hash_file('sha256', $databaseDump),
            ],
            'files' => [],
            'excluded_files' => 0,
            'configuration' => [
                'app_locale' => config('app.locale'),
                'queue_driver' => config('queue.default'),
                'cache_driver' => config('cache.default'),
                'filesystem_driver' => config('filesystems.default'),
            ],
        ];

        try {
            if (! $zip->addFile($databaseDump, 'database/database.dump')) {
                throw new RuntimeException('No se pudo agregar el volcado PostgreSQL al backup.');
            }

            foreach ((array) config('backup.source_disks', []) as $disk) {
                if (! is_string($disk)
                    || ! preg_match('/^[A-Za-z0-9_-]+$/', $disk)
                    || ! config("filesystems.disks.{$disk}")) {
                    throw new RuntimeException('BACKUP_SOURCE_DISKS contiene un disco no configurado.');
                }

                foreach (Storage::disk($disk)->allFiles() as $path) {
                    $path = $this->safeRelativePath((string) $path);
                    if ($this->isSensitiveOrTemporary($path)) {
                        $manifest['excluded_files']++;
                        continue;
                    }
                    if (count($manifest['files']) >= $maxFiles) {
                        throw new RuntimeException('El backup supera la cantidad maxima de archivos.');
                    }

                    $declaredSize = (int) Storage::disk($disk)->size($path);
                    if ($declaredSize < 0 || $declaredSize > $maxFileBytes) {
                        throw new RuntimeException("Un archivo del disco {$disk} supera el limite permitido.");
                    }
                    if ($totalBytes + $declaredSize > $maxTotalBytes) {
                        throw new RuntimeException('El contenido del backup supera el limite total permitido.');
                    }
                    $stream = Storage::disk($disk)->readStream($path);
                    if (! is_resource($stream)) {
                        throw new RuntimeException("No se pudo leer un archivo del disco {$disk}.");
                    }

                    $temporary = dirname($destination).DIRECTORY_SEPARATOR
                        .'backup-file-'.bin2hex(random_bytes(12));
                    $output = fopen($temporary, 'wb');
                    if (! is_resource($output)) {
                        fclose($stream);
                        throw new RuntimeException('No se pudo crear un archivo temporal de backup.');
                    }
                    @chmod($temporary, 0600);

                    try {
                        if (stream_copy_to_stream($stream, $output) === false) {
                            throw new RuntimeException("No se pudo copiar un archivo del disco {$disk}.");
                        }
                    } finally {
                        fclose($stream);
                        fclose($output);
                    }

                    $temporaryFiles[] = $temporary;
                    $actualSize = (int) filesize($temporary);
                    if ($actualSize !== $declaredSize || $actualSize > $maxFileBytes) {
                        throw new RuntimeException("El tamano de un archivo del disco {$disk} cambio durante el backup.");
                    }
                    $totalBytes += $actualSize;
                    $entry = "files/{$disk}/{$path}";
                    if (! $zip->addFile($temporary, $entry)) {
                        throw new RuntimeException("No se pudo agregar un archivo del disco {$disk}.");
                    }

                    $manifest['files'][] = [
                        'disk' => $disk,
                        'path' => $path,
                        'entry' => $entry,
                        'bytes' => $actualSize,
                        'sha256' => hash_file('sha256', $temporary),
                    ];
                }
            }

            $manifestJson = json_encode(
                $manifest,
                JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
            );
            if (strlen($manifestJson) > (int) config('backup.limits.max_manifest_bytes')) {
                throw new RuntimeException('El manifiesto del backup supera el limite permitido.');
            }
            if (! $zip->addFromString('manifest.json', $manifestJson)) {
                throw new RuntimeException('No se pudo escribir el manifiesto del backup.');
            }

            if (! $zip->close()) {
                throw new RuntimeException('No se pudo finalizar el archivo ZIP de backup.');
            }
        } catch (\Throwable $e) {
            $zip->close();
            @unlink($destination);
            throw $e;
        } finally {
            foreach ($temporaryFiles as $temporary) {
                @unlink($temporary);
            }
        }

        @chmod($destination, 0600);
        $archiveSize = filesize($destination);
        if ($archiveSize === false
            || $archiveSize > (int) config('backup.limits.max_archive_bytes')) {
            @unlink($destination);
            throw new RuntimeException('El ZIP final supera el limite permitido.');
        }

        $this->verify($destination);

        return $manifest;
    }

    public function verify(string $archive): array
    {
        $archiveSize = filesize($archive);
        if ($archiveSize === false
            || $archiveSize < 1
            || $archiveSize > (int) config('backup.limits.max_archive_bytes')) {
            throw new RuntimeException('El ZIP del backup supera el limite permitido.');
        }

        $zip = new ZipArchive();
        if ($zip->open($archive, ZipArchive::CHECKCONS) !== true) {
            throw new RuntimeException('El ZIP del backup esta corrupto.');
        }

        try {
            $maxFiles = (int) config('backup.limits.max_files');
            $maxFileBytes = (int) config('backup.limits.max_file_bytes');
            $maxTotalBytes = (int) config('backup.limits.max_total_bytes');
            if ($zip->numFiles < 2 || $zip->numFiles > $maxFiles + 2) {
                throw new RuntimeException('Cantidad de entradas invalida en el backup.');
            }

            $totalBytes = 0;
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = (string) $zip->getNameIndex($i);
                $this->safeRelativePath($name);
                $stat = $zip->statIndex($i);
                $bytes = (int) ($stat['size'] ?? -1);
                if ((int) ($stat['encryption_method'] ?? 0) !== 0) {
                    throw new RuntimeException('El ZIP contiene entradas cifradas no verificables.');
                }
                if ($bytes < 0 || $bytes > $maxFileBytes) {
                    throw new RuntimeException('Una entrada del backup supera el limite permitido.');
                }
                $totalBytes += $bytes;
                if ($totalBytes > $maxTotalBytes) {
                    throw new RuntimeException('El contenido expandido del backup supera el limite total.');
                }
            }

            $manifestStat = $zip->statName('manifest.json');
            if (! is_array($manifestStat)
                || (int) $manifestStat['size'] > (int) config('backup.limits.max_manifest_bytes')) {
                throw new RuntimeException('El backup no contiene un manifiesto acotado.');
            }
            $manifestJson = $zip->getFromName('manifest.json');
            if (! is_string($manifestJson)) {
                throw new RuntimeException('El backup no contiene un manifiesto valido.');
            }
            $manifest = json_decode($manifestJson, true, flags: JSON_THROW_ON_ERROR);
            if (($manifest['format'] ?? null) !== 1 || ! is_array($manifest['files'] ?? null)) {
                throw new RuntimeException('Version de manifiesto no compatible.');
            }

            if (count($manifest['files']) > $maxFiles
                || count($manifest['files']) + 2 !== $zip->numFiles) {
                throw new RuntimeException('El manifiesto no coincide con las entradas del backup.');
            }

            $expectedEntries = ['manifest.json'];
            $databaseEntry = (string) ($manifest['database']['path'] ?? '');
            $expectedEntries[] = $databaseEntry;
            $this->assertEntryHash(
                $zip,
                $databaseEntry,
                (string) ($manifest['database']['sha256'] ?? ''),
                (int) ($manifest['database']['bytes'] ?? -1)
            );

            foreach ($manifest['files'] as $file) {
                if (! is_array($file)) {
                    throw new RuntimeException('Entrada invalida en el manifiesto.');
                }
                $this->assertEntryHash(
                    $zip,
                    (string) ($file['entry'] ?? ''),
                    (string) ($file['sha256'] ?? ''),
                    (int) ($file['bytes'] ?? -1)
                );
                $expectedEntries[] = (string) $file['entry'];
            }

            if (count(array_unique($expectedEntries)) !== count($expectedEntries)) {
                throw new RuntimeException('El manifiesto contiene entradas duplicadas.');
            }
            sort($expectedEntries);
            $actualEntries = [];
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $actualEntries[] = (string) $zip->getNameIndex($i);
            }
            sort($actualEntries);
            if ($actualEntries !== $expectedEntries) {
                throw new RuntimeException('El ZIP contiene entradas no declaradas.');
            }

            return $manifest;
        } finally {
            $zip->close();
        }
    }

    public function extractDatabaseDump(string $archive, string $destination): void
    {
        $manifest = $this->verify($archive);
        $entry = (string) $manifest['database']['path'];
        $zip = new ZipArchive();
        if ($zip->open($archive) !== true) {
            throw new RuntimeException('No se pudo abrir el backup verificado.');
        }

        $stream = $zip->getStream($entry);
        $output = fopen($destination, 'wb');
        if (! is_resource($stream) || ! is_resource($output)) {
            if (is_resource($stream)) {
                fclose($stream);
            }
            if (is_resource($output)) {
                fclose($output);
            }
            $zip->close();
            throw new RuntimeException('No se pudo extraer el volcado PostgreSQL.');
        }
        @chmod($destination, 0600);

        try {
            if (stream_copy_to_stream($stream, $output) === false) {
                throw new RuntimeException('No se pudo extraer el volcado PostgreSQL.');
            }
        } finally {
            fclose($stream);
            fclose($output);
            $zip->close();
        }
    }

    private function assertEntryHash(
        ZipArchive $zip,
        string $entry,
        string $expected,
        int $expectedBytes
    ): void
    {
        $this->safeRelativePath($entry);
        if (! preg_match('/^[a-f0-9]{64}$/', $expected)) {
            throw new RuntimeException('Hash invalido en el manifiesto del backup.');
        }
        $stat = $zip->statName($entry);
        if (! is_array($stat) || (int) $stat['size'] !== $expectedBytes || $expectedBytes < 0) {
            throw new RuntimeException("El tamano de {$entry} no coincide con el manifiesto.");
        }

        $stream = $zip->getStream($entry);
        if (! is_resource($stream)) {
            throw new RuntimeException("Falta la entrada {$entry} en el backup.");
        }
        try {
            $hash = hash_init('sha256');
            hash_update_stream($hash, $stream);
            if (! hash_equals($expected, hash_final($hash))) {
                throw new RuntimeException("La entrada {$entry} no supera la verificacion de integridad.");
            }
        } finally {
            fclose($stream);
        }
    }

    private function safeRelativePath(string $path): string
    {
        $path = str_replace('\\', '/', trim($path));
        $decoded = rawurldecode($path);
        if (
            $path === ''
            || str_starts_with($path, '/')
            || preg_match('/^[A-Za-z]:/', $path)
            || in_array('..', explode('/', $path), true)
            || in_array('..', explode('/', $decoded), true)
            || str_contains($path, "\0")
            || str_contains($decoded, "\0")
            || strlen($path) > 2048
        ) {
            throw new RuntimeException('Ruta insegura detectada dentro del backup.');
        }

        return str_starts_with($path, './') ? substr($path, 2) : $path;
    }

    private function isSensitiveOrTemporary(string $path): bool
    {
        $basename = strtolower(basename($path));
        $segments = array_map('strtolower', explode('/', $path));

        return str_starts_with($basename, '.env')
            || str_ends_with($basename, '.key')
            || in_array('loadtest', $segments, true)
            || in_array('imports', $segments, true)
            || in_array('backup-temp', $segments, true);
    }
}

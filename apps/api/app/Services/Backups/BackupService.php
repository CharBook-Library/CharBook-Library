<?php

namespace App\Services\Backups;

use App\Services\AuditLogger;
use App\Support\BackupEnvironment;
use Illuminate\Contracts\Cache\Lock;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class BackupService
{
    public function __construct(
        private readonly BackupEnvironment $environment,
        private readonly PostgresBackup $postgres,
        private readonly BackupArchive $archive,
        private readonly BackupCipher $cipher,
    ) {}

    public function create(): array
    {
        $this->environment->assertBackupExecutionIsSafe();
        $lock = $this->operationLock();
        if (! $lock->get()) {
            throw new RuntimeException('Ya hay una operacion de backup o restore en curso.');
        }
        $temp = null;
        $remotePath = null;
        $remoteComplete = false;

        try {
            $this->postgres->assertBinariesAvailable();
            $temp = $this->temporaryDirectory();
            $dump = $temp.DIRECTORY_SEPARATOR.'database.dump';
            $zip = $temp.DIRECTORY_SEPARATOR.'charbook.zip';
            $encrypted = $temp.DIRECTORY_SEPARATOR.'charbook.cbk';
            $verification = $temp.DIRECTORY_SEPARATOR.'verification.zip';
            $this->postgres->dump($dump);
            $manifest = $this->archive->build($dump, $zip);
            $this->cipher->encrypt($zip, $encrypted, (string) config('backup.encryption_key'));

            // Verificacion local completa antes de tocar el almacenamiento remoto.
            $this->cipher->decrypt(
                $encrypted,
                $verification,
                (string) config('backup.encryption_key')
            );
            $this->archive->verify($verification);

            $sha256 = hash_file('sha256', $encrypted);
            $encryptedSize = filesize($encrypted);
            if ($sha256 === false || $encryptedSize === false
                || $encryptedSize > (int) config('backup.limits.max_encrypted_bytes')) {
                throw new RuntimeException('No se pudo calcular el hash del backup cifrado.');
            }
            $remotePath = $this->newRemotePath();
            $this->upload($encrypted, $remotePath);
            if (! Storage::disk((string) config('backup.disk'))->put(
                $remotePath.'.sha256',
                $sha256.'  '.basename($remotePath).PHP_EOL
            )) {
                throw new RuntimeException('No se pudo escribir el checksum remoto del backup.');
            }

            if (config('backup.verify_upload', true)) {
                $remoteHash = $this->hashRemote($remotePath);
                if (! hash_equals($sha256, $remoteHash)) {
                    throw new RuntimeException('El backup remoto no coincide con el archivo local.');
                }
            }
            $remoteComplete = true;

            $result = [
                'path' => $remotePath,
                'sha256' => $sha256,
                'bytes' => $encryptedSize,
                'files' => count($manifest['files']),
                'created_at' => $manifest['created_at'],
            ];
            AuditLogger::logSystem(
                'backup.completed',
                'backup',
                null,
                basename($remotePath),
                'Backup cifrado y verificado.',
                null,
                ['bytes' => $result['bytes'], 'files' => $result['files']]
            );

            return $result;
        } catch (\Throwable $e) {
            if (is_string($remotePath) && ! $remoteComplete) {
                try {
                    Storage::disk((string) config('backup.disk'))->delete([
                        $remotePath,
                        $remotePath.'.sha256',
                    ]);
                } catch (\Throwable) {
                    // La alerta principal conserva el fallo; no se registran rutas ni credenciales.
                }
            }
            Log::critical('El backup programado de CharBook fallo.', [
                'exception_class' => $e::class,
            ]);
            AuditLogger::logSystem(
                'backup.failed',
                'backup',
                null,
                null,
                'Fallo de backup: '.$e::class
            );
            throw $e;
        } finally {
            if (is_string($temp)) {
                $this->removeTemporaryDirectory($temp);
            }
            $lock->release();
        }
    }

    public function verifyRemote(string $path): array
    {
        $this->environment->assertRemoteReadIsSafe();
        $path = $this->assertRemotePath($path);
        $lock = $this->operationLock();
        if (! $lock->get()) {
            throw new RuntimeException('Ya hay una operacion de backup o restore en curso.');
        }
        $temp = null;

        try {
            $temp = $this->temporaryDirectory();
            $encrypted = $temp.DIRECTORY_SEPARATOR.'charbook.cbk';
            $zip = $temp.DIRECTORY_SEPARATOR.'charbook.zip';
            $encryptedHash = $this->downloadVerified($path, $encrypted);

            $this->cipher->decrypt($encrypted, $zip, (string) config('backup.encryption_key'));
            $manifest = $this->archive->verify($zip);

            return [
                'path' => $path,
                'sha256' => $encryptedHash,
                'files' => count($manifest['files']),
                'created_at' => $manifest['created_at'],
            ];
        } finally {
            if (is_string($temp)) {
                $this->removeTemporaryDirectory($temp);
            }
            $lock->release();
        }
    }

    public function restoreDatabase(string $path): void
    {
        $this->environment->assertRestoreExecutionIsSafe();
        $this->environment->assertRemoteReadIsSafe();
        $path = $this->assertRemotePath($path);
        $lock = $this->operationLock();
        if (! $lock->get()) {
            throw new RuntimeException('Ya hay una operacion de backup o restore en curso.');
        }
        $temp = null;

        try {
            $this->postgres->assertBinariesAvailable();
            $temp = $this->temporaryDirectory();
            $encrypted = $temp.DIRECTORY_SEPARATOR.'charbook.cbk';
            $zip = $temp.DIRECTORY_SEPARATOR.'charbook.zip';
            $dump = $temp.DIRECTORY_SEPARATOR.'database.dump';
            $this->downloadVerified($path, $encrypted);
            $this->cipher->decrypt($encrypted, $zip, (string) config('backup.encryption_key'));
            $this->archive->extractDatabaseDump($zip, $dump);
            $this->postgres->restore($dump);
            AuditLogger::logSystem(
                'backup.restore_completed',
                'backup',
                null,
                basename($path),
                'Restauracion ejecutada en la base aislada de restore.'
            );
        } catch (\Throwable $e) {
            Log::critical('La restauracion aislada de CharBook fallo.', [
                'exception_class' => $e::class,
            ]);
            AuditLogger::logSystem(
                'backup.restore_failed',
                'backup',
                null,
                null,
                'Fallo de restauracion: '.$e::class
            );
            throw $e;
        } finally {
            if (is_string($temp)) {
                $this->removeTemporaryDirectory($temp);
            }
            $lock->release();
        }
    }

    /** @return list<string> */
    public function expiredBackups(): array
    {
        $this->environment->assertBackupExecutionIsSafe();
        $disk = Storage::disk((string) config('backup.disk'));
        $prefix = $this->safePrefix();
        $cutoff = now()->subDays(max(1, (int) config('backup.retention_days', 30)))->timestamp;
        $expired = [];

        foreach ($disk->allFiles($prefix) as $path) {
            if (str_ends_with($path, '.cbk') && $disk->lastModified($path) < $cutoff) {
                try {
                    $expired[] = $this->assertRemotePath($path);
                } catch (RuntimeException) {
                    // Nunca borrar automaticamente una clave con nombre inesperado.
                }
            }
        }

        sort($expired);

        return $expired;
    }

    public function pruneExpired(): int
    {
        $this->environment->assertBackupExecutionIsSafe();
        $lock = $this->operationLock();
        if (! $lock->get()) {
            throw new RuntimeException('Ya hay una operacion de backup o restore en curso.');
        }

        try {
            $disk = Storage::disk((string) config('backup.disk'));
            $expired = $this->expiredBackups();

            foreach ($expired as $path) {
                $disk->delete([$path, $path.'.sha256']);
            }

            AuditLogger::logSystem(
                'backup.retention_pruned',
                'backup',
                null,
                null,
                'Retencion automatica de backups.',
                null,
                ['deleted' => count($expired)]
            );

            return count($expired);
        } finally {
            $lock->release();
        }
    }

    private function upload(string $local, string $path): void
    {
        $stream = fopen($local, 'rb');
        if (! is_resource($stream)) {
            throw new RuntimeException('No se pudo abrir el backup cifrado para subirlo.');
        }
        try {
            if (! Storage::disk((string) config('backup.disk'))->put($path, $stream)) {
                throw new RuntimeException('El destino remoto rechazo el backup.');
            }
        } finally {
            fclose($stream);
        }
    }

    private function download(string $path, string $local): void
    {
        $stream = Storage::disk((string) config('backup.disk'))->readStream($path);
        $output = fopen($local, 'wb');
        if (! is_resource($stream) || ! is_resource($output)) {
            if (is_resource($stream)) {
                fclose($stream);
            }
            if (is_resource($output)) {
                fclose($output);
            }
            throw new RuntimeException('No se pudo descargar el backup remoto.');
        }
        @chmod($local, 0600);
        try {
            if (stream_copy_to_stream($stream, $output) === false) {
                throw new RuntimeException('No se pudo copiar el backup remoto.');
            }
        } finally {
            fclose($stream);
            fclose($output);
        }
    }

    private function hashRemote(string $path): string
    {
        $stream = Storage::disk((string) config('backup.disk'))->readStream($path);
        if (! is_resource($stream)) {
            throw new RuntimeException('No se pudo verificar el backup remoto.');
        }
        try {
            $hash = hash_init('sha256');
            hash_update_stream($hash, $stream);

            return hash_final($hash);
        } finally {
            fclose($stream);
        }
    }

    private function newRemotePath(): string
    {
        $prefix = $this->safePrefix();

        return $this->assertRemotePath(
            $prefix.'/'.now()->format('Y/m/d').'/charbook-'
            .now()->format('Ymd-His').'-'.bin2hex(random_bytes(4)).'.cbk'
        );
    }

    private function assertRemotePath(string $path): string
    {
        $prefix = $this->safePrefix().'/';
        $normalized = str_replace('\\', '/', $path);
        $segments = explode('/', $normalized);
        if (
            ! str_starts_with($path, $prefix)
            || ! str_ends_with($path, '.cbk')
            || $normalized !== $path
            || rawurldecode($path) !== $path
            || ! preg_match('#^[A-Za-z0-9][A-Za-z0-9._/-]{1,1023}$#', $path)
            || str_contains($path, '//')
            || in_array('..', $segments, true)
            || in_array('.', $segments, true)
        ) {
            throw new RuntimeException('Ruta de backup remoto no permitida.');
        }

        return $path;
    }

    private function downloadVerified(string $path, string $local): string
    {
        $disk = Storage::disk((string) config('backup.disk'));
        $size = $disk->size($path);
        if ($size < 1 || $size > (int) config('backup.limits.max_encrypted_bytes')) {
            throw new RuntimeException('El backup remoto supera el limite permitido.');
        }
        if ($disk->size($path.'.sha256') > 256) {
            throw new RuntimeException('El archivo de checksum remoto es invalido.');
        }

        $this->download($path, $local);
        if (filesize($local) !== $size) {
            throw new RuntimeException('El tamano descargado no coincide con el remoto.');
        }

        $encryptedHash = hash_file('sha256', $local);
        $checksum = $disk->get($path.'.sha256');
        $expectedHash = strtok(trim($checksum), " \t");
        if (
            $encryptedHash === false
            || ! is_string($expectedHash)
            || ! preg_match('/^[a-f0-9]{64}$/', $expectedHash)
            || ! hash_equals($expectedHash, $encryptedHash)
        ) {
            throw new RuntimeException('El checksum remoto del backup no coincide.');
        }

        return $encryptedHash;
    }

    private function operationLock(): Lock
    {
        return Cache::lock(
            'charbook:backup:operation',
            max(
                (int) config('backup.process_timeout', 3600) + 600,
                (int) config('backup.lock_seconds', 21600)
            )
        );
    }

    private function safePrefix(): string
    {
        $prefix = trim((string) config('backup.path', 'charbook'), '/');
        if (! BackupEnvironment::isSafeRemotePrefix($prefix)) {
            throw new RuntimeException('BACKUP_PATH no es un prefijo remoto seguro.');
        }

        return $prefix;
    }

    private function temporaryDirectory(): string
    {
        $root = storage_path('framework/backup-temp');
        $path = $root.DIRECTORY_SEPARATOR.bin2hex(random_bytes(16));
        if (! is_dir($path) && ! mkdir($path, 0700, true) && ! is_dir($path)) {
            throw new RuntimeException('No se pudo crear el directorio temporal de backup.');
        }
        @chmod($path, 0700);

        return $path;
    }

    private function removeTemporaryDirectory(string $path): void
    {
        $root = realpath(storage_path('framework/backup-temp'));
        $resolved = realpath($path);
        if ($root === false || $resolved === false || ! str_starts_with($resolved, $root.DIRECTORY_SEPARATOR)) {
            return;
        }

        foreach (glob($resolved.DIRECTORY_SEPARATOR.'*') ?: [] as $file) {
            if (is_file($file)) {
                @unlink($file);
            }
        }
        @rmdir($resolved);
    }
}

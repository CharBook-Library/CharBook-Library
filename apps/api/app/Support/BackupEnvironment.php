<?php

namespace App\Support;

use App\Services\Backups\BackupCipher;
use RuntimeException;

class BackupEnvironment
{
    public function assertBackupExecutionIsSafe(): void
    {
        $errors = $this->diagnostics();

        if ($errors !== []) {
            throw new RuntimeException('Backup cancelado: '.implode(' ', $errors));
        }
    }

    /** @return list<string> */
    public function diagnostics(): array
    {
        $errors = $this->remoteReadDiagnostics();
        $environment = app()->environment();
        $allowed = (array) config('backup.allowed_environments', []);
        $disk = (string) config('backup.disk');

        if (! config('backup.enabled')) {
            $errors[] = 'BACKUP_ENABLED debe ser true.';
        }
        if (! in_array($environment, $allowed, true)) {
            $errors[] = 'APP_ENV no esta en BACKUP_ALLOWED_ENVIRONMENTS.';
        }
        if (config('database.default') !== 'pgsql') {
            $errors[] = 'DB_CONNECTION debe ser pgsql.';
        }
        $sources = (array) config('backup.source_disks', []);
        if ($sources === []) {
            $errors[] = 'BACKUP_SOURCE_DISKS no puede estar vacio.';
        }
        foreach ($sources as $source) {
            if (! is_string($source)
                || ! preg_match('/^[A-Za-z0-9_-]+$/', $source)
                || ! config("filesystems.disks.{$source}")) {
                $errors[] = 'BACKUP_SOURCE_DISKS contiene un disco no configurado o invalido.';
                continue;
            }
            if (hash_equals($disk, $source)) {
                $errors[] = 'BACKUP_DISK no puede incluirse en BACKUP_SOURCE_DISKS.';
            }
        }
        if (! in_array((string) config('cache.default'), ['database', 'redis'], true)) {
            $errors[] = 'CACHE_STORE debe ser database o redis para garantizar un lock compartido.';
        }
        if ((int) config('backup.retention_days') < 1) {
            $errors[] = 'BACKUP_RETENTION_DAYS debe ser mayor a cero.';
        }
        foreach ((array) config('backup.limits', []) as $limit) {
            if (! is_int($limit) || $limit < 1) {
                $errors[] = 'Todos los limites de backup deben ser enteros positivos.';
                break;
            }
        }

        return array_values(array_unique($errors));
    }

    public function assertRemoteReadIsSafe(): void
    {
        $errors = $this->remoteReadDiagnostics();
        if ($errors !== []) {
            throw new RuntimeException('Acceso a backup cancelado: '.implode(' ', $errors));
        }
    }

    public function assertRestoreExecutionIsSafe(): string
    {
        $environment = app()->environment();
        $driver = (string) config('database.default');
        $database = (string) config('database.connections.'.$driver.'.database');
        $expected = (string) config('backup.restore_database', 'charbook_restoretest');

        if (! self::matchesRestoreTarget($environment, $driver, $database, $expected)) {
            throw new RuntimeException(sprintf(
                'Restauracion cancelada: requiere APP_ENV=restore, PostgreSQL y DB_DATABASE=%s.',
                $expected
            ));
        }

        BackupCipher::decodeKey((string) config('backup.encryption_key'));

        return $database;
    }

    public static function matchesRestoreTarget(
        string $environment,
        string $driver,
        string $database,
        string $expected = 'charbook_restoretest'
    ): bool {
        return $environment === 'restore'
            && $driver === 'pgsql'
            && hash_equals($expected, $database);
    }

    public static function isSafeRemotePrefix(string $prefix): bool
    {
        $prefix = trim($prefix, '/');
        $segments = explode('/', $prefix);

        return $prefix !== ''
            && strlen($prefix) <= 255
            && preg_match('#^[A-Za-z0-9][A-Za-z0-9._/-]*$#', $prefix) === 1
            && ! str_contains($prefix, '//')
            && ! in_array('.', $segments, true)
            && ! in_array('..', $segments, true);
    }

    /** @return list<string> */
    private function remoteReadDiagnostics(): array
    {
        $errors = [];
        $disk = (string) config('backup.disk');
        $diskConfig = (array) config("filesystems.disks.{$disk}", []);

        if ($disk === '' || in_array($disk, ['local', 'public'], true) || $diskConfig === []) {
            $errors[] = 'BACKUP_DISK debe ser un almacenamiento remoto privado dedicado.';
        } elseif (($diskConfig['driver'] ?? null) !== 's3'
            || ($diskConfig['visibility'] ?? null) !== 'private'
            || ($diskConfig['throw'] ?? null) !== true) {
            $errors[] = 'BACKUP_DISK debe usar S3 privado y errores estrictos.';
        }
        if (($diskConfig['driver'] ?? null) === 's3' && blank($diskConfig['bucket'] ?? null)) {
            $errors[] = 'BACKUP_S3_BUCKET es obligatorio para el destino S3/R2.';
        }
        if (! self::isSafeRemotePrefix((string) config('backup.path'))) {
            $errors[] = 'BACKUP_PATH debe ser un prefijo remoto relativo y seguro.';
        }

        try {
            BackupCipher::decodeKey((string) config('backup.encryption_key'));
        } catch (RuntimeException $e) {
            $errors[] = $e->getMessage();
        }

        return $errors;
    }
}

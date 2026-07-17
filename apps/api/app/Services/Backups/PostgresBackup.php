<?php

namespace App\Services\Backups;

use RuntimeException;
use Symfony\Component\Process\Process;

class PostgresBackup
{
    public function dump(string $destination): void
    {
        $binary = $this->validatedBinary('pg_dump_binary', 'pg_dump');
        $db = $this->databaseConfig();
        $arguments = [
            $binary,
            '--format=custom',
            '--no-owner',
            '--no-acl',
            '--no-password',
            '--host='.(string) $db['host'],
            '--port='.(string) $db['port'],
            '--username='.(string) $db['username'],
            '--file='.$destination,
        ];
        foreach ((array) config('backup.exclude_table_data', []) as $table) {
            $arguments[] = '--exclude-table-data='.$table;
        }
        $arguments[] = '--dbname='.(string) $db['database'];

        $this->run($arguments, (string) ($db['password'] ?? ''));
        if (! is_file($destination) || filesize($destination) === 0) {
            throw new RuntimeException('pg_dump termino sin crear un volcado valido.');
        }
    }

    public function restore(string $dump): void
    {
        $binary = $this->validatedBinary('pg_restore_binary', 'pg_restore');
        $db = $this->databaseConfig();
        $this->run([
            $binary,
            '--clean',
            '--if-exists',
            '--exit-on-error',
            '--no-owner',
            '--no-acl',
            '--no-password',
            '--host='.(string) $db['host'],
            '--port='.(string) $db['port'],
            '--username='.(string) $db['username'],
            '--dbname='.(string) $db['database'],
            $dump,
        ], (string) ($db['password'] ?? ''));
    }

    public function assertBinariesAvailable(): void
    {
        foreach (['pg_dump_binary' => 'pg_dump', 'pg_restore_binary' => 'pg_restore'] as $key => $name) {
            $binary = $this->validatedBinary($key, $name);
            $process = new Process([$binary, '--version']);
            $process->setTimeout(10);
            $process->run();
            if (! $process->isSuccessful()) {
                throw new RuntimeException("No se encontro el ejecutable configurado en {$key}.");
            }
        }
    }

    private function databaseConfig(): array
    {
        $driver = (string) config('database.default');
        if ($driver !== 'pgsql') {
            throw new RuntimeException('Los backups reales requieren PostgreSQL.');
        }

        return (array) config('database.connections.pgsql');
    }

    private function run(array $arguments, string $password): void
    {
        $process = new Process(
            $arguments,
            base_path(),
            $password !== '' ? ['PGPASSWORD' => $password] : null
        );
        $process->setTimeout((int) config('backup.process_timeout', 3600));
        $process->run();

        if (! $process->isSuccessful()) {
            throw new RuntimeException(
                'La herramienta PostgreSQL fallo con codigo '.(string) $process->getExitCode().'.'
            );
        }
    }

    private function validatedBinary(string $configKey, string $expected): string
    {
        $binary = (string) config("backup.{$configKey}", $expected);
        $basename = strtolower(basename(str_replace('\\', '/', $binary)));
        if (! in_array($basename, [$expected, $expected.'.exe'], true)) {
            throw new RuntimeException("{$configKey} debe apuntar exclusivamente a {$expected}.");
        }

        return $binary;
    }
}

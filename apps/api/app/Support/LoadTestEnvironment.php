<?php

namespace App\Support;

use Illuminate\Database\DatabaseManager;
use RuntimeException;

class LoadTestEnvironment
{
    public function __construct(private readonly DatabaseManager $databaseManager) {}

    public function assertSafe(): string
    {
        $environment = app()->environment();
        $driver = (string) config('database.default');
        $database = (string) config("database.connections.{$driver}.database");
        $host = (string) config("database.connections.{$driver}.host");
        $url = (string) config("database.connections.{$driver}.url");
        $expected = (string) config('loadtest.database', 'charbook_loadtest');
        $allowedHosts = (array) config('loadtest.allowed_hosts', ['127.0.0.1', 'localhost', '::1']);

        if (! self::matches($environment, $driver, $database, $expected)
            || ! in_array($host, $allowedHosts, true)
            || $url !== '') {
            throw new RuntimeException(sprintf(
                'Operacion cancelada: requiere APP_ENV=loadtest, PostgreSQL local, DB_URL vacio y DB_DATABASE=%s; actuales: %s / %s / %s.',
                $expected,
                $environment,
                $driver,
                $database !== '' ? $database : '(vacia)'
            ));
        }

        // No se abre ninguna conexion hasta aprobar la configuracion local.
        $connection = $this->databaseManager->connection($driver);
        $actualDriver = $connection->getDriverName();
        $actualDatabase = (string) $connection->getDatabaseName();
        if (! self::matches($environment, $actualDriver, $actualDatabase, $expected)) {
            throw new RuntimeException('Operacion cancelada: la conexion real no coincide con charbook_loadtest.');
        }

        return $actualDatabase;
    }

    public static function matches(
        string $environment,
        string $driver,
        string $database,
        string $expected = 'charbook_loadtest'
    ): bool {
        return $environment === 'loadtest'
            && $driver === 'pgsql'
            && hash_equals($expected, $database);
    }

    public function assertExternalServicesDisabled(): void
    {
        $unsafe = [];

        if (config('mail.default') !== 'array') {
            $unsafe[] = 'MAIL_MAILER';
        }
        if (config('filesystems.default') !== 'local') {
            $unsafe[] = 'FILESYSTEM_DISK';
        }
        if (config('scout.driver') !== 'collection') {
            $unsafe[] = 'SCOUT_DRIVER';
        }
        if (! in_array(config('queue.default'), ['sync', 'database'], true)) {
            $unsafe[] = 'QUEUE_CONNECTION';
        }
        if (! in_array(config('cache.default'), ['array', 'database'], true)) {
            $unsafe[] = 'CACHE_STORE';
        }
        if (! in_array(config('session.driver'), ['array', 'database'], true)) {
            $unsafe[] = 'SESSION_DRIVER';
        }
        if (config('backup.enabled')) {
            $unsafe[] = 'BACKUP_ENABLED';
        }

        $credentials = [
            'STRIPE_SECRET' => config('services.stripe.secret'),
            'STRIPE_WEBHOOK_SECRET' => config('services.stripe.webhook_secret'),
            'STRIPE_PUBLISHABLE_KEY' => config('services.stripe.publishable'),
            'GOOGLE_CLIENT_ID' => config('services.google.client_id'),
            'GOOGLE_CLIENT_SECRET' => config('services.google.client_secret'),
            'GOOGLE_CALLBACK_URL' => config('services.google.callback_url'),
            'GOOGLE_BOOKS_API_KEY' => config('services.google_books.key'),
            'RESEND_API_KEY' => config('services.resend.key'),
            'POSTMARK_API_KEY' => config('services.postmark.key'),
            'AWS_ACCESS_KEY_ID' => config('services.ses.key'),
            'R2_BOOKS_BUCKET' => config('filesystems.disks.r2_books.bucket'),
            'R2_COVERS_BUCKET' => config('filesystems.disks.r2_covers.bucket'),
            'R2_ACCESS_KEY_ID' => config('filesystems.disks.r2_books.key'),
            'R2_SECRET_ACCESS_KEY' => config('filesystems.disks.r2_books.secret'),
            'R2_ENDPOINT' => config('filesystems.disks.r2_books.endpoint'),
            'BACKUP_S3_BUCKET' => config('filesystems.disks.backup.bucket'),
            'BACKUP_S3_KEY' => config('filesystems.disks.backup.key'),
            'BACKUP_S3_SECRET' => config('filesystems.disks.backup.secret'),
        ];

        foreach ($credentials as $name => $value) {
            if (filled($value)) {
                $unsafe[] = $name;
            }
        }

        if ($unsafe !== []) {
            throw new RuntimeException(
                'Operación cancelada: loadtest exige servicios externos deshabilitados. Revisa: '
                . implode(', ', array_unique($unsafe)) . '.'
            );
        }
    }

    /** @return array{environment:string,driver:string,host:string,port:string,database:string} */
    public function targetSummary(string $database): array
    {
        $driver = (string) config('database.default');

        return [
            'environment' => app()->environment(),
            'driver' => $driver,
            'host' => (string) config("database.connections.{$driver}.host"),
            'port' => (string) config("database.connections.{$driver}.port"),
            'database' => $database,
        ];
    }
}

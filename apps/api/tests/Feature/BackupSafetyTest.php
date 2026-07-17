<?php

namespace Tests\Feature;

use App\Services\Backups\BackupArchive;
use App\Services\Backups\BackupCipher;
use App\Services\Backups\BackupService;
use App\Services\Backups\PostgresBackup;
use App\Support\BackupEnvironment;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

class BackupSafetyTest extends TestCase
{
    /** @var list<string> */
    private array $temporaryFiles = [];

    protected function tearDown(): void
    {
        foreach ($this->temporaryFiles as $file) {
            @unlink($file);
        }

        parent::tearDown();
    }

    public function test_backup_cipher_round_trip_and_tamper_detection(): void
    {
        $source = $this->temporary('plain');
        $encrypted = $this->temporary('encrypted');
        $restored = $this->temporary('restored');
        $tampered = $this->temporary('tampered');
        $key = base64_encode(random_bytes(32));
        file_put_contents($source, random_bytes(1024 * 1024 + 37));

        $cipher = app(BackupCipher::class);
        $cipher->encrypt($source, $encrypted, $key);
        $cipher->decrypt($encrypted, $restored, $key);

        $this->assertSame(hash_file('sha256', $source), hash_file('sha256', $restored));

        $bytes = file_get_contents($encrypted);
        $bytes[strlen($bytes) - 5] = chr(ord($bytes[strlen($bytes) - 5]) ^ 0x01);
        file_put_contents($tampered, $bytes);

        $this->expectException(RuntimeException::class);
        $cipher->decrypt($tampered, $this->temporary('rejected'), $key);
    }

    public function test_backup_cipher_authenticates_its_header(): void
    {
        $source = $this->temporary('header-plain');
        $encrypted = $this->temporary('header-encrypted');
        $tampered = $this->temporary('header-tampered');
        $key = base64_encode(random_bytes(32));
        file_put_contents($source, str_repeat('header-authentication', 70000));

        $cipher = app(BackupCipher::class);
        $cipher->encrypt($source, $encrypted, $key);
        $bytes = file_get_contents($encrypted);
        $marker = strpos($bytes, '"size":');
        $this->assertNotFalse($marker);
        $digit = $marker + strlen('"size":');
        $bytes[$digit] = $bytes[$digit] === '9' ? '8' : '9';
        file_put_contents($tampered, $bytes);

        $this->expectException(RuntimeException::class);
        $cipher->decrypt($tampered, $this->temporary('header-rejected'), $key);
    }

    public function test_archive_contains_fictitious_database_and_files_and_can_extract_dump(): void
    {
        foreach (['public', 'r2_books', 'r2_covers'] as $disk) {
            Storage::fake($disk);
        }
        config(['backup.source_disks' => ['public', 'r2_books', 'r2_covers']]);

        Storage::disk('public')->put('chapters/demo.txt', 'capitulo ficticio');
        Storage::disk('public')->put('.env', 'SECRET_THAT_MUST_NOT_BE_ARCHIVED');
        Storage::disk('r2_books')->put('books/demo.epub', 'epub ficticio');
        Storage::disk('r2_covers')->put('covers/demo.webp', 'portada ficticia');

        $dump = $this->temporary('database-dump');
        $zip = $this->temporary('archive');
        $extracted = $this->temporary('extracted');
        file_put_contents($dump, 'POSTGRESQL CUSTOM DUMP - FICTITIOUS');

        $archive = app(BackupArchive::class);
        $manifest = $archive->build($dump, $zip);
        $verified = $archive->verify($zip);
        $archive->extractDatabaseDump($zip, $extracted);

        $this->assertCount(3, $manifest['files']);
        $this->assertSame(1, $manifest['excluded_files']);
        $this->assertSame($manifest, $verified);
        $this->assertSame(file_get_contents($dump), file_get_contents($extracted));
        $this->assertStringNotContainsString('SECRET_THAT_MUST_NOT_BE_ARCHIVED', file_get_contents($zip));
    }

    public function test_restore_guard_accepts_only_restore_postgres_and_exact_database(): void
    {
        $this->assertTrue(BackupEnvironment::matchesRestoreTarget(
            'restore',
            'pgsql',
            'charbook_restoretest'
        ));

        foreach ([
            ['production', 'pgsql', 'charbook_restoretest'],
            ['restore', 'sqlite', 'charbook_restoretest'],
            ['restore', 'pgsql', 'charbook'],
            ['loadtest', 'pgsql', 'charbook_restoretest'],
        ] as [$environment, $driver, $database]) {
            $this->assertFalse(BackupEnvironment::matchesRestoreTarget(
                $environment,
                $driver,
                $database
            ));
        }
    }

    public function test_backup_environment_rejects_unsafe_prefix_and_recursive_destination(): void
    {
        config([
            'backup.enabled' => true,
            'backup.allowed_environments' => ['testing'],
            'backup.encryption_key' => base64_encode(random_bytes(32)),
            'backup.disk' => 'backup',
            'backup.path' => '../outside',
            'backup.source_disks' => ['backup'],
            'filesystems.disks.backup.bucket' => 'fictitious-backup-bucket',
            'cache.default' => 'database',
            'database.default' => 'pgsql',
        ]);

        $errors = app(BackupEnvironment::class)->diagnostics();

        $this->assertContains('BACKUP_PATH debe ser un prefijo remoto relativo y seguro.', $errors);
        $this->assertContains('BACKUP_DISK no puede incluirse en BACKUP_SOURCE_DISKS.', $errors);
        $this->assertFalse(BackupEnvironment::isSafeRemotePrefix('../outside'));
        $this->assertTrue(BackupEnvironment::isSafeRemotePrefix('charbook/staging'));
    }

    public function test_archive_rejects_excessive_entries_and_zip_traversal(): void
    {
        Storage::fake('public');
        config([
            'backup.source_disks' => ['public'],
            'backup.limits.max_files' => 1,
        ]);
        Storage::disk('public')->put('books/one.epub', 'one');
        Storage::disk('public')->put('books/two.epub', 'two');
        $dump = $this->temporary('limited-dump');
        $zip = $this->temporary('limited-archive');
        file_put_contents($dump, 'fictitious dump');

        try {
            app(BackupArchive::class)->build($dump, $zip);
            $this->fail('El backup debe rechazar mas archivos que el limite.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('cantidad maxima', $e->getMessage());
        }

        config(['backup.limits.max_files' => 10]);
        Storage::disk('public')->delete('books/two.epub');
        app(BackupArchive::class)->build($dump, $zip);
        $malicious = new \ZipArchive();
        $this->assertTrue($malicious->open($zip) === true);
        $malicious->addFromString('../escape.txt', 'malicious');
        $malicious->close();

        $this->expectException(RuntimeException::class);
        app(BackupArchive::class)->verify($zip);
    }

    public function test_backup_paths_binaries_and_remote_size_are_strictly_bounded(): void
    {
        config([
            'backup.encryption_key' => base64_encode(random_bytes(32)),
            'backup.disk' => 'backup',
            'backup.path' => 'charbook',
            'backup.limits.max_encrypted_bytes' => 1,
            'backup.pg_dump_binary' => 'powershell.exe',
            'filesystems.disks.backup.bucket' => 'fictitious-backup-bucket',
        ]);
        Storage::fake('backup');

        try {
            app(PostgresBackup::class)->assertBinariesAvailable();
            $this->fail('No debe aceptar un ejecutable diferente de pg_dump.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('pg_dump_binary', $e->getMessage());
        }

        try {
            app(BackupService::class)->verifyRemote('charbook/../outside.cbk');
            $this->fail('No debe aceptar traversal en una clave remota.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('Ruta de backup remoto', $e->getMessage());
        }

        $path = 'charbook/2026/07/16/charbook-20260716-120000-a1b2c3d4.cbk';
        Storage::disk('backup')->put($path, 'oversized');
        Storage::disk('backup')->put($path.'.sha256', str_repeat('a', 64));

        $this->expectException(RuntimeException::class);
        app(BackupService::class)->verifyRemote($path);
    }

    public function test_backup_and_restore_commands_refuse_testing_sqlite_before_writing(): void
    {
        config([
            'backup.enabled' => true,
            'backup.allowed_environments' => ['testing'],
            'backup.encryption_key' => base64_encode(random_bytes(32)),
            'backup.disk' => 'backup',
            'filesystems.disks.backup.bucket' => 'fictitious-backup-bucket',
        ]);
        Storage::fake('backup');

        $this->artisan('charbook:backup', [
            '--execute' => true,
            '--confirm' => 'BACKUP_CHARBOOK',
        ])->assertFailed();

        $this->artisan('charbook:backup-restore', [
            'path' => 'charbook/fictitious.cbk',
            '--execute' => true,
            '--confirm' => 'RESTORE_CHARBOOK_RESTORETEST',
        ])->assertFailed();

        Storage::disk('backup')->assertDirectoryEmpty('/');
    }

    public function test_prune_requires_explicit_confirmation_and_preserves_remote_file(): void
    {
        Storage::fake('backup');
        config([
            'backup.disk' => 'backup',
            'backup.path' => 'charbook',
            'backup.retention_days' => 1,
        ]);
        Storage::disk('backup')->put('charbook/old.cbk', 'fictitious');

        $this->artisan('charbook:backup-prune', ['--execute' => true])
            ->expectsOutput('Limpieza cancelada: falta la confirmacion exacta.')
            ->assertFailed();

        Storage::disk('backup')->assertExists('charbook/old.cbk');
    }

    private function temporary(string $name): string
    {
        $path = tempnam(sys_get_temp_dir(), 'charbook-'.$name.'-');
        if ($path === false) {
            $this->fail('No se pudo crear un archivo temporal de prueba.');
        }
        $this->temporaryFiles[] = $path;

        return $path;
    }
}

<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\LoadTestEnvironment;
use Database\Seeders\LoadTestSeeder;
use Illuminate\Database\DatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class LoadTestSafetyTest extends TestCase
{
    use RefreshDatabase;

    public function test_guard_accepts_only_loadtest_postgres_and_exact_database(): void
    {
        $this->assertTrue(LoadTestEnvironment::matches(
            'loadtest',
            'pgsql',
            'charbook_loadtest'
        ));

        foreach ([
            ['production', 'pgsql', 'charbook_loadtest'],
            ['local', 'pgsql', 'charbook_loadtest'],
            ['loadtest', 'sqlite', 'charbook_loadtest'],
            ['loadtest', 'pgsql', 'charbook'],
            ['loadtest', 'pgsql', 'charbook_production'],
        ] as [$environment, $driver, $database]) {
            $this->assertFalse(
                LoadTestEnvironment::matches($environment, $driver, $database),
                "La combinación {$environment}/{$driver}/{$database} debe rechazarse."
            );
        }
    }

    public function test_seeder_refuses_testing_sqlite_before_writing(): void
    {
        try {
            $this->seed(LoadTestSeeder::class);
            $this->fail('El seeder no debe ejecutarse fuera del entorno loadtest protegido.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('Operacion cancelada', $e->getMessage());
        }

        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('roles', 0);
    }

    public function test_seed_command_refuses_outside_loadtest_before_writing(): void
    {
        $this->artisan('charbook:loadtest-seed', [
            'users' => 1000,
            '--force' => true,
        ])->assertFailed();

        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('roles', 0);
    }

    public function test_seeder_cannot_bypass_the_confirmed_loadtest_command(): void
    {
        $guard = Mockery::mock(LoadTestEnvironment::class);
        $guard->shouldReceive('assertSafe')->once()->andReturn('charbook_loadtest');
        $guard->shouldReceive('assertExternalServicesDisabled')->once();
        $this->app->instance(LoadTestEnvironment::class, $guard);
        config(['loadtest.confirmed' => false]);

        try {
            $this->seed(LoadTestSeeder::class);
            $this->fail('El seeder directo debe exigir la confirmacion del comando protegido.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('confirmacion explicita', $e->getMessage());
        }

        $this->assertDatabaseCount('users', 0);
    }

    public function test_clean_command_refuses_outside_loadtest_and_preserves_data(): void
    {
        $user = User::factory()->create();

        $this->artisan('charbook:loadtest-clean', [
            '--force' => true,
        ])->assertFailed();

        $this->assertDatabaseHas('users', ['id' => $user->id]);
    }

    public function test_seed_command_rejects_a_different_database_name(): void
    {
        $this->withUnsafeTarget('loadtest', 'pgsql', 'charbook', function (): void {
            $this->artisan('charbook:loadtest-seed', [
                'users' => 1000,
                '--force' => true,
            ])->assertFailed();
        });
    }

    #[DataProvider('unsafeCommandTargets')]
    public function test_seed_and_clean_commands_reject_every_unsafe_target(
        string $appEnvironment,
        string $driver,
        string $database
    ): void {
        $this->withUnsafeTarget($appEnvironment, $driver, $database, function (): void {
            $this->artisan('charbook:loadtest-seed', [
                'users' => 1000,
                '--force' => true,
            ])->assertFailed();

            $this->artisan('charbook:loadtest-clean', [
                '--force' => true,
            ])->assertFailed();
        });
    }

    public static function unsafeCommandTargets(): array
    {
        return [
            'SQLite aunque se llame loadtest' => ['loadtest', 'sqlite', 'charbook_loadtest'],
            'base normal aunque el entorno sea loadtest' => ['loadtest', 'pgsql', 'charbook'],
            'produccion aunque apunte a la base loadtest' => ['production', 'pgsql', 'charbook_loadtest'],
        ];
    }

    public function test_seed_and_clean_require_explicit_confirmation_without_force(): void
    {
        $guard = Mockery::mock(LoadTestEnvironment::class);
        $guard->shouldReceive('assertSafe')->times(3)->andReturn('charbook_loadtest');
        $guard->shouldReceive('assertExternalServicesDisabled')->times(3);
        $guard->shouldReceive('targetSummary')->times(3)->andReturn($this->safeTarget());
        $this->app->instance(LoadTestEnvironment::class, $guard);

        $this->artisan('charbook:loadtest-seed', ['users' => 1000])
            ->expectsConfirmation(
                '¿Generar 1000 usuarios ficticios en charbook_loadtest?',
                'no'
            )
            ->expectsOutput('Operación cancelada.')
            ->assertSuccessful();

        $this->artisan('charbook:loadtest-clean')
            ->expectsConfirmation(
                '¿Vaciar los datos de aplicación de charbook_loadtest?',
                'no'
            )
            ->expectsOutput('Operación cancelada.')
            ->assertSuccessful();

        $this->artisan('charbook:loadtest-migrate')
            ->expectsConfirmation(
                '¿Ejecutar migraciones en charbook_loadtest?',
                'no'
            )
            ->expectsOutput('Operación cancelada.')
            ->assertSuccessful();
    }

    public function test_force_mode_still_requires_exact_destructive_confirmations(): void
    {
        $guard = Mockery::mock(LoadTestEnvironment::class);
        $guard->shouldReceive('assertSafe')->times(3)->andReturn('charbook_loadtest');
        $guard->shouldReceive('assertExternalServicesDisabled')->times(3);
        $guard->shouldReceive('targetSummary')->times(3)->andReturn($this->safeTarget());
        $this->app->instance(LoadTestEnvironment::class, $guard);

        $this->artisan('charbook:loadtest-seed', ['users' => 1000, '--force' => true])
            ->expectsOutput('Seeder cancelado: falta --confirm=SEED_CHARBOOK_LOADTEST.')
            ->assertFailed();

        $this->artisan('charbook:loadtest-clean', ['--force' => true])
            ->expectsOutput('Limpieza cancelada: falta --confirm=CLEAN_CHARBOOK_LOADTEST.')
            ->assertFailed();

        $this->artisan('charbook:loadtest-migrate', ['--force' => true])
            ->expectsOutput('Migracion cancelada: falta --confirm=MIGRATE_CHARBOOK_LOADTEST.')
            ->assertFailed();
    }

    public function test_guard_verifies_the_actual_connection_after_safe_configuration(): void
    {
        $previousEnvironment = app()->environment();
        $previousDefault = config('database.default');
        $previousPgsql = config('database.connections.pgsql');
        $connection = Mockery::mock();
        $connection->shouldReceive('getDriverName')->once()->andReturn('pgsql');
        $connection->shouldReceive('getDatabaseName')->once()->andReturn('charbook');
        $manager = Mockery::mock(DatabaseManager::class);
        $manager->shouldReceive('connection')->once()->with('pgsql')->andReturn($connection);

        try {
            app()->detectEnvironment(fn () => 'loadtest');
            config([
                'database.default' => 'pgsql',
                'database.connections.pgsql.database' => 'charbook_loadtest',
                'database.connections.pgsql.host' => '127.0.0.1',
                'database.connections.pgsql.url' => null,
            ]);

            try {
                (new LoadTestEnvironment($manager))->assertSafe();
                $this->fail('La conexion real con otra base debe rechazarse.');
            } catch (RuntimeException $e) {
                $this->assertStringContainsString('la conexion real no coincide', $e->getMessage());
            }
        } finally {
            app()->detectEnvironment(fn () => $previousEnvironment);
            config([
                'database.default' => $previousDefault,
                'database.connections.pgsql' => $previousPgsql,
            ]);
        }
    }

    public function test_guard_rejects_a_remote_postgres_host_before_connecting(): void
    {
        $previousEnvironment = app()->environment();
        $previousDefault = config('database.default');
        $previousPgsql = config('database.connections.pgsql');
        $manager = Mockery::mock(DatabaseManager::class);
        $manager->shouldNotReceive('connection');

        try {
            app()->detectEnvironment(fn () => 'loadtest');
            config([
                'database.default' => 'pgsql',
                'database.connections.pgsql.database' => 'charbook_loadtest',
                'database.connections.pgsql.host' => 'db.example.test',
                'database.connections.pgsql.url' => null,
            ]);

            try {
                (new LoadTestEnvironment($manager))->assertSafe();
                $this->fail('Un host PostgreSQL remoto debe rechazarse antes de conectar.');
            } catch (RuntimeException $e) {
                $this->assertStringContainsString('PostgreSQL local', $e->getMessage());
            }
        } finally {
            app()->detectEnvironment(fn () => $previousEnvironment);
            config([
                'database.default' => $previousDefault,
                'database.connections.pgsql' => $previousPgsql,
            ]);
        }
    }

    public function test_external_services_must_be_disabled(): void
    {
        config([
            'mail.default' => 'smtp',
            'filesystems.default' => 'local',
            'scout.driver' => 'collection',
        ]);

        $this->expectException(RuntimeException::class);
        app(LoadTestEnvironment::class)->assertExternalServicesDisabled();
    }

    public function test_loadtest_example_targets_only_the_isolated_database_and_has_no_provider_credentials(): void
    {
        $values = parse_ini_file(
            base_path('.env.loadtest.example'),
            false,
            INI_SCANNER_RAW
        );

        $this->assertIsArray($values);
        $this->assertSame('loadtest', $values['APP_ENV']);
        $this->assertSame('pgsql', $values['DB_CONNECTION']);
        $this->assertSame('', $values['DB_URL']);
        $this->assertSame('charbook_loadtest', $values['DB_DATABASE']);
        $this->assertArrayNotHasKey('LOADTEST_ALLOWED_HOSTS', $values);
        $this->assertSame('array', $values['MAIL_MAILER']);
        $this->assertSame('local', $values['FILESYSTEM_DISK']);
        $this->assertSame('collection', $values['SCOUT_DRIVER']);

        foreach ([
            'STRIPE_SECRET',
            'STRIPE_WEBHOOK_SECRET',
            'STRIPE_PUBLISHABLE_KEY',
            'GOOGLE_CLIENT_ID',
            'GOOGLE_CLIENT_SECRET',
            'GOOGLE_CALLBACK_URL',
            'GOOGLE_BOOKS_API_KEY',
            'RESEND_API_KEY',
            'POSTMARK_API_KEY',
            'AWS_ACCESS_KEY_ID',
            'AWS_SECRET_ACCESS_KEY',
            'R2_ACCESS_KEY_ID',
            'R2_SECRET_ACCESS_KEY',
            'R2_BOOKS_BUCKET',
            'R2_COVERS_BUCKET',
            'R2_ENDPOINT',
            'BACKUP_S3_KEY',
            'BACKUP_S3_SECRET',
            'BACKUP_S3_BUCKET',
            'BACKUP_S3_ENDPOINT',
        ] as $credential) {
            $this->assertArrayHasKey($credential, $values);
            $this->assertSame('', $values[$credential], "{$credential} debe quedar vacía.");
        }
    }

    public function test_controlled_error_route_is_absent_in_testing(): void
    {
        $this->getJson('/api/loadtest/controlled-error')->assertNotFound();
    }

    /** @return array{environment:string,driver:string,host:string,port:string,database:string} */
    private function safeTarget(): array
    {
        return [
            'environment' => 'loadtest',
            'driver' => 'pgsql',
            'host' => '127.0.0.1',
            'port' => '5432',
            'database' => 'charbook_loadtest',
        ];
    }

    private function withUnsafeTarget(
        string $environment,
        string $driver,
        string $database,
        callable $callback
    ): void {
        $previousEnvironment = app()->environment();
        $previousDefault = config('database.default');
        $previousConnection = config("database.connections.{$driver}");
        $previousManager = $this->app->make(DatabaseManager::class);
        $manager = Mockery::mock(DatabaseManager::class);
        $manager->shouldNotReceive('connection');

        try {
            app()->detectEnvironment(fn () => $environment);
            config([
                'database.default' => $driver,
                "database.connections.{$driver}.database" => $database,
                "database.connections.{$driver}.host" => '127.0.0.1',
                "database.connections.{$driver}.url" => null,
            ]);
            $this->app->instance(DatabaseManager::class, $manager);
            $callback();
        } finally {
            app()->detectEnvironment(fn () => $previousEnvironment);
            config([
                'database.default' => $previousDefault,
                "database.connections.{$driver}" => $previousConnection,
            ]);
            $this->app->instance(DatabaseManager::class, $previousManager);
        }
    }
}

<?php

namespace App\Console\Commands;

use App\Support\LoadTestEnvironment;
use Database\Seeders\LoadTestSeeder;
use Illuminate\Console\Command;
use RuntimeException;

class SeedLoadTestData extends Command
{
    protected $signature = 'charbook:loadtest-seed
        {users=1000 : Total permitido: 1000 o 10000}
        {--authors= : Autores ficticios (1-500)}
        {--books= : Libros ficticios (1-2000)}
        {--categories= : Categorías ficticias (2-100)}
        {--favorites= : Favoritos ficticios (1-100000)}
        {--reviews= : Reseñas ficticias (1-total de usuarios)}
        {--comments= : Comentarios ficticios (1-total de usuarios)}
        {--views= : Vistas ficticias (1-100000)}
        {--activities= : Actividades ficticias (1-total de usuarios)}
        {--force : Ejecuta sin interacción; requiere confirmación exacta}
        {--confirm= : Confirmación exacta SEED_CHARBOOK_LOADTEST}';

    protected $description = 'Genera datos ficticios únicamente en charbook_loadtest';

    public function handle(LoadTestEnvironment $environment): int
    {
        try {
            $database = $environment->assertSafe();
            $environment->assertExternalServicesDisabled();
        } catch (RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $users = filter_var($this->argument('users'), FILTER_VALIDATE_INT);
        if (! in_array($users, [1000, 10000], true)) {
            $this->error('El total debe ser exactamente 1000 o 10000 usuarios.');

            return self::INVALID;
        }

        $target = $environment->targetSummary($database);
        $this->table(['APP_ENV', 'Driver', 'Host', 'Puerto', 'Base'], [[
            $target['environment'],
            $target['driver'],
            $target['host'],
            $target['port'],
            $target['database'],
        ]]);
        $this->line('No se usarán correo, Stripe, Google, R2 ni otros servicios externos.');

        if ($this->option('force') && $this->option('confirm') !== 'SEED_CHARBOOK_LOADTEST') {
            $this->error('Seeder cancelado: falta --confirm=SEED_CHARBOOK_LOADTEST.');

            return self::FAILURE;
        }
        if (! $this->option('force') && ! $this->confirm("¿Generar {$users} usuarios ficticios en {$database}?")) {
            $this->info('Operación cancelada.');

            return self::SUCCESS;
        }

        $limits = [
            'authors' => [1, 500],
            'books' => [1, 2000],
            'categories' => [2, 100],
            'favorites' => [1, 100000],
            'reviews' => [1, $users],
            'comments' => [1, $users],
            'views' => [1, 100000],
            'activities' => [1, $users],
        ];
        $configuration = ['loadtest.users' => $users];
        foreach ($limits as $name => [$minimum, $maximum]) {
            $value = $this->option($name);
            if ($value === null) {
                continue;
            }

            $validated = filter_var($value, FILTER_VALIDATE_INT);
            if ($validated === false || $validated < $minimum || $validated > $maximum) {
                $this->error("--{$name} debe estar entre {$minimum} y {$maximum}.");

                return self::INVALID;
            }
            $configuration["loadtest.counts.{$name}"] = $validated;
        }
        config($configuration);
        config(['loadtest.confirmed' => true]);

        $startedAt = microtime(true);
        try {
            $exitCode = $this->call('db:seed', [
                '--class' => LoadTestSeeder::class,
                '--force' => true,
            ]);
        } finally {
            config(['loadtest.confirmed' => false]);
        }
        if ($exitCode === self::SUCCESS) {
            $this->info('Seeder completado en '.round(microtime(true) - $startedAt, 2).' segundos.');
        }

        return $exitCode;
    }
}

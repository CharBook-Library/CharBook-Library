<?php

namespace Database\Seeders;

use App\Models\Author;
use App\Models\Book;
use App\Models\User;
use App\Support\LoadTestEnvironment;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Eloquent\Factories\Sequence;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Spatie\Permission\Models\Role;

class LoadTestSeeder extends Seeder
{
    use WithoutModelEvents;

    private const BATCH_SIZE = 1000;

    public function run(): void
    {
        $environment = app(LoadTestEnvironment::class);
        $database = $environment->assertSafe();
        $environment->assertExternalServicesDisabled();
        if (config('loadtest.confirmed') !== true) {
            throw new RuntimeException(
                'LoadTestSeeder solo puede ejecutarse mediante charbook:loadtest-seed con confirmacion explicita.'
            );
        }

        $userCount = (int) config('loadtest.users', 1000);
        if (! in_array($userCount, [1000, 10000], true)) {
            throw new RuntimeException('LoadTestSeeder solo acepta 1000 o 10000 usuarios.');
        }
        if (User::query()->exists()) {
            throw new RuntimeException(
                'La base loadtest ya contiene usuarios. Ejecuta charbook:loadtest-clean antes de volver a sembrar.'
            );
        }

        $password = (string) config('loadtest.user_password');
        if (strlen($password) < 12) {
            throw new RuntimeException('LOADTEST_USER_PASSWORD debe tener al menos 12 caracteres.');
        }

        $this->command?->warn('Seeder protegido en APP_ENV=' . app()->environment());
        $this->command?->warn('Base verificada: ' . $database);

        Storage::disk('local')->deleteDirectory('loadtest');
        $plainTokens = [];

        $summary = DB::transaction(function () use ($userCount, $password, &$plainTokens): array {
            $this->call(RoleSeeder::class);

            $userIds = $this->seedUsers($userCount, $password);
            $roleIds = Role::query()
                ->whereIn('name', ['reader', 'creator', 'admin', 'super_admin'])
                ->pluck('id', 'name');

            $this->insertRows('model_has_roles', count($userIds), fn (int $index) => [
                'role_id' => $roleIds['reader'],
                'model_type' => User::class,
                'model_id' => $userIds[$index],
            ]);

            DB::table('model_has_roles')->insert([
                [
                    'role_id' => $roleIds['super_admin'],
                    'model_type' => User::class,
                    'model_id' => $userIds[0],
                ],
                [
                    'role_id' => $roleIds['admin'],
                    'model_type' => User::class,
                    'model_id' => $userIds[1],
                ],
            ]);

            $creatorCount = max(25, min(100, intdiv($userCount, 100)));
            $creatorIds = array_slice($userIds, 2, $creatorCount);
            foreach (array_chunk($creatorIds, self::BATCH_SIZE) as $chunk) {
                DB::table('users')->whereIn('id', $chunk)->update([
                    'creator_status' => 'approved',
                    'creator_tier' => 'verified',
                ]);
                DB::table('model_has_roles')->insert(array_map(fn (int $id) => [
                    'role_id' => $roleIds['creator'],
                    'model_type' => User::class,
                    'model_id' => $id,
                ], $chunk));
            }

            $authorCount = $this->configuredCount(
                'authors',
                max(25, min(100, intdiv($userCount, 100))),
                1,
                500
            );
            $authorIds = Author::factory()
                ->count($authorCount)
                ->sequence(fn (Sequence $sequence) => [
                    'name' => sprintf('Loadtest Author %03d', $sequence->index + 1),
                    'slug' => sprintf('loadtest-author-%03d', $sequence->index + 1),
                ])
                ->create()
                ->pluck('id')
                ->all();

            $categoryCount = $this->configuredCount('categories', 12, 2, 100);
            $categoryIds = $this->seedCategories($categoryCount);
            $bookCount = $this->configuredCount(
                'books',
                max(100, min(500, intdiv($userCount, 20))),
                1,
                2000
            );
            $books = Book::withoutSyncingToSearch(fn () => Book::factory()
                ->count($bookCount)
                ->sequence(fn (Sequence $sequence) => [
                    'title' => sprintf('Loadtest Book %04d', $sequence->index + 1),
                    'slug' => sprintf('loadtest-book-%04d', $sequence->index + 1),
                    'author_id' => $authorIds[$sequence->index % count($authorIds)],
                    'creator_id' => $creatorIds[$sequence->index % count($creatorIds)],
                    'parent_category_id' => $categoryIds[$sequence->index % count($categoryIds)],
                    'tags' => ['loadtest', 'lectura'],
                ])
                ->create());
            $bookIds = $books->pluck('id')->all();

            $now = now();
            $this->insertRows('book_category', $bookCount * 2, function (int $index) use ($bookIds, $categoryIds, $now) {
                $bookIndex = intdiv($index, 2);
                $categoryOffset = $index % 2;

                return [
                    'book_id' => $bookIds[$bookIndex],
                    'category_id' => $categoryIds[($bookIndex + $categoryOffset) % count($categoryIds)],
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            });

            $chapterBody = str_repeat(
                'Este es contenido ficticio de lectura para validar rendimiento de CharBook. ',
                18
            );
            $this->insertRows('chapters', $bookCount * 3, function (int $index) use ($bookIds, $chapterBody, $now) {
                $bookIndex = intdiv($index, 3);
                $number = ($index % 3) + 1;

                return [
                    'book_id' => $bookIds[$bookIndex],
                    'number' => $number,
                    'title' => "Capítulo {$number}",
                    'body' => $chapterBody,
                    'position' => $number,
                    'is_published' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            });

            $stats = [];
            foreach ($bookIds as $bookId) {
                $stats[$bookId] = [
                    'favorites' => 0,
                    'ratings' => 0,
                    'rating_sum' => 0,
                    'views' => 0,
                    'readings' => 0,
                ];
            }

            $favoriteCount = $this->configuredCount(
                'favorites',
                min($userCount * 2, 20000),
                1,
                min(100000, $userCount * $bookCount)
            );
            $this->insertRows('favorites', $favoriteCount, function (int $index) use ($userIds, $bookIds, $now, &$stats) {
                $userIndex = $index % count($userIds);
                $cycle = intdiv($index, count($userIds));
                $bookId = $bookIds[(($userIndex * 17) + $cycle) % count($bookIds)];
                $stats[$bookId]['favorites']++;

                return [
                    'user_id' => $userIds[$userIndex],
                    'book_id' => $bookId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            });

            $reviewCount = $this->configuredCount(
                'reviews',
                min($userCount, 5000),
                1,
                $userCount
            );
            $this->insertRows('reviews', $reviewCount, function (int $index) use ($userIds, $bookIds, $now, &$stats) {
                $bookId = $bookIds[(($index * 19) + 3) % count($bookIds)];
                $rating = ($index % 5) + 1;
                $stats[$bookId]['ratings']++;
                $stats[$bookId]['rating_sum'] += $rating;

                return [
                    'user_id' => $userIds[$index],
                    'book_id' => $bookId,
                    'rating' => $rating,
                    'title' => 'Reseña loadtest',
                    'comment' => 'Opinión ficticia para pruebas de rendimiento.',
                    'created_at' => $now->copy()->subMinutes($index % 43200),
                    'updated_at' => $now,
                ];
            });

            $commentCount = $this->configuredCount(
                'comments',
                min($userCount, 8000),
                1,
                $userCount
            );
            $this->insertRows('comments', $commentCount, fn (int $index) => [
                'user_id' => $userIds[$index],
                'commentable_type' => Book::class,
                'commentable_id' => $bookIds[(($index * 23) + 5) % count($bookIds)],
                'parent_id' => null,
                'body' => 'Comentario ficticio de lectura para pruebas de carga.',
                'is_spoiler' => $index % 20 === 0,
                'likes_count' => $index % 11,
                'replies_count' => 0,
                'created_at' => $now->copy()->subMinutes($index % 43200),
                'updated_at' => $now,
                'deleted_at' => null,
            ]);

            $viewCount = $this->configuredCount(
                'views',
                min($userCount * 3, 30000),
                1,
                min(100000, $userCount * min(10, $bookCount))
            );
            $this->insertRows('book_views', $viewCount, function (int $index) use ($userIds, $bookIds, $now, &$stats) {
                $userIndex = $index % count($userIds);
                $cycle = intdiv($index, count($userIds));
                $bookId = $bookIds[(($userIndex * 29) + $cycle) % count($bookIds)];
                $sessions = ($index % 4) + 1;
                $stats[$bookId]['views']++;
                $stats[$bookId]['readings'] += $sessions;

                return [
                    'book_id' => $bookId,
                    'user_id' => $userIds[$userIndex],
                    'visitor_hash' => null,
                    'first_viewed_at' => $now->copy()->subDays(($index % 60) + 1),
                    'last_viewed_at' => $now->copy()->subMinutes($index % 1440),
                    'sessions_count' => $sessions,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            });

            $activityCount = $this->configuredCount(
                'activities',
                min($userCount, 10000),
                1,
                $userCount
            );
            $activityTypes = ['started_reading', 'finished_reading', 'want_to_read', 'reviewed', 'favorited'];
            $this->insertRows('activities', $activityCount, fn (int $index) => [
                'user_id' => $userIds[$index],
                'book_id' => $bookIds[(($index * 31) + 7) % count($bookIds)],
                'type' => $activityTypes[$index % count($activityTypes)],
                'meta' => json_encode(['source' => 'loadtest'], JSON_THROW_ON_ERROR),
                'likes_count' => $index % 20,
                'comments_count' => $index % 4,
                'shares_count' => $index % 3,
                'created_at' => $now->copy()->subMinutes($index % 43200),
                'updated_at' => $now,
            ]);

            foreach ($stats as $bookId => $bookStats) {
                DB::table('books')->where('id', $bookId)->update([
                    'favorites_count' => $bookStats['favorites'],
                    'views_count' => $bookStats['views'],
                    'total_readings_count' => $bookStats['readings'],
                    'rating_count' => $bookStats['ratings'],
                    'rating_average' => $bookStats['ratings'] > 0
                        ? round($bookStats['rating_sum'] / $bookStats['ratings'], 2)
                        : 0,
                ]);
            }

            $tokenCount = max(1, min((int) config('loadtest.token_count', 500), 500, $userCount));
            $tokenUsers = User::query()
                ->whereIn('id', array_slice($userIds, 0, $tokenCount))
                ->orderBy('id')
                ->get(['id', 'email']);
            foreach ($tokenUsers as $user) {
                $plainTokens[] = [
                    'email' => $user->email,
                    'token' => $user->createToken('loadtest-k6')->plainTextToken,
                ];
            }

            if (User::query()->count() !== $userCount
                || User::query()->where('email', 'not like', '%@example.test')->exists()) {
                throw new RuntimeException('La verificacion final de usuarios loadtest no coincide.');
            }

            return [
                'users' => $userCount,
                'authors' => count($authorIds),
                'books' => $bookCount,
                'categories' => count($categoryIds),
                'chapters' => $bookCount * 3,
                'favorites' => $favoriteCount,
                'reviews' => $reviewCount,
                'comments' => $commentCount,
                'views' => $viewCount,
                'activities' => $activityCount,
                'tokens' => count($plainTokens),
            ];
        });

        $written = Storage::disk('local')->put(
            'loadtest/tokens.json',
            json_encode([
                'environment' => 'loadtest',
                'database' => (string) config('loadtest.database'),
                'generated_at' => now()->toIso8601String(),
                'tokens' => $plainTokens,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)
        );
        if (! $written) {
            throw new RuntimeException('No se pudo escribir el archivo temporal de tokens k6.');
        }
        @chmod(Storage::disk('local')->path('loadtest/tokens.json'), 0600);

        $this->command?->table(
            ['Entidad', 'Total'],
            collect($summary)->map(fn (int $count, string $name) => [$name, $count])->values()->all()
        );
        $this->command?->info(
            'Tokens k6 guardados en storage/app/private/loadtest/tokens.json (contenido no mostrado).'
        );
    }

    /** @return list<int> */
    private function seedUsers(int $count, string $password): array
    {
        $passwordHash = Hash::make($password);

        for ($offset = 0; $offset < $count; $offset += self::BATCH_SIZE) {
            $batchSize = min(self::BATCH_SIZE, $count - $offset);
            User::factory()
                ->count($batchSize)
                ->sequence(function (Sequence $sequence) use ($offset) {
                    $number = $offset + $sequence->index + 1;

                    return [
                        'name' => sprintf('Load Test User %05d', $number),
                        'email' => sprintf('loadtest-%05d@example.test', $number),
                        'username' => sprintf('loadtest_%05d', $number),
                    ];
                })
                ->create([
                    'password' => $passwordHash,
                    'email_verified_at' => now(),
                    'locale' => 'es',
                    'is_public_profile' => true,
                ]);
        }

        return User::query()
            ->where('email', 'like', 'loadtest-%@example.test')
            ->orderBy('id')
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /** @return list<int> */
    private function seedCategories(int $count): array
    {
        $names = [
            'Fantasía', 'Romance', 'Misterio', 'Ciencia ficción',
            'Aventura', 'Terror', 'Histórica', 'Juvenil',
            'Poesía', 'Ensayo', 'Humor', 'Drama',
        ];

        $rows = [];
        for ($index = 0; $index < $count; $index++) {
            $label = $names[$index] ?? sprintf('Categoría %03d', $index + 1);
            $rows[] = [
                'name' => 'Loadtest ' . $label,
                'slug' => sprintf('loadtest-category-%03d', $index + 1),
                'description' => 'Categoría ficticia exclusiva del entorno loadtest.',
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }
        DB::table('categories')->insert($rows);

        return DB::table('categories')
            ->where('slug', 'like', 'loadtest-category-%')
            ->orderBy('id')
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    private function configuredCount(string $name, int $default, int $minimum, int $maximum): int
    {
        $configured = (int) config("loadtest.counts.{$name}", 0);
        $value = $configured > 0 ? $configured : $default;

        if ($value < $minimum || $value > $maximum) {
            throw new RuntimeException(
                "Cantidad loadtest inválida para {$name}: debe estar entre {$minimum} y {$maximum}."
            );
        }

        return $value;
    }

    private function insertRows(string $table, int $count, callable $factory): void
    {
        $rows = [];
        for ($index = 0; $index < $count; $index++) {
            $rows[] = $factory($index);

            if (count($rows) === self::BATCH_SIZE) {
                DB::table($table)->insert($rows);
                $rows = [];
            }
        }

        if ($rows !== []) {
            DB::table($table)->insert($rows);
        }
    }
}

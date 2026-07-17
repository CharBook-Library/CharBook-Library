<?php

namespace Database\Factories;

use App\Models\Book;
use App\Models\BookView;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<BookView> */
class BookViewFactory extends Factory
{
    protected $model = BookView::class;

    public function definition(): array
    {
        $firstViewedAt = fake()->dateTimeBetween('-90 days', '-1 hour');

        return [
            'book_id' => Book::factory(),
            'user_id' => User::factory(),
            'visitor_hash' => null,
            'first_viewed_at' => $firstViewedAt,
            'last_viewed_at' => fake()->dateTimeBetween($firstViewedAt, 'now'),
            'sessions_count' => fake()->numberBetween(1, 5),
        ];
    }
}

<?php

namespace Database\Factories;

use App\Models\Activity;
use App\Models\Book;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Activity> */
class ActivityFactory extends Factory
{
    protected $model = Activity::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'book_id' => Book::factory(),
            'type' => fake()->randomElement([
                'started_reading', 'finished_reading', 'want_to_read', 'reviewed', 'favorited',
            ]),
            'meta' => null,
            'likes_count' => fake()->numberBetween(0, 20),
            'comments_count' => fake()->numberBetween(0, 5),
            'shares_count' => fake()->numberBetween(0, 3),
        ];
    }
}

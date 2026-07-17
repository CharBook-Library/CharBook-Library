<?php

namespace Database\Factories;

use App\Models\Author;
use App\Models\Book;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Book> */
class BookFactory extends Factory
{
    protected $model = Book::class;

    public function definition(): array
    {
        return [
            'author_id' => Author::factory(),
            'title' => fake()->sentence(4),
            'slug' => fake()->unique()->slug(5),
            'description' => fake()->paragraph(),
            'synopsis' => fake()->paragraphs(2, true),
            'content_type' => 'novela',
            'work_format' => 'serie',
            'age_rating' => fake()->randomElement(['all', 'teen', 'mature']),
            'language' => 'es',
            'access_type' => 'free',
            'submission_status' => 'published',
            'is_original' => true,
            'is_published' => true,
            'is_hidden' => false,
            'file_type' => 'epub',
        ];
    }
}

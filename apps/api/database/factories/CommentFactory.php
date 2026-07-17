<?php

namespace Database\Factories;

use App\Models\Book;
use App\Models\Comment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Comment> */
class CommentFactory extends Factory
{
    protected $model = Comment::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'commentable_type' => Book::class,
            'commentable_id' => Book::factory(),
            'parent_id' => null,
            'body' => fake()->paragraph(),
            'is_spoiler' => false,
        ];
    }
}

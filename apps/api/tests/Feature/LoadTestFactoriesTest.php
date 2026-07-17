<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Author;
use App\Models\Book;
use App\Models\BookView;
use App\Models\Category;
use App\Models\Comment;
use App\Models\Favorite;
use App\Models\Review;
use App\Models\User;
use App\Support\LoadTestEnvironment;
use Database\Seeders\LoadTestSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class LoadTestFactoriesTest extends TestCase
{
    use RefreshDatabase;

    public function test_loadtest_factories_match_current_schema_without_external_calls(): void
    {
        Http::preventStrayRequests();
        Mail::fake();
        config(['scout.driver' => 'collection']);

        $user = User::factory()->create();
        $author = Author::factory()->create();
        $category = Category::factory()->create();
        $book = Book::withoutSyncingToSearch(fn () => Book::factory()->create([
            'author_id' => $author->id,
        ]));
        $book->categories()->attach($category->id);

        $favorite = Favorite::factory()->create([
            'user_id' => $user->id,
            'book_id' => $book->id,
        ]);
        $review = Review::factory()->create([
            'user_id' => $user->id,
            'book_id' => $book->id,
        ]);
        $view = BookView::factory()->create([
            'user_id' => $user->id,
            'book_id' => $book->id,
        ]);
        $activity = Activity::factory()->create([
            'user_id' => $user->id,
            'book_id' => $book->id,
        ]);
        $comment = Comment::factory()->create([
            'user_id' => $user->id,
            'commentable_type' => Book::class,
            'commentable_id' => $book->id,
        ]);

        $this->assertTrue($favorite->exists);
        $this->assertTrue($review->exists);
        $this->assertTrue($view->exists);
        $this->assertTrue($activity->exists);
        $this->assertTrue($comment->exists);
        $this->assertDatabaseHas('book_category', [
            'book_id' => $book->id,
            'category_id' => $category->id,
        ]);
    }

    public function test_seeder_batches_one_thousand_users_without_external_side_effects(): void
    {
        Http::preventStrayRequests();
        Mail::fake();
        Notification::fake();
        Queue::fake();
        Storage::fake('local');

        config([
            'scout.driver' => 'collection',
            'loadtest.users' => 1000,
            'loadtest.confirmed' => true,
            'loadtest.token_count' => 3,
            'loadtest.counts.authors' => 1,
            'loadtest.counts.books' => 1,
            'loadtest.counts.categories' => 2,
            'loadtest.counts.favorites' => 1,
            'loadtest.counts.reviews' => 1,
            'loadtest.counts.comments' => 1,
            'loadtest.counts.views' => 1,
            'loadtest.counts.activities' => 1,
        ]);

        $guard = Mockery::mock(LoadTestEnvironment::class);
        $guard->shouldReceive('assertSafe')->once()->andReturn('charbook_loadtest');
        $guard->shouldReceive('assertExternalServicesDisabled')->once();
        $this->app->instance(LoadTestEnvironment::class, $guard);

        $this->artisan('db:seed', [
            '--class' => LoadTestSeeder::class,
            '--force' => true,
        ])->assertSuccessful();

        $this->assertDatabaseCount('users', 1000);
        $this->assertSame(1000, User::query()->where('email', 'like', '%@example.test')->count());
        $this->assertFalse(User::query()->where('email', 'not like', '%@example.test')->exists());
        $this->assertDatabaseCount('authors', 1);
        $this->assertDatabaseCount('books', 1);
        $this->assertDatabaseCount('chapters', 3);
        $this->assertDatabaseCount('personal_access_tokens', 3);
        Storage::disk('local')->assertExists('loadtest/tokens.json');

        $fixture = json_decode(
            Storage::disk('local')->get('loadtest/tokens.json'),
            true,
            flags: JSON_THROW_ON_ERROR
        );
        $this->assertSame('loadtest', $fixture['environment']);
        $this->assertSame('charbook_loadtest', $fixture['database']);
        $this->assertCount(3, $fixture['tokens']);

        Queue::assertNothingPushed();
        Notification::assertNothingSent();
        Mail::assertNothingSent();
    }
}

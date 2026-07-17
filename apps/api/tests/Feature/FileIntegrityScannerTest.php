<?php

namespace Tests\Feature;

use App\Models\Author;
use App\Models\Book;
use App\Services\Health\FileIntegrityScanner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class FileIntegrityScannerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Storage::fake('r2_books');
        Storage::fake('r2_covers');
        Cache::clear();
        config([
            'cache.default' => 'array',
            'filesystems.disks.r2_books.bucket' => 'test-books',
            'filesystems.disks.r2_covers.bucket' => 'test-covers',
        ]);
    }

    public function test_remote_objects_are_not_reported_as_missing_local_files(): void
    {
        Storage::disk('r2_books')->put('books/remote.epub', 'remote fixture');
        Storage::disk('r2_covers')->put('covers/remote.webp', 'remote cover');
        $this->book([
            'file_path' => 'books/remote.epub',
            'cover_path' => 'covers/remote.webp',
        ]);

        $result = app(FileIntegrityScanner::class)->scan();

        $this->assertSame(0, $result['issues_total']);
        $this->assertSame(1, $result['remote_files_verified']);
        $this->assertSame(1, $result['remote_covers_verified']);
        $this->assertSame(0, $result['remote_checks_failed']);
        $this->assertSame(0, $result['deep_checked_files']);
    }

    public function test_local_pdf_still_receives_deep_integrity_validation(): void
    {
        Storage::disk('public')->put('books/broken.pdf', 'not a pdf');
        $book = $this->book(['file_path' => 'books/broken.pdf']);

        $result = app(FileIntegrityScanner::class)->scan();

        $this->assertSame(1, $result['deep_checked_files']);
        $this->assertSame(1, $result['issues_total']);
        $this->assertSame('pdf_ilegible', $result['issues'][0]['type']);
        $this->assertSame($book->id, $result['issues'][0]['id']);
    }

    private function book(array $overrides = []): Book
    {
        $author = Author::create([
            'name' => 'Scanner Test Author',
            'slug' => 'scanner-test-author-' . str()->random(8),
        ]);

        return Book::create(array_merge([
            'author_id' => $author->id,
            'title' => 'Scanner Test Book',
            'slug' => 'scanner-test-book-' . str()->random(8),
            'access_type' => 'free',
            'is_published' => false,
            'file_type' => 'epub',
        ], $overrides));
    }
}

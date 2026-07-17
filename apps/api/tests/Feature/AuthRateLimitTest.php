<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class AuthRateLimitTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_uses_the_restrictive_auth_rate_limit(): void
    {
        Cache::clear();

        for ($attempt = 1; $attempt <= 10; $attempt++) {
            $this->postJson('/api/auth/login', [])
                ->assertUnprocessable();
        }

        $this->postJson('/api/auth/login', [])
            ->assertTooManyRequests()
            ->assertHeader('Retry-After');
    }
}

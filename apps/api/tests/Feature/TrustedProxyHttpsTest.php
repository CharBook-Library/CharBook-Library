<?php

namespace Tests\Feature;

use App\Support\TrustedProxyList;
use Illuminate\Http\RedirectResponse;
use Laravel\Socialite\Facades\Socialite;
use Mockery;
use Tests\TestCase;

class TrustedProxyHttpsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config(['services.google.callback_url' => null]);
    }

    public function test_proxy_configuration_accepts_only_explicit_ips_and_cidrs(): void
    {
        $this->assertSame(
            ['127.0.0.1', '10.0.0.0/8', '::1', '2001:db8::/32'],
            TrustedProxyList::parse(
                '*,**,REMOTE_ADDR,proxy.internal,127.0.0.1,10.0.0.0/8,::1,2001:db8::/32,10.0.0.0/99,127.0.0.1'
            )
        );
    }

    public function test_direct_request_does_not_become_https_from_a_spoofed_header(): void
    {
        config(['trustedproxy.proxies' => []]);
        $this->expectGoogleRedirectUrl('http://localhost/auth/google/callback');

        $this->withServerVariables([
            'REMOTE_ADDR' => '198.51.100.10',
            'HTTP_HOST' => 'localhost',
            'SERVER_NAME' => 'localhost',
            'SERVER_PORT' => 80,
            'HTTPS' => 'off',
        ])
            ->withHeader('X-Forwarded-Proto', 'https')
            ->get('http://localhost/auth/google/mobile')
            ->assertRedirect('https://accounts.google.test/authorize');
    }

    public function test_untrusted_proxy_cannot_spoof_https(): void
    {
        config(['trustedproxy.proxies' => ['127.0.0.1']]);
        $this->expectGoogleRedirectUrl('http://localhost/auth/google/callback');

        $this->withServerVariables([
            'REMOTE_ADDR' => '198.51.100.10',
            'HTTP_HOST' => 'localhost',
            'SERVER_NAME' => 'localhost',
            'SERVER_PORT' => 80,
            'HTTPS' => 'off',
        ])
            ->withHeader('X-Forwarded-Proto', 'https')
            ->get('http://localhost/auth/google/mobile')
            ->assertRedirect('https://accounts.google.test/authorize');
    }

    public function test_trusted_local_ngrok_proxy_generates_an_https_callback(): void
    {
        config(['trustedproxy.proxies' => ['127.0.0.1']]);
        $this->expectGoogleRedirectUrl('https://reader.ngrok-free.app/auth/google/callback');

        $this->withServerVariables([
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_HOST' => 'reader.ngrok-free.app',
            'SERVER_NAME' => 'reader.ngrok-free.app',
            'SERVER_PORT' => 80,
            'HTTPS' => 'off',
        ])
            ->withHeader('X-Forwarded-Proto', 'https')
            ->get('http://reader.ngrok-free.app/auth/google/mobile')
            ->assertRedirect('https://accounts.google.test/authorize');
    }

    public function test_explicit_callback_is_used_instead_of_forwarded_headers(): void
    {
        config([
            'trustedproxy.proxies' => ['127.0.0.1'],
            'services.google.callback_url' => 'https://api.charbook.example/auth/google/callback',
        ]);
        $this->expectGoogleRedirectUrl('https://api.charbook.example/auth/google/callback');

        $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1'])
            ->withHeaders([
                'Host' => 'spoofed.example',
                'X-Forwarded-Proto' => 'http',
            ])
            ->get('http://spoofed.example/auth/google/mobile')
            ->assertRedirect('https://accounts.google.test/authorize');
    }

    private function expectGoogleRedirectUrl(string $expected): void
    {
        $driver = Mockery::mock();
        $driver->shouldReceive('stateless')->once()->andReturnSelf();
        $driver->shouldReceive('redirectUrl')->once()->with($expected)->andReturnSelf();
        $driver->shouldReceive('redirect')->once()->andReturn(
            new RedirectResponse('https://accounts.google.test/authorize')
        );

        Socialite::shouldReceive('driver')->once()->with('google')->andReturn($driver);
    }
}

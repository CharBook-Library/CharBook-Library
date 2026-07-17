<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AccountStatusService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Laravel\Socialite\Facades\Socialite;

class GoogleController extends Controller
{
    public function __construct(private readonly AccountStatusService $accountStatus) {}

    public function redirect()
    {
        return Socialite::driver('google')->stateless()->redirect();
    }

    public function mobileRedirect(Request $request)
    {
        $callbackUrl = $this->googleCallbackUrl($request);

        session([
            'google_oauth_target' => 'mobile',
            'google_oauth_mobile_redirect' => $this->mobileRedirectUri($request),
            'google_oauth_callback' => $callbackUrl,
        ]);

        return Socialite::driver('google')->stateless()->redirectUrl($callbackUrl)->redirect();
    }

    public function callback(Request $request)
    {
        $callbackUrl = session()->pull('google_oauth_callback');

        try {
            $driver = Socialite::driver('google')->stateless();
            if ($callbackUrl) {
                $driver->redirectUrl($callbackUrl);
            }

            $googleUser = $driver->user();
        } catch (\Throwable $e) {
            Log::error('Google OAuth callback failed.', ['exception' => $e::class]);
            return $this->oauthFailureRedirect();
        }

        $user = User::updateOrCreate(
            ['email' => $googleUser->email],
            [
                'name' => $googleUser->name,
                'google_id' => $googleUser->id,
                'avatar' => $googleUser->avatar,
                'email_verified_at' => now(),
            ]
        );

        if (! $user->email_verified_at) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        if (! $user->username) {
            $base = explode('@', $googleUser->email)[0]
                ?: preg_replace('/\s+/', '', $googleUser->name);

            $user->forceFill([
                'username' => User::generateUniqueUsername($base),
            ])->save();
        }

        $accountStatus = $this->accountStatus->effectiveStatus($user);
        if ($accountStatus !== User::ACCOUNT_ACTIVE) {
            return $this->oauthAccountBlockedRedirect($accountStatus);
        }

        if ($user->wasRecentlyCreated && ! $user->hasAnyRole(['admin', 'reader'])) {
            $user->assignRole('reader');
        }

        $superAdminEmail = config('app.super_admin_email') ?: env('SUPER_ADMIN_EMAIL');
        if (
            $superAdminEmail
            && strcasecmp($user->email, $superAdminEmail) === 0
            && ! $user->hasRole('super_admin')
        ) {
            $user->assignRole('super_admin');
        }

        Auth::login($user, remember: true);

        $token = $user->createToken('charbook-web', ['*'])->plainTextToken;

        if (session()->pull('google_oauth_target') === 'mobile') {
            $mobileRedirect = session()->pull(
                'google_oauth_mobile_redirect',
                config('services.google.mobile_redirect', 'charbookreact://auth/callback')
            );

            return redirect($this->appendQuery($mobileRedirect, ['token' => $token]));
        }

        $frontend = rtrim(config('app.frontend_url', config('app.url')), '/');
        return redirect("{$frontend}/auth/callback?token={$token}");
    }

    private function oauthFailureRedirect()
    {
        if (session()->pull('google_oauth_target') === 'mobile') {
            $mobileRedirect = session()->pull(
                'google_oauth_mobile_redirect',
                config('services.google.mobile_redirect', 'charbookreact://auth/callback')
            );

            return redirect($this->appendQuery($mobileRedirect, ['error' => 'oauth_failed']));
        }

        return redirect(config('app.frontend_url', '/') . '/login?error=oauth_failed');
    }

    private function oauthAccountBlockedRedirect(string $status)
    {
        $error = $status === User::ACCOUNT_BANNED ? 'account_banned' : 'account_suspended';

        if (session()->pull('google_oauth_target') === 'mobile') {
            $mobileRedirect = session()->pull(
                'google_oauth_mobile_redirect',
                config('services.google.mobile_redirect', 'charbookreact://auth/callback')
            );

            return redirect($this->appendQuery($mobileRedirect, ['error' => $error]));
        }

        $frontend = rtrim(config('app.frontend_url', config('app.url')), '/');
        return redirect("{$frontend}/login?error={$error}");
    }

    private function mobileRedirectUri(Request $request): string
    {
        $configured = config('services.google.mobile_redirect', 'charbookreact://auth/callback');
        $requested = $request->query('redirect_uri');

        if (! is_string($requested) || $requested === '') {
            return $configured;
        }

        $parts = parse_url($requested);
        $scheme = $parts['scheme'] ?? null;
        $path = $parts['path'] ?? '';

        if ($scheme === 'charbookreact' && str_starts_with($requested, 'charbookreact://auth/callback')) {
            return $requested;
        }

        if (in_array($scheme, ['exp', 'exps'], true) && str_ends_with($path, '/--/auth/callback')) {
            $requestedHost = $parts['host'] ?? null;
            $apiHost = $request->getHost();

            if ($requestedHost === $apiHost || in_array($requestedHost, ['localhost', '127.0.0.1'], true)) {
                return $requested;
            }
        }

        return $configured;
    }

    private function googleCallbackUrl(Request $request): string
    {
        $configured = trim((string) config('services.google.callback_url', ''));

        if ($configured !== '') {
            $scheme = parse_url($configured, PHP_URL_SCHEME);
            if (! filter_var($configured, FILTER_VALIDATE_URL)
                || (app()->environment('production') && $scheme !== 'https')) {
                abort(503, 'Google OAuth callback is not configured securely.');
            }

            return $configured;
        }

        if (app()->environment('production')) {
            $redirect = trim((string) config('services.google.redirect', ''));
            if (! filter_var($redirect, FILTER_VALIDATE_URL)
                || parse_url($redirect, PHP_URL_SCHEME) !== 'https') {
                abort(503, 'Google OAuth callback is not configured securely.');
            }

            return $redirect;
        }

        return $request->getSchemeAndHttpHost().'/auth/google/callback';
    }

    private function appendQuery(string $url, array $params): string
    {
        $separator = str_contains($url, '?') ? '&' : '?';

        return $url . $separator . http_build_query($params);
    }
}

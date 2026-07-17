<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Presencia en vivo ("usuarios online").
 *
 * El frontend manda un heartbeat POST /api/presence/ping cada ~60s mientras
 * la pestaña está visible:
 *  - Usuario autenticado → users.last_seen_at (solo si tiene >60s de antigüedad,
 *    para no escribir en cada ping).
 *  - Visitante anónimo   → mapa en cache con su visitor_key (TTL 5 min).
 */
class PresenceController extends Controller
{
    public const GUESTS_CACHE_KEY = 'presence:guests';
    public const GUEST_TTL_SECONDS = 300;

    public function ping(Request $request): JsonResponse
    {
        $data = $request->validate([
            'visitor_key' => ['nullable', 'string', 'max:64'],
        ]);

        $user = $request->user('sanctum');

        if ($user) {
            // Escritura perezosa: máximo una vez por minuto por usuario.
            if (! $user->last_seen_at || $user->last_seen_at->lt(now()->subMinute())) {
                DB::table('users')->where('id', $user->id)->update(['last_seen_at' => now()]);
            }
        } elseif (! empty($data['visitor_key'])) {
            $this->registerGuest($data['visitor_key']);
        }

        return response()->json(['ok' => true]);
    }

    private function registerGuest(string $key): void
    {
        try {
            $now = now()->timestamp;
            /** @var array<string,int> $guests */
            $guests = Cache::get(self::GUESTS_CACHE_KEY, []);

            // Prune de visitantes expirados + registrar este.
            $guests = array_filter(
                $guests,
                fn ($ts) => ($now - (int) $ts) < self::GUEST_TTL_SECONDS
            );
            $guests[substr(sha1($key), 0, 16)] = $now;

            // Tope defensivo para que el payload de cache no crezca sin límite.
            if (count($guests) > 2000) {
                arsort($guests);
                $guests = array_slice($guests, 0, 2000, true);
            }

            Cache::put(self::GUESTS_CACHE_KEY, $guests, self::GUEST_TTL_SECONDS * 2);
        } catch (\Throwable) {
            // La presencia es best-effort: nunca debe romper un request.
        }
    }

    /** Nº de visitantes anónimos activos (últimos 5 min). */
    public static function guestsOnline(): int
    {
        try {
            $now = now()->timestamp;
            $guests = Cache::get(self::GUESTS_CACHE_KEY, []);

            return count(array_filter(
                $guests,
                fn ($ts) => ($now - (int) $ts) < self::GUEST_TTL_SECONDS
            ));
        } catch (\Throwable) {
            return 0;
        }
    }
}

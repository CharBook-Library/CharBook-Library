<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Registro de auditoría administrativa.
 *
 * Toda acción sensible de staff (moderar obra, resolver reporte, cambiar
 * roles, tocar la cola, vaciar logs…) queda registrada con quién, qué,
 * sobre qué, cuándo, desde qué IP y por qué.
 *
 * Reglas:
 *  - NUNCA guarda contraseñas, tokens ni secretos (sanitización por clave).
 *  - Best-effort: si la auditoría falla, la acción original NO se rompe.
 */
class AuditLogger
{
    /** Claves cuyo valor jamás se persiste. */
    private const SENSITIVE_KEYS = [
        'password', 'password_confirmation', 'current_password',
        'token', 'access_token', 'refresh_token', 'secret', 'api_key',
        'key', 'authorization', 'cookie', 'remember_token',
    ];

    public static function log(
        Request $request,
        string $action,
        ?string $entityType = null,
        int|string|null $entityId = null,
        ?string $entityLabel = null,
        ?string $reason = null,
        ?array $before = null,
        ?array $after = null,
    ): void {
        try {
            DB::table('admin_audit_logs')->insert([
                'admin_id' => $request->user()?->id,
                'action' => mb_substr($action, 0, 80),
                'entity_type' => $entityType ? mb_substr($entityType, 0, 40) : null,
                'entity_id' => $entityId !== null ? (int) $entityId : null,
                'entity_label' => $entityLabel ? mb_substr($entityLabel, 0, 200) : null,
                'reason' => $reason ? mb_substr($reason, 0, 2000) : null,
                'changes' => ($before !== null || $after !== null)
                    ? json_encode([
                        'before' => $before !== null ? self::sanitize($before) : null,
                        'after' => $after !== null ? self::sanitize($after) : null,
                    ], JSON_UNESCAPED_UNICODE)
                    : null,
                'ip' => $request->ip(),
                'created_at' => now(),
            ]);
        } catch (\Throwable) {
            // La auditoría nunca debe tumbar la acción original.
        }
    }

    /** Registra una transición automática sin atribuirla a un administrador. */
    public static function logSystem(
        string $action,
        ?string $entityType = null,
        int|string|null $entityId = null,
        ?string $entityLabel = null,
        ?string $reason = null,
        ?array $before = null,
        ?array $after = null,
    ): void {
        try {
            DB::table('admin_audit_logs')->insert([
                'admin_id' => null,
                'action' => mb_substr($action, 0, 80),
                'entity_type' => $entityType ? mb_substr($entityType, 0, 40) : null,
                'entity_id' => $entityId !== null ? (int) $entityId : null,
                'entity_label' => $entityLabel ? mb_substr($entityLabel, 0, 200) : null,
                'reason' => $reason ? mb_substr($reason, 0, 2000) : null,
                'changes' => ($before !== null || $after !== null)
                    ? json_encode([
                        'before' => $before !== null ? self::sanitize($before) : null,
                        'after' => $after !== null ? self::sanitize($after) : null,
                    ], JSON_UNESCAPED_UNICODE)
                    : null,
                'ip' => null,
                'created_at' => now(),
            ]);
        } catch (\Throwable) {
            // Best-effort, igual que la auditoría iniciada por un request.
        }
    }

    /** Elimina claves sensibles y recorta valores largos. */
    private static function sanitize(array $data): array
    {
        $clean = [];
        foreach ($data as $key => $value) {
            $lower = strtolower((string) $key);
            foreach (self::SENSITIVE_KEYS as $sensitive) {
                if (str_contains($lower, $sensitive)) {
                    $clean[$key] = '***';
                    continue 2;
                }
            }
            if (is_array($value)) {
                $clean[$key] = self::sanitize($value);
            } elseif (is_string($value) && mb_strlen($value) > 500) {
                $clean[$key] = mb_substr($value, 0, 500) . '…';
            } else {
                $clean[$key] = $value;
            }
        }

        return $clean;
    }
}

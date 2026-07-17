<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AccountStatusService
{
    public function effectiveStatus(User $user): string
    {
        if ($user->account_status === User::ACCOUNT_SUSPENDED
            && $user->account_status_expires_at?->isPast()) {
            $this->reactivateExpiredSuspension($user);
        }

        return $user->fresh()->account_status ?? User::ACCOUNT_ACTIVE;
    }

    public function blockedResponse(User $user): ?JsonResponse
    {
        $status = $this->effectiveStatus($user);
        if ($status === User::ACCOUNT_ACTIVE) {
            return null;
        }

        $message = match ($status) {
            User::ACCOUNT_BANNED => 'Esta cuenta fue inhabilitada. Contacta a soporte si consideras que es un error.',
            User::ACCOUNT_SUSPENDED => $user->account_status_expires_at
                ? 'Esta cuenta esta suspendida temporalmente.'
                : 'Esta cuenta esta suspendida hasta nuevo aviso.',
            default => '',
        };

        return response()->json([
            'message' => $message,
            'code' => $status === User::ACCOUNT_BANNED ? 'ACCOUNT_BANNED' : 'ACCOUNT_SUSPENDED',
            'account_status' => $status,
            'suspended_until' => $status === User::ACCOUNT_SUSPENDED
                ? $user->fresh()->account_status_expires_at?->toIso8601String()
                : null,
        ], 423);
    }

    public function changeStatus(
        Request $request,
        User $actor,
        User $target,
        string $status,
        string $reason,
        ?\DateTimeInterface $expiresAt = null,
    ): User {
        abort_unless($actor->hasRole('super_admin'), 403, 'Solo un super administrador puede cambiar el estado de una cuenta.');

        if (! in_array($status, User::ACCOUNT_STATUSES, true)) {
            throw ValidationException::withMessages(['status' => ['Estado de cuenta no permitido.']]);
        }

        if ($status !== User::ACCOUNT_ACTIVE && $actor->is($target)) {
            throw ValidationException::withMessages(['status' => ['No puedes suspender o inhabilitar tu propia cuenta.']]);
        }

        if ($status === User::ACCOUNT_SUSPENDED
            && $expiresAt !== null
            && $expiresAt <= now()) {
            throw ValidationException::withMessages([
                'suspended_until' => ['La suspension necesita una fecha futura.'],
            ]);
        }

        return DB::transaction(function () use ($request, $actor, $target, $status, $reason, $expiresAt): User {
            $locked = User::query()->lockForUpdate()->findOrFail($target->id);
            $current = $this->statusWithoutWriting($locked);

            if ($current === $status) {
                throw ValidationException::withMessages(['status' => ['La cuenta ya tiene ese estado.']]);
            }

            if ($status !== User::ACCOUNT_ACTIVE && $locked->hasRole('super_admin')) {
                $activeSuperAdmins = User::query()
                    ->whereHas('roles', fn ($query) => $query->where('name', 'super_admin'))
                    ->where(function ($query) {
                        $query->where('account_status', User::ACCOUNT_ACTIVE)
                            ->orWhere(function ($expired) {
                                $expired->where('account_status', User::ACCOUNT_SUSPENDED)
                                    ->whereNotNull('account_status_expires_at')
                                    ->where('account_status_expires_at', '<=', now());
                            });
                    })
                    ->count();

                if ($activeSuperAdmins <= 1) {
                    throw ValidationException::withMessages([
                        'status' => ['No puedes bloquear al ultimo super administrador activo.'],
                    ]);
                }
            }

            $before = $this->snapshot($locked);
            $locked->forceFill([
                'account_status' => $status,
                'account_status_reason' => $status === User::ACCOUNT_ACTIVE ? null : $reason,
                'account_status_changed_at' => now(),
                'account_status_expires_at' => $status === User::ACCOUNT_SUSPENDED ? $expiresAt : null,
                'account_status_changed_by' => $actor->id,
            ])->save();

            // Invalida de inmediato todas las sesiones API activas.
            $locked->tokens()->delete();

            $this->notifyStatusChange($locked, $status, $expiresAt);

            AuditLogger::log(
                $request,
                $status === User::ACCOUNT_ACTIVE ? 'user.account_reactivated' : 'user.account_restricted',
                entityType: 'user',
                entityId: $locked->id,
                entityLabel: $locked->name,
                reason: $reason,
                before: $before,
                after: $this->snapshot($locked),
            );

            return $locked->fresh(['roles:id,name', 'accountStatusChangedBy:id,name']);
        });
    }

    /** @return array<string,mixed> */
    public function snapshot(User $user): array
    {
        return [
            'account_status' => $this->statusWithoutWriting($user),
            'account_status_changed_at' => $user->account_status_changed_at?->toIso8601String(),
            'account_status_expires_at' => $user->account_status_expires_at?->toIso8601String(),
            'account_status_changed_by' => $user->account_status_changed_by,
        ];
    }

    private function statusWithoutWriting(User $user): string
    {
        if ($user->account_status === User::ACCOUNT_SUSPENDED
            && $user->account_status_expires_at?->isPast()) {
            return User::ACCOUNT_ACTIVE;
        }

        return $user->account_status ?? User::ACCOUNT_ACTIVE;
    }

    private function reactivateExpiredSuspension(User $user): void
    {
        DB::transaction(function () use ($user): void {
            $locked = User::query()->lockForUpdate()->find($user->id);
            if (! $locked
                || $locked->account_status !== User::ACCOUNT_SUSPENDED
                || ! $locked->account_status_expires_at?->isPast()) {
                return;
            }

            $before = $this->snapshot($locked);
            $locked->forceFill([
                'account_status' => User::ACCOUNT_ACTIVE,
                'account_status_reason' => null,
                'account_status_changed_at' => now(),
                'account_status_expires_at' => null,
                'account_status_changed_by' => null,
            ])->save();

            AuditLogger::logSystem(
                'user.suspension_expired',
                entityType: 'user',
                entityId: $locked->id,
                entityLabel: $locked->name,
                reason: 'La suspension temporal vencio.',
                before: $before,
                after: $this->snapshot($locked),
            );
        });
    }

    private function notifyStatusChange(User $user, string $status, ?\DateTimeInterface $expiresAt): void
    {
        [$title, $body] = match ($status) {
            User::ACCOUNT_ACTIVE => [
                'Cuenta reactivada',
                'Tu acceso a CharBook Library fue restablecido.',
            ],
            User::ACCOUNT_BANNED => [
                'Cuenta inhabilitada',
                'Tu acceso fue inhabilitado. Contacta a soporte para solicitar una revision.',
            ],
            default => [
                'Cuenta suspendida',
                'Tu acceso fue suspendido hasta '.($expiresAt?->format('Y-m-d H:i T') ?? 'nuevo aviso').'.',
            ],
        };

        Notification::create([
            'user_id' => $user->id,
            'category' => 'system',
            'type' => 'account_status',
            'emoji' => null,
            'title' => $title,
            'body' => $body,
            'link' => null,
            'data' => ['status' => $status],
        ]);
    }
}

<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Registro de auditoría administrativa — SOLO super_admin.
 * Los logs se escriben vía App\Services\AuditLogger; aquí se leen y se
 * mantienen (borrado selectivo, purga por antigüedad o vaciado total).
 * Todo borrado queda RE-AUDITADO después de ejecutarse, así el registro
 * nunca pierde el rastro de quién lo limpió.
 */
class AuditLogController extends Controller
{
    private function assertSuperAdmin(Request $request): void
    {
        abort_unless(
            $request->user()?->hasRole('super_admin'),
            403,
            'Solo el super administrador puede administrar la auditoría.'
        );
    }
    public function index(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()?->hasRole('super_admin'),
            403,
            'Solo el super administrador puede ver la auditoría.'
        );

        $filters = $request->validate([
            'action' => ['nullable', 'string', 'max:80'],
            'admin_id' => ['nullable', 'integer', 'min:1'],
            'entity_type' => ['nullable', 'string', 'max:40'],
            'search' => ['nullable', 'string', 'max:200'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $query = DB::table('admin_audit_logs as l')
            ->leftJoin('users as u', 'u.id', '=', 'l.admin_id')
            ->orderByDesc('l.created_at')
            ->select([
                'l.id', 'l.action', 'l.entity_type', 'l.entity_id', 'l.entity_label',
                'l.reason', 'l.changes', 'l.ip', 'l.created_at',
                'u.id as admin_user_id', 'u.name as admin_name',
                'u.username as admin_username', 'u.avatar as admin_avatar',
            ]);

        if ($action = trim((string) ($filters['action'] ?? ''))) {
            $query->whereRaw(
                "LOWER(l.action) LIKE ? ESCAPE '!'",
                [$this->likePattern($action) . '%']
            );
        }
        if (isset($filters['admin_id'])) {
            $query->where('l.admin_id', $filters['admin_id']);
        }
        if ($entityType = $filters['entity_type'] ?? null) {
            $query->where('l.entity_type', $entityType);
        }
        if ($search = trim((string) ($filters['search'] ?? ''))) {
            $like = '%' . $this->likePattern($search) . '%';
            $query->where(fn ($q) => $q
                ->whereRaw("LOWER(l.entity_label) LIKE ? ESCAPE '!'", [$like])
                ->orWhereRaw("LOWER(l.reason) LIKE ? ESCAPE '!'", [$like])
                ->orWhereRaw("LOWER(l.action) LIKE ? ESCAPE '!'", [$like]));
        }
        if ($from = $filters['from'] ?? null) {
            $query->where('l.created_at', '>=', $from . ' 00:00:00');
        }
        if ($to = $filters['to'] ?? null) {
            $query->where('l.created_at', '<=', $to . ' 23:59:59');
        }

        $page = $query->paginate(30)->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn ($l) => [
                'id' => $l->id,
                'action' => $l->action,
                'entity_type' => $l->entity_type,
                'entity_id' => $l->entity_id,
                'entity_label' => $l->entity_label,
                'reason' => $l->reason,
                'changes' => $l->changes ? json_decode($l->changes, true) : null,
                'ip' => $l->ip,
                'created_at' => $l->created_at,
                'admin' => $l->admin_user_id ? [
                    'id' => $l->admin_user_id,
                    'name' => $l->admin_name,
                    'username' => $l->admin_username,
                    'avatar' => $l->admin_avatar,
                ] : null,
            ])->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    /** Lista de acciones distintas (para el filtro del frontend). */
    public function actions(Request $request): JsonResponse
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403);

        return response()->json([
            'data' => DB::table('admin_audit_logs')
                ->select('action')->distinct()->orderBy('action')
                ->pluck('action'),
        ]);
    }

    // ─────────────────────────── Mantenimiento ───────────────────────────

    /** DELETE /api/admin/audit-logs — elimina entradas seleccionadas por id. */
    public function destroySelected(Request $request): JsonResponse
    {
        $this->assertSuperAdmin($request);

        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:500'],
            'ids.*' => ['integer', 'min:1'],
        ]);

        $deleted = DB::table('admin_audit_logs')
            ->whereIn('id', $data['ids'])
            ->delete();

        AuditLogger::log(
            $request,
            'audit.delete_selected',
            entityType: 'audit_log',
            reason: "{$deleted} entrada(s) de auditoría eliminadas manualmente",
        );

        return response()->json([
            'message' => "{$deleted} entrada(s) de auditoría eliminadas.",
            'deleted' => $deleted,
        ]);
    }

    /**
     * DELETE /api/admin/audit-logs/older-than/{days} — purga por antigüedad.
     * La opción de retención: limpia lo viejo sin perder lo reciente.
     */
    public function purgeOlderThan(Request $request, int $days): JsonResponse
    {
        $this->assertSuperAdmin($request);

        abort_unless($days >= 7 && $days <= 365, 422, 'La antigüedad debe estar entre 7 y 365 días.');

        $cutoff = now()->subDays($days);
        $deleted = DB::table('admin_audit_logs')
            ->where('created_at', '<', $cutoff)
            ->delete();

        AuditLogger::log(
            $request,
            'audit.purge_old',
            entityType: 'audit_log',
            reason: "Purga de auditoría: {$deleted} entrada(s) anteriores a {$days} días eliminadas",
        );

        return response()->json([
            'message' => $deleted > 0
                ? "{$deleted} entrada(s) con más de {$days} días eliminadas."
                : "No había entradas con más de {$days} días.",
            'deleted' => $deleted,
        ]);
    }

    /** DELETE /api/admin/audit-logs/all — vacía el registro completo. */
    public function destroyAll(Request $request): JsonResponse
    {
        $this->assertSuperAdmin($request);

        // Confirmación explícita en el body: evita vaciar por un click accidental.
        $request->validate(['confirm' => ['required', 'in:ELIMINAR_AUDITORIA']]);

        $deleted = DB::table('admin_audit_logs')->delete();

        AuditLogger::log(
            $request,
            'audit.delete_all',
            entityType: 'audit_log',
            reason: "Registro de auditoría vaciado por completo ({$deleted} entradas)",
        );

        return response()->json([
            'message' => "Registro de auditoría vaciado ({$deleted} entradas).",
            'deleted' => $deleted,
        ]);
    }

    private function likePattern(string $value): string
    {
        return str_replace(
            ['!', '%', '_'],
            ['!!', '!%', '!_'],
            mb_strtolower($value)
        );
    }
}

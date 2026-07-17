<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ReportResource;
use App\Models\Report;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ReportController extends Controller
{
    /**
     * GET /api/admin/reports
     * Filtros: status (default 'open'), target_type, reason
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in([
                'all',
                Report::STATUS_OPEN,
                Report::STATUS_IN_REVIEW,
                Report::STATUS_RESOLVED,
                Report::STATUS_DISMISSED,
            ])],
            'target_type' => ['nullable', Rule::in(Report::TARGET_TYPES)],
            'reason' => ['nullable', Rule::in(Report::REASONS)],
        ]);

        $query = Report::query()->with(['reporter:id,name,username,avatar', 'resolver:id,name']);

        $status = $filters['status'] ?? Report::STATUS_OPEN;
        if ($status !== 'all') {
            $query->where('status', $status);
        }

        if ($type = $filters['target_type'] ?? null) {
            $query->where('target_type', $type);
        }

        if ($reason = $filters['reason'] ?? null) {
            $query->where('reason', $reason);
        }

        // open primero más antiguos (más urgente); resto recientes
        if ($status === 'open') {
            $query->orderBy('created_at');
        } else {
            $query->latest('created_at');
        }

        $reports = $query->paginate(30)->withQueryString();
        return ReportResource::collection($reports)->response();
    }

    /**
     * GET /api/admin/reports/{report}
     * Detalle con datos del target embebidos.
     */
    public function show(Report $report): JsonResponse
    {
        $report->load(['reporter', 'resolver']);

        $target = $report->target();
        $targetData = $target ? [
            'type' => $report->target_type,
            'id' => $report->target_id,
            'preview' => $this->buildPreview($report->target_type, $target),
        ] : null;

        return response()->json([
            'data' => new ReportResource($report),
            'target' => $targetData,
        ]);
    }

    /**
     * PATCH /api/admin/reports/{report}/resolve
     *
     * Centro de Moderación: la acción se EJECUTA de verdad (ocultar
     * contenido, advertir al usuario, eliminar) y queda en auditoría.
     * Toda resolución exige motivo.
     */
    public function resolve(Request $request, Report $report): JsonResponse
    {
        $data = $request->validate([
            'resolution_action' => 'required|in:' . implode(',', Report::RESOLUTION_ACTIONS),
            'resolution_notes' => 'required|string|min:5|max:2000',
        ], [
            'resolution_notes.required' => 'Escribe el motivo de la resolución.',
            'resolution_notes.min' => 'El motivo debe tener al menos 5 caracteres.',
        ]);

        [$report, $effect] = DB::transaction(function () use ($report, $data, $request): array {
            $lockedReport = Report::query()->lockForUpdate()->findOrFail($report->id);

            if (in_array($lockedReport->status, [Report::STATUS_RESOLVED, Report::STATUS_DISMISSED], true)) {
                throw ValidationException::withMessages([
                    'report' => 'Este reporte ya fue cerrado.',
                ]);
            }

            $effect = $this->executeAction(
                $lockedReport,
                $data['resolution_action'],
                $data['resolution_notes']
            );

            if (in_array($data['resolution_action'], ['warn', 'hide', 'delete'], true)
                && ! $effect['executed']) {
                throw ValidationException::withMessages([
                    'resolution_action' => $effect['message'],
                ]);
            }

            $lockedReport->update([
                'status' => Report::STATUS_RESOLVED,
                'resolved_by_id' => $request->user()->id,
                'resolution_action' => $data['resolution_action'],
                'resolution_notes' => $data['resolution_notes'],
                'resolved_at' => now(),
            ]);

            return [$lockedReport, $effect];
        });

        \App\Services\AuditLogger::log(
            $request,
            'report.resolve',
            entityType: $report->target_type,
            entityId: $report->target_id,
            entityLabel: "Reporte #{$report->id} → {$data['resolution_action']}",
            reason: $data['resolution_notes'],
            after: ['effect' => $effect['message'], 'executed' => $effect['executed']],
        );

        $report->load(['reporter', 'resolver']);

        return response()->json([
            'data' => new ReportResource($report),
            'effect' => $effect,
        ]);
    }

    /**
     * PATCH /api/admin/reports/{report}/dismiss
     */
    public function dismiss(Request $request, Report $report): JsonResponse
    {
        $data = $request->validate([
            'resolution_notes' => 'nullable|string|max:2000',
        ]);

        $report = DB::transaction(function () use ($report, $request, $data): Report {
            $lockedReport = Report::query()->lockForUpdate()->findOrFail($report->id);

            if (in_array($lockedReport->status, [Report::STATUS_RESOLVED, Report::STATUS_DISMISSED], true)) {
                throw ValidationException::withMessages([
                    'report' => 'Este reporte ya fue cerrado.',
                ]);
            }

            $lockedReport->update([
                'status' => Report::STATUS_DISMISSED,
                'resolved_by_id' => $request->user()->id,
                'resolution_action' => 'none',
                'resolution_notes' => $data['resolution_notes'] ?? null,
                'resolved_at' => now(),
            ]);

            return $lockedReport;
        });

        \App\Services\AuditLogger::log(
            $request,
            'report.dismiss',
            entityType: $report->target_type,
            entityId: $report->target_id,
            entityLabel: "Reporte #{$report->id}",
            reason: $data['resolution_notes'] ?? null,
        );

        $report->load(['reporter', 'resolver']);
        return (new ReportResource($report))->response();
    }

    /**
     * Ejecuta el efecto REAL de la acción de moderación.
     *
     * @return array{executed: bool, message: string}
     */
    private function executeAction(Report $report, string $action, string $reason): array
    {
        $target = $report->target();

        if ($action === 'none') {
            return ['executed' => true, 'message' => 'Resuelto sin acción sobre el contenido.'];
        }

        if (! $target) {
            return ['executed' => false, 'message' => 'El contenido reportado ya no existe.'];
        }

        try {
            return match ($action) {
                'warn' => $this->warnOwner($target, $report, $reason),
                'hide' => $this->hideTarget($target, $report),
                'delete' => $this->deleteTarget($target, $report),
                // La suspensión/baneo de cuentas aún no tiene sistema propio
                // (campos + gate de login). Se registra la decisión, pero la
                // ejecución es manual — NO fingimos que ocurrió.
                'suspend_temp', 'suspend_perm', 'ban' => [
                    'executed' => false,
                    'message' => 'Decisión registrada. La suspensión de cuentas todavía se aplica manualmente (pendiente de implementar).',
                ],
                default => ['executed' => false, 'message' => 'Acción desconocida.'],
            };
        } catch (\Throwable $e) {
            report($e);

            return ['executed' => false, 'message' => 'No se pudo aplicar la acción de moderación.'];
        }
    }

    /** Notifica una advertencia formal al dueño del contenido reportado. */
    private function warnOwner($target, Report $report, string $reason): array
    {
        $owner = $this->ownerOf($target, $report->target_type);
        if (! $owner) {
            return ['executed' => false, 'message' => 'No se encontró al dueño del contenido.'];
        }

        \App\Models\Notification::create([
            'user_id' => $owner->id,
            'category' => 'system',
            'type' => 'moderation_warning',
            'emoji' => '⚠️',
            'title' => 'Advertencia de moderación',
            'body' => "Tu contenido fue reportado y el equipo emitió una advertencia: {$reason}",
            'link' => null,
            'data' => ['report_id' => $report->id, 'target_type' => $report->target_type],
        ]);

        return ['executed' => true, 'message' => "Advertencia enviada a {$owner->name}."];
    }

    /** Oculta el contenido (obra → hidden; comentario/reseña → eliminado). */
    private function hideTarget($target, Report $report): array
    {
        if ($target instanceof \App\Models\Book) {
            $target->forceFill([
                'is_hidden' => true,
                'is_published' => false,
                'hidden_at' => now(),
            ])->save();

            return ['executed' => true, 'message' => "Obra «{$target->title}» ocultada del catálogo."];
        }
        if ($target instanceof \App\Models\Comment) {
            $target->delete();
            return ['executed' => true, 'message' => 'Comentario eliminado.'];
        }
        if ($target instanceof \App\Models\Review) {
            $target->delete();
            return ['executed' => true, 'message' => 'Reseña eliminada.'];
        }
        if ($target instanceof \App\Models\User) {
            return ['executed' => false, 'message' => 'Un usuario no puede "ocultarse": usa advertir o escala el caso.'];
        }

        return ['executed' => false, 'message' => 'Este tipo de contenido no soporta ocultado.'];
    }

    /** Elimina el contenido reportado (soft-delete cuando el modelo lo soporta). */
    private function deleteTarget($target, Report $report): array
    {
        if ($target instanceof \App\Models\User) {
            return ['executed' => false, 'message' => 'Las cuentas no se eliminan desde reportes: gestión en Usuarios.'];
        }

        $label = $target instanceof \App\Models\Book ? "«{$target->title}»" : class_basename($target);
        $target->delete();

        return ['executed' => true, 'message' => "Contenido {$label} eliminado."];
    }

    /** Dueño del contenido según el tipo de target. */
    private function ownerOf($target, string $type): ?\App\Models\User
    {
        return match ($type) {
            'user' => $target,
            'book', 'work' => $target->creator_id ? \App\Models\User::find($target->creator_id) : null,
            'review', 'comment' => $target->user_id ? \App\Models\User::find($target->user_id) : null,
            default => null,
        };
    }

    /**
     * Construye un preview cortito del contenido reportado.
     */
    private function buildPreview(string $type, $target): array
    {
        return match ($type) {
            'book' => [
                'title' => $target->title,
                'slug' => $target->slug,
                'cover' => $target->cover ?? null,
            ],
            'user' => [
                'name' => $target->name,
                'username' => $target->username,
                'avatar' => $target->avatar,
            ],
            'review' => [
                'rating' => $target->rating,
                'title' => $target->title,
                'excerpt' => mb_substr($target->comment ?? '', 0, 200),
            ],
            default => ['raw' => $target->toArray()],
        };
    }
}

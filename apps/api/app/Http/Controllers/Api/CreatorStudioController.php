<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\Chapter;
use App\Models\Comment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Panel "Studio" del creador: estadísticas, bandeja de comentarios
 * y lista de seguidores. Todo scoped al usuario autenticado.
 */
class CreatorStudioController extends Controller
{
    /**
     * GET /api/me/creator/stats
     * KPIs agregados + desglose por obra.
     */
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();

        $works = Book::query()
            ->where('creator_id', $user->id)
            ->withCount('chapters')
            ->orderByDesc('views_count')
            ->get([
                'id', 'title', 'slug', 'cover_url', 'cover_path', 'work_format',
                'submission_status', 'is_published', 'views_count',
                'total_readings_count', 'favorites_count',
                'rating_average', 'rating_count', 'created_at',
            ]);

        $bookIds = $works->pluck('id');
        $chapterIds = Chapter::whereIn('book_id', $bookIds)->select('id');

        $commentsCount = Comment::query()
            ->where(function ($q) use ($bookIds, $chapterIds) {
                $q->where(fn ($qq) => $qq
                    ->where('commentable_type', Book::class)
                    ->whereIn('commentable_id', $bookIds))
                  ->orWhere(fn ($qq) => $qq
                    ->where('commentable_type', Chapter::class)
                    ->whereIn('commentable_id', $chapterIds));
            })
            ->count();

        $ratingWeighted = $works->sum(fn ($w) => (float) $w->rating_average * (int) $w->rating_count);
        $ratingCountTotal = (int) $works->sum('rating_count');

        return response()->json([
            'data' => [
                'totals' => [
                    'works' => $works->count(),
                    'published' => $works->where('submission_status', 'published')->count(),
                    'drafts' => $works->where('submission_status', 'draft')->count(),
                    'in_review' => $works->where('submission_status', 'review')->count(),
                    'views' => (int) $works->sum('views_count'),
                    'readings' => (int) $works->sum('total_readings_count'),
                    'favorites' => (int) $works->sum('favorites_count'),
                    'comments' => $commentsCount,
                    'followers' => $user->followers()->count(),
                    'rating_average' => $ratingCountTotal > 0
                        ? round($ratingWeighted / $ratingCountTotal, 2)
                        : 0,
                    'rating_count' => $ratingCountTotal,
                ],
                'works' => $works->map(fn (Book $w) => [
                    'id' => $w->id,
                    'title' => $w->title,
                    'slug' => $w->slug,
                    'cover' => $w->cover,
                    'work_format' => $w->work_format,
                    'submission_status' => $w->submission_status,
                    'chapters_count' => (int) $w->chapters_count,
                    'views' => (int) $w->views_count,
                    'readings' => (int) $w->total_readings_count,
                    'favorites' => (int) $w->favorites_count,
                    'rating_average' => (float) $w->rating_average,
                    'rating_count' => (int) $w->rating_count,
                    'created_at' => $w->created_at?->toIso8601String(),
                ])->values(),
            ],
        ]);
    }

    /**
     * GET /api/me/creator/comments
     * Bandeja unificada: comentarios sobre MIS obras y sus capítulos.
     * Filtros: work_id, sort (newest|top).
     */
    public function comments(Request $request): JsonResponse
    {
        $user = $request->user();

        $bookIds = Book::where('creator_id', $user->id)->pluck('id');
        if ($request->filled('work_id')) {
            $bookIds = $bookIds->intersect([(int) $request->query('work_id')])->values();
        }
        $chapterIds = Chapter::whereIn('book_id', $bookIds)->select('id');

        $query = Comment::query()
            ->with('user:id,name,username,avatar,creator_level')
            ->where(function ($q) use ($bookIds, $chapterIds) {
                $q->where(fn ($qq) => $qq
                    ->where('commentable_type', Book::class)
                    ->whereIn('commentable_id', $bookIds))
                  ->orWhere(fn ($qq) => $qq
                    ->where('commentable_type', Chapter::class)
                    ->whereIn('commentable_id', $chapterIds));
            });

        $query = $request->query('sort') === 'top'
            ? $query->orderByDesc('likes_count')->orderByDesc('created_at')
            : $query->orderByDesc('created_at');

        $page = $query->paginate(20)->withQueryString();

        // Cargar destinos (obra o capítulo) en bloque para no hacer N+1.
        $items = $page->getCollection();
        $bookTargets = Book::whereIn('id', $items->where('commentable_type', Book::class)->pluck('commentable_id'))
            ->get(['id', 'title', 'slug'])->keyBy('id');
        $chapterTargets = Chapter::with('book:id,title,slug')
            ->whereIn('id', $items->where('commentable_type', Chapter::class)->pluck('commentable_id'))
            ->get(['id', 'book_id', 'number', 'title'])->keyBy('id');

        $data = $items->map(function (Comment $c) use ($bookTargets, $chapterTargets) {
            $target = null;
            if ($c->commentable_type === Book::class) {
                $b = $bookTargets->get($c->commentable_id);
                if ($b) {
                    $target = [
                        'type' => 'book',
                        'book_title' => $b->title,
                        'book_slug' => $b->slug,
                        'chapter_number' => null,
                        'chapter_title' => null,
                    ];
                }
            } else {
                $ch = $chapterTargets->get($c->commentable_id);
                if ($ch) {
                    $target = [
                        'type' => 'chapter',
                        'book_title' => $ch->book?->title,
                        'book_slug' => $ch->book?->slug,
                        'chapter_number' => $ch->number,
                        'chapter_title' => $ch->title,
                    ];
                }
            }

            return [
                'id' => $c->id,
                'body' => $c->body,
                'is_spoiler' => (bool) $c->is_spoiler,
                'is_reply' => $c->parent_id !== null,
                'likes_count' => (int) $c->likes_count,
                'replies_count' => (int) $c->replies_count,
                'created_at' => $c->created_at?->toIso8601String(),
                'user' => $c->user ? [
                    'id' => $c->user->id,
                    'name' => $c->user->name,
                    'username' => $c->user->username,
                    'avatar' => $c->user->avatar,
                    'creator_level' => $c->user->creator_level,
                ] : null,
                'target' => $target,
            ];
        });

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    /**
     * GET /api/me/creator/followers?search=ana&page=1
     * Mis seguidores ordenados por rango:
     * creadores destacados → verificados → resto, y dentro de cada
     * grupo los follows más recientes primero. Búsqueda por nombre/username.
     */
    public function followers(Request $request): JsonResponse
    {
        $me = $request->user();
        $search = trim((string) $request->query('search', ''));
        $page = max(1, (int) $request->query('page', 1));
        $perPage = 24;

        $query = $me->followers()
            ->select('users.*', 'follows.created_at as followed_at')
            ->with('roles:id,name')
            ->withCount(['booksAsCreator as published_books_count' => fn ($q) => $q->where('is_published', true)])
            ->orderByDesc('follows.created_at');

        if ($search !== '') {
            $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $search) . '%';
            $query->where(fn ($q) => $q
                ->where('users.name', 'ILIKE', $like)
                ->orWhere('users.username', 'ILIKE', $like));
        }

        // creator_level es un accessor derivado (tier + rol + obras), así que
        // el orden por rango se resuelve en PHP con las relaciones ya cargadas
        // (sin N+1). Escala bien para el tamaño actual de la plataforma.
        $all = $query->get();

        $idsIFollow = $me->following()
            ->whereIn('users.id', $all->pluck('id'))
            ->pluck('users.id')
            ->flip();

        $level = function ($u): string {
            $explicit = $u->getAttributes()['creator_level'] ?? null;
            if ($explicit && $explicit !== 'none') return $explicit;
            if ($u->creator_tier === 'featured') return 'featured';
            if ($u->creator_status === 'approved' && $u->roles->contains('name', 'creator')) return 'verified';
            if (($u->published_books_count ?? 0) > 0) return 'basic';
            return 'none';
        };
        $priority = ['featured' => 0, 'verified' => 1, 'basic' => 2, 'none' => 3];

        $sorted = $all
            ->map(function ($u) use ($level) {
                $u->resolved_level = $level($u);
                return $u;
            })
            ->sortBy(fn ($u) => $priority[$u->resolved_level] ?? 3)
            ->values();

        $total = $sorted->count();
        $slice = $sorted->slice(($page - 1) * $perPage, $perPage)->values();

        return response()->json([
            'data' => $slice->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'username' => $u->username,
                'avatar' => $u->avatar,
                'bio' => $u->bio,
                'creator_level' => $u->resolved_level,
                'is_following' => $idsIFollow->has($u->id),
                'followed_at' => $u->followed_at,
            ])->values(),
            'meta' => [
                'current_page' => $page,
                'last_page' => max(1, (int) ceil($total / $perPage)),
                'total' => $total,
            ],
        ]);
    }

    /**
     * POST /api/me/creator/followers/{user}/remove
     * Quita a un usuario de MIS seguidores (sin bloquearlo).
     */
    public function removeFollower(Request $request, User $user): JsonResponse
    {
        $me = $request->user();

        $me->followers()->detach($user->id);

        \App\Models\FollowRequest::where('requester_id', $user->id)
            ->where('target_id', $me->id)
            ->whereIn('status', [
                \App\Models\FollowRequest::STATUS_PENDING,
                \App\Models\FollowRequest::STATUS_ACCEPTED,
            ])
            ->update(['status' => \App\Models\FollowRequest::STATUS_CANCELED, 'responded_at' => now()]);

        return response()->json([
            'message' => "{$user->name} ya no te sigue.",
            'followers_count' => $me->followers()->count(),
        ]);
    }

    /**
     * POST /api/me/creator/followers/{user}/block
     * Bloquea a un usuario: deja de seguirte, tú dejas de seguirlo,
     * y no podrá volver a seguirte mientras siga bloqueado.
     */
    public function blockFollower(Request $request, User $user): JsonResponse
    {
        $me = $request->user();

        if ($me->id === $user->id) {
            return response()->json(['message' => 'No puedes bloquearte a ti mismo.'], 422);
        }

        $me->blockedUsers()->syncWithoutDetaching([$user->id]);

        // Romper la relación de follow en ambos sentidos.
        $me->followers()->detach($user->id);
        $me->following()->detach($user->id);

        \App\Models\FollowRequest::where(function ($q) use ($me, $user) {
            $q->where(fn ($qq) => $qq->where('requester_id', $user->id)->where('target_id', $me->id))
              ->orWhere(fn ($qq) => $qq->where('requester_id', $me->id)->where('target_id', $user->id));
        })
            ->whereIn('status', [
                \App\Models\FollowRequest::STATUS_PENDING,
                \App\Models\FollowRequest::STATUS_ACCEPTED,
            ])
            ->update(['status' => \App\Models\FollowRequest::STATUS_CANCELED, 'responded_at' => now()]);

        return response()->json(['message' => "{$user->name} bloqueado."]);
    }

    /**
     * DELETE /api/me/creator/followers/{user}/block
     * Desbloquea a un usuario (podrá volver a seguirte).
     */
    public function unblockFollower(Request $request, User $user): JsonResponse
    {
        $request->user()->blockedUsers()->detach($user->id);

        return response()->json(['message' => "{$user->name} desbloqueado."]);
    }

    /**
     * GET /api/me/creator/blocked
     * Lista de usuarios que he bloqueado.
     */
    public function blocked(Request $request): JsonResponse
    {
        $blocked = $request->user()->blockedUsers()
            ->orderByDesc('user_blocks.created_at')
            ->get(['users.id', 'users.name', 'users.username', 'users.avatar']);

        return response()->json([
            'data' => $blocked->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'username' => $u->username,
                'avatar' => $u->avatar,
                'blocked_at' => $u->pivot?->created_at?->toIso8601String(),
            ])->values(),
        ]);
    }
}

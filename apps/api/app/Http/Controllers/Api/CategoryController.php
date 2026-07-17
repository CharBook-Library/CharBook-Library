<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = Category::withCount(['books' => fn($q) => $q->where('is_published', true)])
            ->orderBy('name')
            ->get();
        return CategoryResource::collection($categories)->response();
    }

    public function show(Category $category): JsonResponse
    {
        $category->loadCount(['books' => fn($q) => $q->where('is_published', true)]);
        return (new CategoryResource($category))->response();
    }

    /**
     * GET /api/categories/hierarchical
     * Devuelve las categorías agrupadas: top-level + sus hijos.
     * Usado por el wizard de creación de obras.
     */
    public function hierarchical(): JsonResponse
    {
        $top = Category::query()
            ->whereNull('parent_id')
            ->orderBy('name')
            ->get(['id', 'name', 'slug']);

        $children = Category::query()
            ->whereNotNull('parent_id')
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'parent_id']);

        $byParent = $children->groupBy('parent_id');

        return response()->json([
            'data' => $top->map(fn ($parent) => [
                'id' => $parent->id,
                'name' => $parent->name,
                'slug' => $parent->slug,
                'children' => ($byParent[$parent->id] ?? collect())
                    ->map(fn ($c) => [
                        'id' => $c->id,
                        'name' => $c->name,
                        'slug' => $c->slug,
                    ])
                    ->values(),
            ]),
        ]);
    }

    // ===== Admin =====

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:100|unique:categories,name',
            'icon' => 'nullable|string|max:50',
            'color' => 'nullable|string|max:7',
            'description' => 'nullable|string',
            // Solo un nivel de anidación: el padre debe ser top-level.
            'parent_id' => 'nullable|integer|exists:categories,id',
        ]);

        if (! empty($data['parent_id'])) {
            $parent = Category::find($data['parent_id']);
            if ($parent?->parent_id !== null) {
                return response()->json([
                    'message' => 'Solo se permite un nivel de subcategorías.',
                ], 422);
            }
        }

        return (new CategoryResource(Category::create($data)))->response()->setStatusCode(201);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:100|unique:categories,name,' . $category->id,
            'icon' => 'nullable|string|max:50',
            'color' => 'nullable|string|max:7',
            'description' => 'nullable|string',
            'parent_id' => 'sometimes|nullable|integer|exists:categories,id',
        ]);

        if (! empty($data['parent_id'])) {
            if ((int) $data['parent_id'] === $category->id) {
                return response()->json(['message' => 'Una categoría no puede ser su propio padre.'], 422);
            }
            $parent = Category::find($data['parent_id']);
            if ($parent?->parent_id !== null) {
                return response()->json([
                    'message' => 'Solo se permite un nivel de subcategorías.',
                ], 422);
            }
            // Si la categoría tiene hijas, no puede convertirse en subcategoría.
            if (Category::where('parent_id', $category->id)->exists()) {
                return response()->json([
                    'message' => 'Esta categoría tiene subcategorías: muévelas primero.',
                ], 422);
            }
        }

        $category->update($data);
        return (new CategoryResource($category))->response();
    }

    public function destroy(Category $category): JsonResponse
    {
        if (Category::where('parent_id', $category->id)->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar: la categoría tiene subcategorías.',
            ], 422);
        }
        $category->delete();
        return response()->json(['message' => 'Categoría eliminada.']);
    }
}

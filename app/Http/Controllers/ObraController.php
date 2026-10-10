<?php

namespace App\Http\Controllers;

use App\Models\Licencia;
use App\Models\Obra;
use Illuminate\Http\Request;

class ObraController extends Controller
{
    public function index(Request $request)
    {
        $busqueda = trim((string) $request->query('buscar', ''));

        $obras = Obra::query()
            ->when($busqueda !== '', function ($query) use ($busqueda) {
                $query->where(function ($query) use ($busqueda) {
                    $query->where('titulo', 'like', "%{$busqueda}%")
                        ->orWhere('autor', 'like', "%{$busqueda}%")
                        ->orWhere('genero', 'like', "%{$busqueda}%");
                });
            })
            ->latest()
            ->get();

        return view('obras.index', compact('obras', 'busqueda'));
    }

    public function create()
    {
        return view('obras.create', [
            'generos' => Obra::GENEROS,
            'idiomas' => Obra::IDIOMAS,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'titulo' => 'required|string|max:255',
            'autor' => 'required|string|max:255',
            'formato' => 'required|in:ebook,audiolibro',
            'sinopsis' => 'required|string|max:1000',
            'genero' => 'required|in:'.implode(',', Obra::GENEROS),
            'idioma' => 'required|in:'.implode(',', Obra::IDIOMAS),
            'duracion' => 'required_if:formato,audiolibro|nullable|integer|min:1',
            'paginas' => 'required_if:formato,ebook|nullable|integer|min:1',
            'portada' => 'nullable|url:http,https|max:2048',
            'precio' => 'sometimes|required|numeric|min:0|max:999999.99',
            'valoracion' => 'nullable|numeric|min:0|max:5',
        ]);

        Obra::create($data);

        return redirect()->route('obras.index')
            ->with('success', 'Obra registrada correctamente.');
    }

    public function show(Request $request, Obra $obra)
    {
        $busqueda = trim((string) $request->query('buscar', ''));
        $adquirida = $request->user()
            ? Licencia::query()
                ->where('user_id', $request->user()->id)
                ->where('obra_id', $obra->id)
                ->where('activa', true)
                ->whereDate('fecha_inicio', '<=', today())
                ->whereDate('fecha_vencimiento', '>=', today())
                ->exists()
            : false;

        return view('obras.show', compact('obra', 'busqueda', 'adquirida'));
    }

    public function edit(Obra $obra)
    {
        return view('obras.edit', [
            'obra' => $obra,
            'generos' => Obra::GENEROS,
            'idiomas' => Obra::IDIOMAS,
        ]);
    }

    public function update(Request $request, Obra $obra)
    {
        $data = $request->validate([
            'titulo' => 'required|string|max:255',
            'autor' => 'required|string|max:255',
            'formato' => 'required|in:ebook,audiolibro',
            'sinopsis' => 'required|string|max:1000',
            'genero' => 'required|in:'.implode(',', Obra::GENEROS),
            'idioma' => 'required|in:'.implode(',', Obra::IDIOMAS),
            'duracion' => 'required_if:formato,audiolibro|nullable|integer|min:1',
            'paginas' => 'required_if:formato,ebook|nullable|integer|min:1',
            'portada' => 'nullable|url:http,https|max:2048',
            'precio' => 'sometimes|required|numeric|min:0|max:999999.99',
            'valoracion' => 'nullable|numeric|min:0|max:5',
        ]);

        $obra->update($data);

        return redirect()->route('obras.show', $obra)
            ->with('success', 'Obra actualizada.');
    }

    public function destroy(Obra $obra)
    {
        $obra->delete();

        return redirect()->route('obras.index')
            ->with('success', 'Obra eliminada.');
    }
}

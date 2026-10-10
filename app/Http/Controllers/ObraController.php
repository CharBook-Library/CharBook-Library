<?php

namespace App\Http\Controllers;

use App\Models\Obra;
use Illuminate\Http\Request;

class ObraController extends Controller
{
    public function index()
    {
        $obras = Obra::latest()->get();
        return view('obras.index', compact('obras'));
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
            'titulo'   => 'required|string|max:255',
            'autor'    => 'required|string|max:255',
            'formato'  => 'required|in:ebook,audiolibro',
            'sinopsis' => 'required|string|max:1000',
            'genero'   => 'required|in:' . implode(',', Obra::GENEROS),
            'idioma'   => 'required|in:' . implode(',', Obra::IDIOMAS),
            'duracion' => 'required_if:formato,audiolibro|nullable|integer|min:1',
            'paginas'  => 'required_if:formato,ebook|nullable|integer|min:1',
        ]);

        Obra::create($data);

        return redirect()->route('obras.index')
            ->with('success', 'Obra registrada correctamente.');
    }

    public function show(Obra $obra)
    {
        return view('obras.show', compact('obra'));
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
            'titulo'   => 'required|string|max:255',
            'autor'    => 'required|string|max:255',
            'formato'  => 'required|in:ebook,audiolibro',
            'sinopsis' => 'required|string|max:1000',
            'genero'   => 'required|in:' . implode(',', Obra::GENEROS),
            'idioma'   => 'required|in:' . implode(',', Obra::IDIOMAS),
            'duracion' => 'required_if:formato,audiolibro|nullable|integer|min:1',
            'paginas'  => 'required_if:formato,ebook|nullable|integer|min:1',
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
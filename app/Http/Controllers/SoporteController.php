<?php

namespace App\Http\Controllers;

use App\Models\TicketSoporte;
use Illuminate\Http\Request;

class SoporteController extends Controller
{
    // Mostrar el formulario
    public function create()
    {
        return view('soporte.create');
    }

    // Guardar el ticket
    public function store(Request $request)
    {
        $data = $request->validate([
            'asunto' => 'required|string|max:255',
            'tipo_problema' => 'required|in:error,duda,sugerencia,otro',
            'descripcion' => 'required|string',
            'captura_pantalla' => 'nullable|image|max:2048', // máx 2MB
        ]);

        // Generar folio único
        $data['folio'] = 'TCK-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));
        $data['estado'] = 'pendiente';
        
        // Si hay un usuario logueado, se lo asignamos
        $data['user_id'] = auth()->check() ? auth()->id() : null;

        // Guardar la captura de pantalla si se subió
        if ($request->hasFile('captura_pantalla')) {
            $path = $request->file('captura_pantalla')->store('capturas_soporte', 'public');
            $data['captura_pantalla'] = $path;
        }

        $ticket = TicketSoporte::create($data);

        // Redirigir mostrando el folio generado
        return redirect()->route('soporte.create')
            ->with('success', 'Tu solicitud fue enviada con éxito.')
            ->with('folio_generado', $ticket->folio);
    }
}
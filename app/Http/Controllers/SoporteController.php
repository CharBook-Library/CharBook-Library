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

    // Ver mis solicitudes (Lector)
    public function index()
    {
        $tickets = TicketSoporte::with('respuestas')->latest()->get();
        return view('soporte.index', compact('tickets'));
    }

    // Responder y cambiar estado (Administrador)
    public function responder(Request $request, TicketSoporte $ticket)
    {
        $request->validate([
            'mensaje' => 'required|string',
            'estado' => 'required|in:pendiente,en_proceso,resuelto'
        ]);

        \App\Models\RespuestaSoporte::create([
            'ticket_id' => $ticket->id,
            'user_id' => auth()->check() ? auth()->id() : null,
            'mensaje' => $request->mensaje,
        ]);

        $ticket->update(['estado' => $request->estado]);

        return redirect()->route('soporte.index')->with('success', 'Respuesta guardada y estado actualizado.');
    }
}
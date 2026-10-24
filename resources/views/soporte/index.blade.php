<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Mis Solicitudes — CharBook</title>
    <style>
        body { font-family: sans-serif; padding: 20px; max-width: 800px; margin: auto; }
        .ticket { border: 1px solid #ccc; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
        .badge { padding: 3px 8px; border-radius: 3px; color: white; font-size: 0.8em; }
        .pendiente { background: #ffc107; color: black; }
        .en_proceso { background: #17a2b8; }
        .resuelto { background: #28a745; }
        .respuesta { background: #f8f9fa; border-left: 4px solid #0056b3; padding: 10px; margin-top: 10px; }
    </style>
</head>
<body>
    <h1>Mis Solicitudes de Soporte</h1>
    
    <a href="{{ route('soporte.create') }}">+ Crear nueva solicitud</a>
    <br><br>

    @if (session('success'))
        <p style="color: green;">{{ session('success') }}</p>
    @endif

    @foreach ($tickets as $ticket)
        <div class="ticket">
            <h3>Folio: {{ $ticket->folio }}</h3>
            <p><strong>Asunto:</strong> {{ $ticket->asunto }}</p>
            <p><strong>Estado:</strong> <span class="badge {{ $ticket->estado }}">{{ strtoupper($ticket->estado) }}</span></p>
            
            <p><strong>Descripción original:</strong><br> {{ $ticket->descripcion }}</p>

            @if ($ticket->captura_pantalla)
                <p><a href="{{ asset('storage/' . $ticket->captura_pantalla) }}" target="_blank">Ver captura adjunta</a></p>
            @endif

            <hr>
            <h4>Respuestas:</h4>
            @forelse ($ticket->respuestas as $respuesta)
                <div class="respuesta">
                    <small>{{ $respuesta->created_at->format('d/m/Y H:i') }}</small>
                    <p>{{ $respuesta->mensaje }}</p>
                </div>
            @empty
                <p><em>Sin respuestas aún.</em></p>
            @endforelse

            {{-- Formulario para responder (Simulando que somos el Admin) --}}
            <details style="margin-top: 15px;">
                <summary style="cursor: pointer; color: blue;">Responder como Administrador</summary>
                <form action="{{ route('soporte.responder', $ticket->id) }}" method="POST" style="margin-top: 10px;">
                    @csrf
                    <textarea name="mensaje" rows="2" placeholder="Escribe la respuesta..." required style="width: 100%;"></textarea>
                    <br>
                    <select name="estado" required style="margin-top: 5px;">
                        <option value="en_proceso">Marcar en proceso</option>
                        <option value="resuelto">Marcar como resuelto</option>
                    </select>
                    <button type="submit" style="margin-top: 5px;">Guardar Respuesta</button>
                </form>
            </details>
        </div>
    @endforeach
</body>
</html>
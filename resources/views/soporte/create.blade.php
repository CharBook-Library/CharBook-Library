<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Ayuda y Soporte — CharBook</title>
    <style>
        body { font-family: sans-serif; padding: 20px; max-width: 600px; margin: auto; }
        .alert-success { background: #d4edda; color: #155724; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
        .error-list { color: red; }
        label { display: block; margin-top: 15px; font-weight: bold; }
        input[type="text"], select, textarea { width: 100%; padding: 8px; margin-top: 5px; }
        button { margin-top: 20px; padding: 10px 20px; background: #0056b3; color: white; border: none; border-radius: 5px; cursor: pointer; }
    </style>
</head>
<body>
    <h1>Soporte Técnico</h1>

    {{-- Mensaje de éxito con el Folio --}}
    @if (session('success'))
        <div class="alert-success">
            <strong>{{ session('success') }}</strong><br>
            Tu folio de seguimiento es: <strong>{{ session('folio_generado') }}</strong>
        </div>
    @endif

    @if ($errors->any())
        <ul class="error-list">
            @foreach ($errors->all() as $error)
                <li>{{ $error }}</li>
            @endforeach
        </ul>
    @endif

    <form action="{{ route('soporte.store') }}" method="POST" enctype="multipart/form-data">
        @csrf

        <label>Asunto:</label>
        <input type="text" name="asunto" required maxlength="255" placeholder="Ej: No puedo reproducir un audiolibro">

        <label>Tipo de problema:</label>
        <select name="tipo_problema" required>
            <option value="error">Error en la aplicación</option>
            <option value="duda">Duda o pregunta</option>
            <option value="sugerencia">Sugerencia</option>
            <option value="otro">Otro</option>
        </select>

        <label>Descripción:</label>
        <textarea name="descripcion" rows="5" required placeholder="Describe tu problema con el mayor detalle posible..."></textarea>

        <label>Captura de pantalla (opcional, JPG/PNG máx 2MB):</label>
        <input type="file" name="captura_pantalla" accept="image/*">

        <button type="submit">Enviar solicitud</button>
    </form>
</body>
</html>
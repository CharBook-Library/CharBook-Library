<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Nueva licencia — CharBook</title>
</head>
<body>
    <h1>Crear nueva licencia</h1>

    @if ($errors->any())
        <ul style="color: red;">
            @foreach ($errors->all() as $error)
                <li>{{ $error }}</li>
            @endforeach
        </ul>
    @endif

    <form action="{{ route('licencias.store') }}" method="POST">
        @csrf

        <label>Usuario:
            <select name="user_id" required>
                @foreach ($usuarios as $u)
                    <option value="{{ $u->id }}">{{ $u->name }}</option>
                @endforeach
            </select>
        </label><br><br>

        <label>Obra:
            <select name="obra_id" required>
                @foreach ($obras as $o)
                    <option value="{{ $o->id }}">{{ $o->titulo }}</option>
                @endforeach
            </select>
        </label><br><br>

        <label>Fecha de inicio:
            <input type="date" name="fecha_inicio" required>
        </label><br><br>

        <label>Fecha de vencimiento:
            <input type="date" name="fecha_vencimiento" required>
        </label><br><br>

        <button type="submit">Crear licencia</button>
    </form>

    <p><a href="{{ route('licencias.index') }}">← Volver al listado</a></p>
</body>
</html>
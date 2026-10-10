<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Licencias activas — CharBook</title>
</head>
<body>
    <h1>Licencias activas</h1>

    @if (session('success'))
        <p style="color: green;">{{ session('success') }}</p>
    @endif

    <p><a href="{{ route('licencias.create') }}">+ Nueva licencia</a></p>

    <table border="1" cellpadding="8" cellspacing="0">
        <thead>
            <tr>
                <th>Usuario</th>
                <th>Obra</th>
                <th>Inicio</th>
                <th>Vencimiento</th>
                <th>Activa</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($licencias as $licencia)
                <tr>
                    <td>{{ $licencia->user->name }}</td>
                    <td>{{ $licencia->obra->titulo }}</td>
                    <td>{{ $licencia->fecha_inicio->format('d/m/Y') }}</td>
                    <td>{{ $licencia->fecha_vencimiento->format('d/m/Y') }}</td>
                    <td>{{ $licencia->activa ? 'Sí' : 'No' }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="5">No hay licencias activas.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
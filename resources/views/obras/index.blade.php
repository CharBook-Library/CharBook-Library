<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Catálogo — CharBook</title>
</head>
<body>
    <h1>Catálogo de obras</h1>

    @if (session('success'))
        <p style="color: green;">{{ session('success') }}</p>
    @endif

    <a href="{{ route('obras.create') }}">+ Registrar nueva obra</a>

    <ul>
        @foreach ($obras as $obra)
            <li>
                <a href="{{ route('obras.show', $obra) }}">
                    <strong>{{ $obra->titulo }}</strong> — {{ $obra->autor }}
                </a>
            </li>
        @endforeach
    </ul>
</body>
</html>
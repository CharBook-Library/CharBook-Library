<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>{{ $obra->titulo }} — CharBook</title>
</head>
<body>
    <h1>{{ $obra->titulo }}</h1>
    <p><strong>Autor:</strong> {{ $obra->autor }}</p>
    <p><strong>Formato:</strong> {{ $obra->formato }}</p>
    <p><strong>Género:</strong> {{ $obra->genero }}</p>
    <p><strong>Idioma:</strong> {{ $obra->idioma }}</p>

    @if ($obra->formato === 'audiolibro')
        <p><strong>Duración:</strong> {{ $obra->duracion }} minutos</p>
    @else
        <p><strong>Páginas:</strong> {{ $obra->paginas }}</p>
    @endif

    <h2>Sinopsis</h2>
    <p>{{ $obra->sinopsis }}</p>

    <a href="{{ route('obras.index') }}">← Volver al catálogo</a>
</body>
</html>
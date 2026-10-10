<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Editar {{ $obra->titulo }} — CharBook</title>
</head>
<body>
    <h1>Editar obra</h1>

    @if ($errors->any())
        <ul style="color: red;">
            @foreach ($errors->all() as $error)
                <li>{{ $error }}</li>
            @endforeach
        </ul>
    @endif

    <form action="{{ route('obras.update', $obra) }}" method="POST">
        @csrf
        @method('PUT')

        <label>Título: <input type="text" name="titulo" value="{{ $obra->titulo }}" required></label><br>
        <label>Autor: <input type="text" name="autor" value="{{ $obra->autor }}" required></label><br>

        <label>Formato:
            <select name="formato" required>
                <option value="ebook" @selected($obra->formato === 'ebook')>E-book</option>
                <option value="audiolibro" @selected($obra->formato === 'audiolibro')>Audiolibro</option>
            </select>
        </label><br>

        <label>Sinopsis:
            <textarea name="sinopsis" maxlength="1000" required>{{ $obra->sinopsis }}</textarea>
        </label><br>

        <label>Género:
            <select name="genero" required>
                @foreach ($generos as $g)
                    <option value="{{ $g }}" @selected($obra->genero === $g)>{{ $g }}</option>
                @endforeach
            </select>
        </label><br>

        <label>Idioma:
            <select name="idioma" required>
                @foreach ($idiomas as $i)
                    <option value="{{ $i }}" @selected($obra->idioma === $i)>{{ $i }}</option>
                @endforeach
            </select>
        </label><br>

        <label>Duración: <input type="number" name="duracion" value="{{ $obra->duracion }}" min="1"></label><br>
        <label>Páginas: <input type="number" name="paginas" value="{{ $obra->paginas }}" min="1"></label><br>

        <button type="submit">Actualizar</button>
    </form>
</body>
</html>
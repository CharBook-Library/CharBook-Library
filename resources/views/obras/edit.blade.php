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
        <label>Portada (URL de imagen): <input type="url" name="portada" value="{{ old('portada', $obra->portada) }}" placeholder="https://ejemplo.com/portada.jpg"></label><br>
        <label>Precio (MXN): <input type="number" name="precio" min="0" max="999999.99" step="0.01" value="{{ old('precio', $obra->precio) }}" required></label><br>
        <label>Valoración (0 a 5): <input type="number" name="valoracion" min="0" max="5" step="0.1" value="{{ old('valoracion', $obra->valoracion) }}"></label><br>

        <button type="submit">Actualizar</button>
    </form>
</body>
</html>
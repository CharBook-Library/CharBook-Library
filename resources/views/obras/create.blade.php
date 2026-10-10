<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Registrar obra — CharBook</title>
</head>
<body>
    <h1>Registrar nueva obra</h1>

    @if ($errors->any())
        <ul style="color: red;">
            @foreach ($errors->all() as $error)
                <li>{{ $error }}</li>
            @endforeach
        </ul>
    @endif

    <form action="{{ route('obras.store') }}" method="POST">
        @csrf

        <label>Título: <input type="text" name="titulo" required></label><br>
        <label>Autor: <input type="text" name="autor" required></label><br>

        <label>Formato:
            <select name="formato" required>
                <option value="ebook">E-book</option>
                <option value="audiolibro">Audiolibro</option>
            </select>
        </label><br>

        <label>Sinopsis (máx. 1000 caracteres):<br>
            <textarea name="sinopsis" maxlength="1000" required oninput="document.getElementById('contador').textContent = this.value.length"></textarea><br>
            <span id="contador">0</span> / 1000
        </label><br>

        <label>Género:
            <select name="genero" required>
                @foreach ($generos as $g)
                    <option value="{{ $g }}">{{ $g }}</option>
                @endforeach
            </select>
        </label><br>

        <label>Idioma:
            <select name="idioma" required>
                @foreach ($idiomas as $i)
                    <option value="{{ $i }}">{{ $i }}</option>
                @endforeach
            </select>
        </label><br>

        <label>Duración (minutos, solo audiolibro): <input type="number" name="duracion" min="1"></label><br>
        <label>Páginas (solo e-book): <input type="number" name="paginas" min="1"></label><br>

        <button type="submit">Guardar</button>
    </form>
</body>
</html>
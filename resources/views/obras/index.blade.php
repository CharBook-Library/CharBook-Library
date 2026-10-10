<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="oklch(0.28 0.055 286)">
    <title>Catálogo — CharBook</title>
    <style>
        :root {
            --ink: oklch(0.22 0.035 286);
            --muted: oklch(0.48 0.025 286);
            --line: oklch(0.90 0.012 286);
            --surface: oklch(0.975 0.008 286);
            --brand: oklch(0.36 0.13 286);
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            background: white;
            color: var(--ink);
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            line-height: 1.5;
        }
        a { color: inherit; }
        .page { width: min(100% - 40px, 1080px); margin: 0 auto; padding: 48px 0 72px; }
        .topline { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
        h1 { margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: clamp(34px, 5vw, 48px); font-weight: 500; letter-spacing: -0.025em; }
        .new-work {
            display: inline-flex; align-items: center; justify-content: center; min-height: 42px;
            padding: 0 16px; border-radius: 6px; background: var(--brand); color: white;
            font-size: 13px; font-weight: 700; text-decoration: none;
        }
        .search { display: flex; gap: 10px; max-width: 600px; margin-top: 24px; }
        .search input {
            width: 100%; min-width: 0; min-height: 46px; padding: 0 14px; border: 1px solid var(--line);
            border-radius: 6px; color: var(--ink); font: inherit;
        }
        .search input:focus-visible, .search button:focus-visible, a:focus-visible { outline: 3px solid oklch(0.72 0.13 286); outline-offset: 3px; }
        .search button {
            min-height: 46px; padding: 0 18px; border: 1px solid var(--line); border-radius: 6px;
            background: var(--surface); color: var(--ink); font: inherit; font-size: 14px; font-weight: 650; cursor: pointer;
        }
        .results { margin: 28px 0 14px; color: var(--muted); font-size: 13px; }
        .works { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
        .work {
            display: grid; grid-template-columns: 58px minmax(0, 1fr); gap: 14px; align-items: center;
            min-height: 104px; padding: 14px; border: 1px solid var(--line); border-radius: 8px;
            text-decoration: none; transition: border-color 160ms ease, background-color 160ms ease;
        }
        .work:hover { border-color: oklch(0.72 0.06 286); background: var(--surface); }
        .thumb {
            display: grid; width: 58px; height: 76px; place-items: center; overflow: hidden; border-radius: 4px;
            background: linear-gradient(145deg, oklch(0.36 0.13 286), oklch(0.22 0.065 286)); color: white;
        }
        .thumb img { width: 100%; height: 100%; object-fit: cover; }
        .thumb svg { width: 24px; height: 24px; color: oklch(0.82 0.11 32); }
        .work h2 { margin: 0; font-size: 15px; line-height: 1.3; }
        .work p { margin: 5px 0 0; color: var(--muted); font-size: 13px; }
        .work .genre { margin-top: 7px; color: var(--brand); font-size: 11px; font-weight: 700; }
        .empty {
            padding: 28px; border: 1px dashed var(--line); border-radius: 8px; color: var(--muted);
            font-size: 14px; text-align: center;
        }
        .flash { margin: 20px 0 0; padding: 12px 14px; border: 1px solid oklch(0.83 0.08 150); border-radius: 6px; background: oklch(0.97 0.025 150); color: oklch(0.34 0.09 150); }
        @media (max-width: 560px) {
            .page { width: calc(100% - 32px); padding-top: 28px; }
            .topline { align-items: flex-start; flex-direction: column; }
            .new-work { width: 100%; }
            .search { flex-direction: column; }
        }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0.01ms !important; } }
    </style>
</head>
<body>
    <main class="page">
        <header class="topline">
            <h1>Catálogo</h1>
            <a class="new-work" href="{{ route('obras.create') }}">Registrar una obra</a>
        </header>

        @if (session('success'))
            <p class="flash" role="status">{{ session('success') }}</p>
        @endif

        <form class="search" action="{{ route('obras.index') }}" method="GET" role="search">
            <label for="buscar" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">Buscar obras</label>
            <input id="buscar" type="search" name="buscar" value="{{ $busqueda }}" placeholder="Buscar por título, autor o género">
            <button type="submit">Buscar</button>
        </form>

        <p class="results">
            @if ($busqueda !== '')
                {{ $obras->count() }} {{ $obras->count() === 1 ? 'resultado' : 'resultados' }} para «{{ $busqueda }}»
            @else
                {{ $obras->count() }} {{ $obras->count() === 1 ? 'obra disponible' : 'obras disponibles' }}
            @endif
        </p>

        @if ($obras->isEmpty())
            <p class="empty">
                @if ($busqueda !== '')
                    No encontramos obras con esa búsqueda. Prueba con otro título, autor o género.
                @else
                    Aún no hay obras en el catálogo.
                @endif
            </p>
        @else
            <section class="works" aria-label="Obras del catálogo">
                @foreach ($obras as $obra)
                    <a class="work" href="{{ route('obras.show', array_merge(['obra' => $obra], array_filter(['buscar' => $busqueda]))) }}">
                        <span class="thumb" aria-hidden="true">
                            @if ($obra->portada)
                                <img src="{{ $obra->portada }}" alt="" loading="lazy">
                            @else
                                <svg viewBox="0 0 48 48" fill="none">
                                    <path d="M24 10c-5-3.3-10.6-3.9-16-2.2V30c5.5-1.6 11.1-.8 16 2.4M24 10c5-3.3 10.6-3.9 16-2.2V30c-5.5-1.6-11.1-.8-16 2.4M24 10v22.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            @endif
                        </span>
                        <span>
                            <h2>{{ $obra->titulo }}</h2>
                            <p>{{ $obra->autor }}</p>
                            <span class="genre">{{ $obra->genero }}</span>
                        </span>
                    </a>
                @endforeach
            </section>
        @endif
    </main>
</body>
</html>

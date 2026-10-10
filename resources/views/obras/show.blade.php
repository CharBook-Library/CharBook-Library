<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="oklch(0.28 0.055 286)">
    <title>{{ $obra->titulo }} — CharBook</title>
    <style>
        :root {
            color-scheme: light;
            --ink: oklch(0.22 0.035 286);
            --muted: oklch(0.48 0.025 286);
            --line: oklch(0.90 0.012 286);
            --surface: oklch(0.975 0.008 286);
            --brand: oklch(0.36 0.13 286);
            --brand-hover: oklch(0.30 0.12 286);
            --accent: oklch(0.60 0.16 32);
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            background: white;
            color: var(--ink);
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            line-height: 1.55;
        }
        a { color: inherit; }
        .page { width: min(1080px, calc(100% - 40px)); margin: 0 auto; padding: 28px 0 72px; }
        .back-link {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            min-height: 42px;
            color: var(--muted);
            font-size: 14px;
            font-weight: 600;
            text-decoration: none;
        }
        .back-link:hover { color: var(--brand); }
        .back-link:focus-visible, .cta:focus-visible { outline: 3px solid oklch(0.72 0.13 286); outline-offset: 3px; }
        .detail {
            display: grid;
            grid-template-columns: minmax(250px, 350px) minmax(0, 1fr);
            gap: clamp(36px, 7vw, 88px);
            align-items: start;
            margin-top: 32px;
        }
        .cover {
            position: sticky;
            top: 24px;
            display: grid;
            min-height: 430px;
            margin: 0;
            aspect-ratio: 3 / 4;
            place-items: center;
            overflow: hidden;
            border: 1px solid var(--line);
            border-radius: 8px;
            background:
                radial-gradient(ellipse at 72% 20%, oklch(0.52 0.12 286 / 0.28), transparent 48%),
                linear-gradient(155deg, oklch(0.33 0.09 286), oklch(0.20 0.055 286));
            box-shadow: 0 24px 55px oklch(0.22 0.035 286 / 0.16);
        }
        .cover img { width: 100%; height: 100%; position: absolute; inset: 0; object-fit: cover; }
        .cover-placeholder {
            display: grid;
            width: 100%;
            height: 100%;
            min-height: 430px;
            align-content: center;
            justify-items: center;
            padding: 36px;
            color: white;
            text-align: center;
        }
        .cover-placeholder svg { width: 56px; height: 56px; margin-bottom: 30px; color: oklch(0.82 0.11 32); }
        .cover-placeholder strong {
            max-width: 14ch;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 27px;
            font-weight: 500;
            line-height: 1.15;
            text-wrap: balance;
        }
        .cover-placeholder span { margin-top: 12px; color: oklch(0.88 0.01 286); font-size: 13px; }
        .work-copy { min-width: 0; }
        .eyebrow { margin: 0 0 12px; color: var(--brand); font-size: 13px; font-weight: 700; }
        h1 {
            margin: 0;
            font-family: Georgia, "Times New Roman", serif;
            font-size: clamp(34px, 5vw, 52px);
            font-weight: 500;
            letter-spacing: -0.025em;
            line-height: 1.07;
            text-wrap: balance;
        }
        .author { margin: 12px 0 0; color: var(--muted); font-size: 16px; }
        .author strong { color: var(--ink); font-weight: 600; }
        .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 22px; }
        .tag {
            display: inline-flex;
            align-items: center;
            min-height: 30px;
            padding: 4px 11px;
            border: 1px solid var(--line);
            border-radius: 999px;
            color: var(--muted);
            font-size: 12px;
            font-weight: 600;
        }
        .facts {
            display: flex;
            flex-wrap: wrap;
            gap: 0;
            margin: 28px 0 0;
            padding: 16px 0;
            border-top: 1px solid var(--line);
            border-bottom: 1px solid var(--line);
        }
        .fact { min-width: 118px; padding: 0 20px; border-right: 1px solid var(--line); }
        .fact:first-child { padding-left: 0; }
        .fact:last-child { border-right: 0; }
        .fact dt { color: var(--muted); font-size: 12px; }
        .fact dd { display: flex; align-items: center; gap: 6px; margin: 4px 0 0; font-size: 15px; font-weight: 700; }
        .star { color: var(--accent); font-size: 17px; }
        .rating-note { color: var(--muted); font-size: 12px; font-weight: 500; }
        .synopsis { margin-top: 28px; }
        .synopsis h2 { margin: 0 0 9px; font-size: 16px; font-weight: 700; }
        .synopsis p { max-width: 66ch; margin: 0; color: oklch(0.34 0.02 286); font-size: 15px; line-height: 1.8; white-space: pre-line; }
        .purchase {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            margin-top: 30px;
            padding: 20px;
            border: 1px solid var(--line);
            border-radius: 8px;
            background: var(--surface);
        }
        .price-label { display: block; color: var(--muted); font-size: 12px; }
        .price { display: block; margin-top: 2px; font-size: 24px; font-weight: 750; letter-spacing: -0.03em; }
        .cta {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 46px;
            padding: 0 22px;
            border: 0;
            border-radius: 6px;
            background: var(--brand);
            color: white;
            font: inherit;
            font-size: 14px;
            font-weight: 700;
            white-space: nowrap;
        }
        .cta[disabled] { cursor: not-allowed; opacity: 0.78; }
        .purchase-note { margin: 10px 0 0; color: var(--muted); font-size: 12px; }
        .owned {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            margin-top: 18px;
            color: oklch(0.40 0.11 150);
            font-size: 13px;
            font-weight: 700;
        }
        .owned svg { width: 17px; height: 17px; }
        @media (max-width: 700px) {
            .page { width: min(100% - 32px, 540px); padding-top: 18px; }
            .detail { grid-template-columns: 1fr; gap: 28px; margin-top: 20px; }
            .cover { position: relative; top: auto; width: min(100%, 300px); min-height: 0; margin: 0 auto; }
            .cover-placeholder { min-height: 0; }
            .purchase { align-items: stretch; flex-direction: column; }
            .cta { width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after { scroll-behavior: auto !important; }
        }
    </style>
</head>
<body>
    <main class="page">
        <a class="back-link" href="{{ route('obras.index', array_filter(['buscar' => $busqueda])) }}">
            <span aria-hidden="true">←</span>
            Volver al catálogo
        </a>

        <article class="detail">
            <figure class="cover" aria-label="Portada de {{ $obra->titulo }}">
                @if ($obra->portada)
                    <img src="{{ $obra->portada }}" alt="Portada de {{ $obra->titulo }}" loading="eager">
                @else
                    <div class="cover-placeholder">
                        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
                            <path d="M24 10c-5-3.3-10.6-3.9-16-2.2V30c5.5-1.6 11.1-.8 16 2.4M24 10c5-3.3 10.6-3.9 16-2.2V30c-5.5-1.6-11.1-.8-16 2.4M24 10v22.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <strong>{{ $obra->titulo }}</strong>
                        <span>{{ $obra->autor }}</span>
                    </div>
                @endif
            </figure>

            <div class="work-copy">
                <p class="eyebrow">{{ $obra->formato === 'audiolibro' ? 'Audiolibro' : 'Libro electrónico' }}</p>
                <h1>{{ $obra->titulo }}</h1>
                <p class="author">Por <strong>{{ $obra->autor }}</strong></p>

                <div class="tags" aria-label="Detalles de la obra">
                    <span class="tag">{{ $obra->genero }}</span>
                    <span class="tag">{{ $obra->idioma }}</span>
                </div>

                <dl class="facts">
                    <div class="fact">
                        <dt>{{ $obra->formato === 'audiolibro' ? 'Duración' : 'Extensión' }}</dt>
                        <dd>
                            @if ($obra->formato === 'audiolibro')
                                {{ $obra->duracion }} min
                            @else
                                {{ number_format($obra->paginas) }} páginas
                            @endif
                        </dd>
                    </div>
                    <div class="fact">
                        <dt>Valoración</dt>
                        <dd>
                            @if ($obra->valoracion !== null)
                                <span class="star" aria-hidden="true">★</span>
                                {{ number_format((float) $obra->valoracion, 1) }}
                                <span class="rating-note">de 5</span>
                            @else
                                <span class="rating-note">Sin valoración</span>
                            @endif
                        </dd>
                    </div>
                </dl>

                <section class="synopsis" aria-labelledby="synopsis-title">
                    <h2 id="synopsis-title">Sinopsis</h2>
                    <p>{{ $obra->sinopsis }}</p>
                </section>

                @if ($adquirida)
                    <p class="owned">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Ya tienes esta obra
                    </p>
                @endif

                <section class="purchase" aria-label="Adquisición de la obra">
                    <div>
                        <span class="price-label">Precio · MXN</span>
                        <strong class="price">${{ number_format((float) $obra->precio, 2) }}</strong>
                    </div>
                    @if ($adquirida)
                        <button class="cta" type="button" disabled aria-describedby="purchase-note">Leer o escuchar</button>
                    @else
                        <button class="cta" type="button" disabled aria-describedby="purchase-note">Comprar</button>
                    @endif
                </section>
                <p class="purchase-note" id="purchase-note">
                    @if ($adquirida)
                        Tu licencia está vigente. El reproductor estará disponible próximamente.
                    @else
                        La compra en línea todavía no está disponible.
                        @if (!auth()->check())
                            Inicia sesión para consultar las obras que ya adquiriste.
                        @endif
                    @endif
                </p>
            </div>
        </article>
    </main>
</body>
</html>

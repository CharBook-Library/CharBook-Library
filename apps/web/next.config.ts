import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
const isDev = process.env.NODE_ENV !== "production";

// IP de la red local para probar en el teléfono (la setea run-mobile.ps1).
const lanIp = process.env.DEV_LAN_IP?.trim() || undefined;

// Host de la API pública (NEXT_PUBLIC_API_URL): si la API sirve portadas
// (/storage/covers) con su propio dominio, next/image debe permitirlo.
// Aplica en dev y en producción; se deriva del env, nunca hardcodeado.
const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
let apiHostPattern: { protocol: "http" | "https"; hostname: string; port?: string } | undefined;
try {
  if (apiUrl) {
    const u = new URL(apiUrl);
    apiHostPattern = {
      protocol: u.protocol === "http:" ? "http" : "https",
      hostname: u.hostname,
      ...(u.port ? { port: u.port } : {}),
    };
  }
} catch {
  // NEXT_PUBLIC_API_URL malformada: se ignora (los patrones fijos siguen).
}

const devImagePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = isDev
  ? [
      { protocol: "http", hostname: "localhost", port: "8000" },
      { protocol: "http", hostname: "127.0.0.1", port: "8000" },
      // Túnel ngrok de desarrollo: el subdominio rota, por eso comodín.
      // La API genera URLs de portada con su APP_URL (el dominio del túnel).
      { protocol: "https", hostname: "*.ngrok-free.dev" },
      { protocol: "https", hostname: "*.ngrok-free.app" },
      ...(lanIp ? [{ protocol: "http" as const, hostname: lanIp, port: "8000" }] : []),
    ]
  : [];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  turbopack: {
    root: process.cwd(),
  },

  // Permite acceder al dev server desde la IP de la red local (no solo localhost)
  // — soluciona los WebSocket failed del HMR y los assets bloqueados por CORS.
  allowedDevOrigins: ["*.local", ...(lanIp ? [lanIp] : [])],

  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(self)",
      },
      {
        key: "Content-Security-Policy",
        value: "base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
      },
    ];

    if (!isDev) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }

    return [{ source: "/:path*", headers: securityHeaders }];
  },

  images: {
    // Next 16 bloquea por defecto la optimización de imágenes cuyo host
    // resuelve a una IP privada (localhost/127.0.0.1) como protección SSRF.
    // En dev las portadas se sirven desde la API local (localhost:8000), así
    // que lo habilitamos. En prod las portadas vienen de R2 (https público).
    dangerouslyAllowLocalIP: isDev,

    remotePatterns: [
      // ===== Avatares Google (OAuth) =====
      { protocol: "https", hostname: "lh3.googleusercontent.com" },

      // ===== Portadas externas usadas por seed + lookup =====
      { protocol: "https", hostname: "covers.openlibrary.org" },
      // Portadas de los clásicos de dominio público sembrados desde Gutenberg
      // (charbook:seed-public-domain). Host exacto y path acotado a /cache/epub:
      // el optimizador de imágenes hace la petición desde el servidor, así que
      // cuanto menos superficie se le abra, mejor.
      { protocol: "https", hostname: "www.gutenberg.org", pathname: "/cache/epub/**" },
      { protocol: "https", hostname: "books.google.com" },
      { protocol: "https", hostname: "books.googleusercontent.com" },
      { protocol: "https", hostname: "archive.org" },
      { protocol: "https", hostname: "ia800000.us.archive.org" },

      // ===== Nuestra API (portadas /storage servidas por su propio dominio) =====
      ...(apiHostPattern ? [apiHostPattern] : []),

      // ===== Cloudflare R2 público =====
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "*.r2.dev" },
      ...devImagePatterns,
    ],
  },
};

export default withNextIntl(nextConfig);

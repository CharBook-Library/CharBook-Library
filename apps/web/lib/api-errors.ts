/**
 * Lectura de errores de la API — lógica pura, sin React ni DOM, para poder
 * probarla con el runner existente (`node --test`) sin dependencias nuevas.
 */

export type ApiError = {
  response?: {
    status?: number;
    headers?: Record<string, unknown>;
    data?: {
      errors?: Record<string, string[]>;
      message?: string;
      /** Segundos reales de espera que anuncia el servidor. */
      retry_after_seconds?: number;
    };
  };
  message?: string;
};

/**
 * Guarda mínima cuando el servidor NO informa un tiempo de espera (respuestas
 * antiguas o errores sin cabecera). Es solo un freno de interfaz contra clics
 * repetidos: NO representa la política del servidor.
 */
export const FALLBACK_RESEND_GUARD_SECONDS = 15;

/** Código HTTP, para distinguir 429 (rate limit) de los 422 de validación. */
export function apiStatus(error: unknown): number | undefined {
  return (error as ApiError).response?.status;
}

/** ¿La petición murió por red/timeout? Entonces conservamos el formulario. */
export function isNetworkError(error: unknown): boolean {
  return (error as ApiError).response === undefined;
}

/**
 * Segundos de espera REALES que anuncia el servidor: primero el campo
 * machine-readable del cuerpo (`retry_after_seconds`, que el API envía también
 * en el 422 por límite de envíos), luego la cabecera estándar `Retry-After`
 * (la que emite el throttle de Laravel en un 429).
 *
 * Devuelve null si el servidor no dice nada — solo entonces la interfaz debe
 * recurrir a FALLBACK_RESEND_GUARD_SECONDS. Nunca se extraen segundos del
 * texto del mensaje.
 */
export function retryAfterFromError(error: unknown): number | null {
  const res = (error as ApiError).response;

  const fromBody = res?.data?.retry_after_seconds;
  if (typeof fromBody === "number" && Number.isFinite(fromBody)) {
    return Math.max(0, fromBody);
  }

  const header = res?.headers?.["retry-after"] ?? res?.headers?.["Retry-After"];
  if (header === undefined || header === null || header === "") return null;

  const parsed = Number(header);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Traduce un fallo del flujo "crear contraseña" a un mensaje accionable.
 * Deliberadamente NO distingue código incorrecto de código agotado o
 * inexistente: el backend responde igual en los tres casos para no dar un
 * oráculo al atacante, y el cliente no debe inventar esa diferencia.
 */
export function passwordSetupError(error: unknown): string {
  if (isNetworkError(error)) {
    return "No hay conexión. Revisa tu red e inténtalo de nuevo.";
  }
  if (apiStatus(error) === 429) {
    return "Demasiados intentos. Espera un momento antes de reintentar.";
  }
  const data = (error as ApiError).response?.data;
  return data?.errors?.email_code?.[0]
    ?? data?.errors?.email?.[0]
    ?? data?.errors?.password?.[0]
    ?? data?.message
    ?? "No se pudo completar. Inténtalo de nuevo.";
}

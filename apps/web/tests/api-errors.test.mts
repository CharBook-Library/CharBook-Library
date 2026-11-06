import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FALLBACK_RESEND_GUARD_SECONDS,
  retryAfterFromError,
  passwordSetupError,
  isNetworkError,
} from "../lib/api-errors.ts";

describe("retryAfterFromError", () => {
  it("reads retry_after_seconds from a 422 rate-limit body", () => {
    // Forma exacta que devuelve POST /me/password/challenge al alcanzar el
    // límite de envíos: 422 + mensaje humano + campo machine-readable.
    const error = {
      response: {
        status: 422,
        data: {
          message: "Demasiados códigos enviados. Intenta de nuevo en 480 segundos.",
          errors: { email: ["Demasiados códigos enviados. Intenta de nuevo en 480 segundos."] },
          retry_after_seconds: 480,
        },
      },
    };

    assert.equal(retryAfterFromError(error), 480);
  });

  it("prefers the body field over the Retry-After header", () => {
    const error = {
      response: {
        status: 422,
        headers: { "retry-after": "999" },
        data: { retry_after_seconds: 42 },
      },
    };

    assert.equal(retryAfterFromError(error), 42);
  });

  it("falls back to the Retry-After header on a 429", () => {
    const error = { response: { status: 429, headers: { "retry-after": "37" } } };

    assert.equal(retryAfterFromError(error), 37);
  });

  it("accepts zero as a real value (server allows resending now)", () => {
    const error = { response: { status: 422, data: { retry_after_seconds: 0 } } };

    assert.equal(retryAfterFromError(error), 0);
  });

  it("returns null when the server says nothing, so the UI uses its own guard", () => {
    assert.equal(retryAfterFromError({ response: { status: 422, data: {} } }), null);
    assert.equal(retryAfterFromError({ response: { status: 500 } }), null);
    assert.equal(retryAfterFromError({}), null);
    // Nunca se extraen segundos del texto del mensaje.
    assert.equal(
      retryAfterFromError({
        response: { status: 422, data: { message: "Intenta de nuevo en 480 segundos." } },
      }),
      null,
    );
  });

  it("keeps a sane guard constant for the no-information case", () => {
    assert.equal(FALLBACK_RESEND_GUARD_SECONDS, 15);
  });
});

describe("passwordSetupError", () => {
  it("keeps the server message on a 422", () => {
    const error = {
      response: { status: 422, data: { errors: { email_code: ["Código incorrecto o expirado."] } } },
    };

    assert.equal(passwordSetupError(error), "Código incorrecto o expirado.");
  });

  it("does not distinguish wrong, expired or burned codes", () => {
    // El backend responde igual en los tres casos para no dar un oráculo; el
    // cliente no debe inventar la diferencia.
    const wrong = { response: { status: 422, data: { errors: { email_code: ["Código incorrecto o expirado."] } } } };
    const burned = { response: { status: 422, data: { errors: { email_code: ["Código incorrecto o expirado."] } } } };

    assert.equal(passwordSetupError(wrong), passwordSetupError(burned));
  });

  it("reports a network failure without blaming the server", () => {
    assert.match(passwordSetupError({ message: "Network Error" }), /conexión/i);
    assert.equal(isNetworkError({ message: "Network Error" }), true);
    assert.equal(isNetworkError({ response: { status: 422 } }), false);
  });
});

const tokenFile = __ENV.K6_TOKENS_FILE
  || "../../apps/api/storage/app/private/loadtest/tokens.json";
const fixture = JSON.parse(open(tokenFile));

if (fixture.environment !== "loadtest" || fixture.database !== "charbook_loadtest") {
  throw new Error("El archivo de tokens no pertenece a charbook_loadtest.");
}
if (!Array.isArray(fixture.tokens) || fixture.tokens.length === 0) {
  throw new Error("El archivo temporal no contiene tokens loadtest.");
}

export function tokenForVu(offset = 0) {
  return fixture.tokens[((__VU - 1 + offset) % fixture.tokens.length)].token;
}

export function readerToken() {
  const reader = fixture.tokens.find((entry) => entry.email === "loadtest-00003@example.test");
  if (!reader) {
    throw new Error("No se encontró el token del lector loadtest esperado.");
  }

  return reader.token;
}

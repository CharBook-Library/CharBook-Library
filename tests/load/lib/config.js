import http from "k6/http";
import { check } from "k6";

const configuredBaseUrl = (__ENV.BASE_URL || "http://127.0.0.1:8001").replace(/\/+$/, "");
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(configuredBaseUrl)) {
  throw new Error("BASE_URL debe apuntar a localhost o 127.0.0.1; producción y túneles están bloqueados.");
}

export const BASE_URL = configuredBaseUrl;
export const P95_MS = Number(__ENV.P95_MS || 1200);
export const DEFAULT_THRESHOLDS = {
  checks: ["rate>0.99"],
  http_req_failed: ["rate<0.01"],
  http_req_duration: [`p(95)<${P95_MS}`],
};

export function jsonParams(token = null, tags = {}) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return { headers, tags };
}

export function getJson(path, name, token = null, expectedStatus = 200) {
  const response = http.get(
    `${BASE_URL}${path}`,
    jsonParams(token, { endpoint: name }),
  );
  check(response, {
    [`${name} responde ${expectedStatus}`]: (result) => result.status === expectedStatus,
  });

  return response;
}

export function postJson(path, body, name, token = null, expectedStatus = 200) {
  const response = http.post(
    `${BASE_URL}${path}`,
    JSON.stringify(body),
    jsonParams(token, { endpoint: name }),
  );
  check(response, {
    [`${name} responde ${expectedStatus}`]: (result) => result.status === expectedStatus,
  });

  return response;
}

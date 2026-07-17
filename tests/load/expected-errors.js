import http from "k6/http";
import { check } from "k6";
import { BASE_URL, jsonParams } from "./lib/config.js";
import { readerToken } from "./lib/tokens.js";

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ["rate==1"],
    http_req_failed: ["rate==0"],
  },
};

function expectedParams(statuses, token = null, endpoint = "expected_error") {
  return {
    ...jsonParams(token, { endpoint }),
    responseCallback: http.expectedStatuses(...statuses),
  };
}

export default function () {
  const unauthorized = http.get(
    `${BASE_URL}/api/user`,
    expectedParams([401], null, "expected_401"),
  );
  check(unauthorized, {
    "401 no autenticado": (response) => response.status === 401,
    "401 no expone stack": (response) => !/trace|exception/i.test(response.body),
  });

  const forbidden = http.get(
    `${BASE_URL}/api/admin/system/health`,
    expectedParams([403], readerToken(), "expected_403"),
  );
  check(forbidden, {
    "403 lector sin privilegios": (response) => response.status === 403,
    "403 no expone stack": (response) => !/trace|exception/i.test(response.body),
  });

  const missing = http.get(
    `${BASE_URL}/api/books/loadtest-book-does-not-exist`,
    expectedParams([404], null, "expected_404"),
  );
  check(missing, {
    "404 recurso inexistente": (response) => response.status === 404,
  });

  const invalid = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({}),
    expectedParams([422, 429], null, "expected_422"),
  );
  check(invalid, {
    "422 validación de login": (response) => response.status === 422,
  });

  let rateLimited = invalid.status === 429;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({}),
      expectedParams([422, 429], null, "expected_429"),
    );
    rateLimited = rateLimited || response.status === 429;
  }
  check(rateLimited, {
    "429 límite auth real": (result) => result === true,
  });

  const controlled = http.get(
    `${BASE_URL}/api/loadtest/controlled-error`,
    expectedParams([500], null, "expected_500"),
  );
  check(controlled, {
    "500 controlado solo loadtest": (response) => response.status === 500,
    "500 no expone stack": (response) => !/trace|exception|file|line/i.test(response.body),
  });
}

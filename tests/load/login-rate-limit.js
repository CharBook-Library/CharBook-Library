import http from "k6/http";
import { check } from "k6";
import { BASE_URL, jsonParams } from "./lib/config.js";

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ["rate==1"],
    http_req_failed: ["rate==0"],
  },
};

export default function () {
  let rateLimited = false;
  for (let attempt = 0; attempt < 11; attempt += 1) {
    const response = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({}),
      {
        ...jsonParams(null, { endpoint: "login_rate_limit" }),
        responseCallback: http.expectedStatuses(422, 429),
      },
    );
    rateLimited = rateLimited || response.status === 429;
  }
  check(rateLimited, {
    "auth devuelve 429 tras 10 intentos por IP": (result) => result === true,
  });
}

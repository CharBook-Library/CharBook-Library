import { DEFAULT_THRESHOLDS } from "./lib/config.js";
import { setupCatalog } from "./lib/catalog.js";
import { authenticatedReading } from "./lib/authenticated-flow.js";
import { publicReading } from "./lib/public-flow.js";

export const options = {
  scenarios: {
    public_readers: {
      executor: "constant-vus",
      exec: "publicScenario",
      vus: Number(__ENV.PUBLIC_VUS || 25),
      duration: __ENV.DURATION || "2m",
    },
    authenticated_readers: {
      executor: "constant-vus",
      exec: "authenticatedScenario",
      vus: Number(__ENV.AUTH_VUS || 25),
      duration: __ENV.DURATION || "2m",
    },
  },
  thresholds: DEFAULT_THRESHOLDS,
};

export function setup() {
  return setupCatalog();
}

export function publicScenario(data) {
  publicReading(data);
}

export function authenticatedScenario(data) {
  authenticatedReading(data);
}

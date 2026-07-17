import { DEFAULT_THRESHOLDS } from "./lib/config.js";
import { setupCatalog } from "./lib/catalog.js";
import { authenticatedReading } from "./lib/authenticated-flow.js";

export const options = {
  vus: Number(__ENV.VUS || 20),
  duration: __ENV.DURATION || "1m",
  thresholds: DEFAULT_THRESHOLDS,
};

export function setup() {
  return setupCatalog();
}

export default function (data) {
  authenticatedReading(data);
}

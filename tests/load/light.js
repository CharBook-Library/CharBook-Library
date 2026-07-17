import { DEFAULT_THRESHOLDS } from "./lib/config.js";
import { setupCatalog } from "./lib/catalog.js";
import { mixedReading } from "./lib/mixed-flow.js";

export const options = {
  vus: 20,
  duration: __ENV.DURATION || "1m",
  thresholds: DEFAULT_THRESHOLDS,
};

export function setup() {
  return setupCatalog();
}

export default function (data) {
  mixedReading(data);
}

import { DEFAULT_THRESHOLDS } from "./lib/config.js";
import { setupCatalog } from "./lib/catalog.js";
import { mixedReading } from "./lib/mixed-flow.js";

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || "20s",
  thresholds: DEFAULT_THRESHOLDS,
};

export function setup() {
  return setupCatalog();
}

export default function (data) {
  mixedReading(data);
}

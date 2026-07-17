import { DEFAULT_THRESHOLDS } from "./lib/config.js";
import { setupCatalog } from "./lib/catalog.js";
import { mixedReading } from "./lib/mixed-flow.js";

export const options = {
  stages: [
    { duration: "2m", target: 500 },
    { duration: "5m", target: 500 },
    { duration: "2m", target: 0 },
  ],
  thresholds: DEFAULT_THRESHOLDS,
};

export function setup() {
  return setupCatalog();
}

export default function (data) {
  mixedReading(data);
}

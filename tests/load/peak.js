import { DEFAULT_THRESHOLDS } from "./lib/config.js";
import { setupCatalog } from "./lib/catalog.js";
import { mixedReading } from "./lib/mixed-flow.js";

export const options = {
  stages: [
    { duration: "1m", target: 200 },
    { duration: "1m", target: 300 },
    { duration: "3m", target: 300 },
    { duration: "1m", target: 0 },
  ],
  thresholds: DEFAULT_THRESHOLDS,
};

export function setup() {
  return setupCatalog();
}

export default function (data) {
  mixedReading(data);
}

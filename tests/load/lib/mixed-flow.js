import { authenticatedReading } from "./authenticated-flow.js";
import { publicReading } from "./public-flow.js";

export function mixedReading(data) {
  if ((__VU + __ITER) % 2 === 0) {
    authenticatedReading(data);
  } else {
    publicReading(data);
  }
}

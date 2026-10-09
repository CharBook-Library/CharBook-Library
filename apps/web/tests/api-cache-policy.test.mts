import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cacheModeForApiRequest } from "../lib/server/api-cache-policy.ts";

describe("cacheModeForApiRequest", () => {
  it("does not cache personalized API responses", () => {
    assert.equal(cacheModeForApiRequest(undefined, true), "no-store");
  });

  it("keeps public and explicitly configured cache policies", () => {
    assert.equal(cacheModeForApiRequest(undefined, false), undefined);
    assert.equal(cacheModeForApiRequest("force-cache", true), "force-cache");
  });
});

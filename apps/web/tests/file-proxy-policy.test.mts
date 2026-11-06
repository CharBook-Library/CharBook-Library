import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAllowedFileTarget } from "../lib/server/file-proxy-policy.ts";
import { safeLocalReturnPath } from "../lib/server/oauth-policy.ts";

const apiUrl = "http://localhost:8000";

describe("isAllowedFileTarget", () => {
  it("allows only known file routes on the exact API origin", () => {
    assert.equal(
      isAllowedFileTarget(new URL("http://localhost:8000/api/books/demo/file-proxy"), apiUrl),
      true,
    );
    assert.equal(
      isAllowedFileTarget(
        new URL("http://localhost:8000/api/books/demo/file-proxy-signed?expires=1&signature=x"),
        apiUrl,
      ),
      true,
    );
    assert.equal(
      isAllowedFileTarget(new URL("http://localhost:8000/api/chapters/42/file-proxy"), apiUrl),
      true,
    );
    assert.equal(isAllowedFileTarget(new URL("http://localhost:8000/api/users"), apiUrl), false);
  });

  it("rejects arbitrary loopback ports and hostname lookalikes", () => {
    assert.equal(
      isAllowedFileTarget(new URL("http://localhost:5432/api/books/demo/file-proxy"), apiUrl),
      false,
    );
    assert.equal(
      isAllowedFileTarget(new URL("http://127.0.0.1:8000/api/books/demo/file-proxy"), apiUrl),
      false,
    );
    assert.equal(
      isAllowedFileTarget(new URL("http://localhost.attacker.test/api/books/demo/file-proxy"), apiUrl),
      false,
    );
  });

  it("rejects credentials, fragments and wildcard R2 hosts", () => {
    assert.equal(
      isAllowedFileTarget(new URL("http://user:pass@localhost:8000/api/books/demo/file-proxy"), apiUrl),
      false,
    );
    assert.equal(
      isAllowedFileTarget(new URL("http://localhost:8000/api/books/demo/file-proxy#fragment"), apiUrl),
      false,
    );
    assert.equal(
      isAllowedFileTarget(new URL("https://attacker.r2.dev/file.pdf"), apiUrl),
      false,
    );
  });

  it("supports explicitly configured exact HTTPS origins", () => {
    const target = new URL("https://files.charbook.example/book.pdf");
    assert.equal(
      isAllowedFileTarget(target, apiUrl, "https://files.charbook.example"),
      true,
    );
    assert.equal(
      isAllowedFileTarget(target, apiUrl, "http://files.charbook.example"),
      false,
    );
  });
});

describe("safeLocalReturnPath", () => {
  it("accepts local paths and rejects protocol-relative redirects", () => {
    assert.equal(safeLocalReturnPath("/biblioteca?tab=leyendo"), "/biblioteca?tab=leyendo");
    assert.equal(safeLocalReturnPath("//attacker.test/path"), "/");
    assert.equal(safeLocalReturnPath("https://attacker.test/path"), "/");
    assert.equal(safeLocalReturnPath(null), "/");
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeReqUrl } from "../src/logger.js";

test("sanitizeReqUrl redacts secret query params and preserves safe URL parts", () => {
  const out = sanitizeReqUrl("/app?imp=1&token=secret&handoff=abc&proof=p&clientProof=cp#frag");
  assert.equal(
    out,
    "/app?imp=1&token=%5BRedacted%5D&handoff=abc&proof=%5BRedacted%5D&clientProof=%5BRedacted%5D#frag"
  );
});

test("sanitizeReqUrl leaves safe query params untouched", () => {
  assert.equal(
    sanitizeReqUrl("/api/tickets/catalog?mode=normal&page=2"),
    "/api/tickets/catalog?mode=normal&page=2"
  );
});

test("sanitizeReqUrl returns empty value for empty input", () => {
  assert.equal(sanitizeReqUrl(""), "");
  assert.equal(sanitizeReqUrl(null), "");
});

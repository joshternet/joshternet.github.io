/**
 * Goal: Uses assessment keeps the outcome and drops the page body.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { assessUsesPages } from "../../scripts/uses/origin-assessment.mjs";

const origin = "https://joshua.example";

test("assessUsesPages covers missing, duplicate, and extracted pages", () => {
  const missing = assessUsesPages("https://joshternet.org", undefined);
  assert.equal(missing.page_status, "not_found");
  assert.equal(missing.extracted, null);

  const unchecked = assessUsesPages(origin, undefined);
  assert.equal(unchecked.page_status, "not_checked");

  const scoped = assessUsesPages(origin, [
    { outcome: "out_of_scope" },
  ]);
  assert.match(scoped.page_url, /\/uses/);
  assert.equal(scoped.homepage_duplicate, true);

  const namedScope = assessUsesPages(origin, [
    { url: `${origin}/uses/`, outcome: "out_of_scope" },
  ]);
  assert.equal(namedScope.page_url, `${origin}/uses/`);

  const home = "<html><body><p>Same</p></body></html>";
  const duplicate = assessUsesPages(origin, [
    { url: `${origin}/`, html: home },
    { url: `${origin}/uses/`, html: home },
  ]);
  assert.equal(duplicate.homepage_duplicate, true);
  assert.equal(duplicate.extracted, null);

  const extracted = assessUsesPages(origin, [
    { url: `${origin}/notes`, html: "" },
    { html: "<p>skip</p>" },
    { url: `${origin}/about`, html: "<p>About</p>" },
    { url: `${origin}/uses/`, html: "<ul><li>Pen</li></ul>" },
  ]);
  assert.equal(extracted.homepage_duplicate, false);
  assert.equal(extracted.page_url, `${origin}/uses/`);
  assert.ok(extracted.extracted);
  assert.equal(typeof extracted.page_status, "string");
});

/**
 * Goal: Model proposals stay below publication until the score and the
 * margin both clear, and only the locked model id is allowed.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  acceptProposal,
  applyModelProposal,
  assertAllowedModel,
  automaticPublishAllowed,
  cacheMatchesLock,
  classificationFingerprint,
  modelClaimText,
  pairSlotScores,
  slotLabels,
  windowText,
} from "../../scripts/uses/infer-policy.mjs";

const lock = {
  model_id: "Xenova/nli-deberta-v3-xsmall",
  revision: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};

const policy = { threshold: 0.7, margin: 0.1 };

test("assertAllowedModel refuses every other id", () => {
  assert.doesNotThrow(() => assertAllowedModel(lock, lock.model_id));
  assert.doesNotThrow(() =>
    assertAllowedModel(lock, lock.model_id, lock.revision),
  );
  assert.throws(
    () => assertAllowedModel(lock, "other/model", lock.revision),
    /not allowlisted/,
  );
  assert.throws(
    () => assertAllowedModel(lock, lock.model_id, "other-revision"),
    /not allowlisted/,
  );
  assert.throws(() => assertAllowedModel({}, "", ""), /unknown/);
});

test("slot labels skip excluded roles and empty scope", () => {
  const labels = slotLabels({
    categories: [
      { id: "keyboard", name: "Keyboards", role: "ranked", scope: "" },
      { id: "game", name: "Games", role: "excluded", scope: "" },
      {
        id: "editor-ide",
        name: "Editors",
        role: "ranked",
        scope: "a code editor",
      },
      { id: "", name: "Blank", role: "ranked", scope: "nope" },
      { id: "mouse", role: "ranked", scope: 12 },
      null,
    ],
  });
  assert.deepEqual(
    labels.map((label) => label.id),
    ["editor-ide", "keyboard", "mouse"],
  );
  assert.equal(
    labels.find((label) => label.id === "keyboard").description,
    "a Keyboards",
  );
  assert.equal(
    labels.find((label) => label.id === "mouse").description,
    "a mouse",
  );
  assert.equal(slotLabels(null).length, 0);
});

test("windowText keeps a nearby negation", () => {
  const text = "I no longer use Sublime Text for notes";
  const windowed = windowText(text, "Sublime Text", 8);
  assert.match(windowed, /no longer/);
  assert.equal(windowText("", "x"), "");
  assert.equal(windowText("abc", ""), "abc");
  assert.equal(windowText("plain words", "missing", 5), "plain");
  assert.match(windowText("Keyboard on the desk", "Keyboard", 4), /^Keyboard/);
  assert.equal(
    windowText("Hello Keyboard here", "Keyboard", 5),
    "ello Keyboard here",
  );
});

test("acceptProposal requires a margin over the next slot", () => {
  assert.equal(acceptProposal([], policy).reason, "no-scores");
  assert.equal(acceptProposal(null, policy).reason, "no-scores");
  assert.equal(
    acceptProposal([{ id: "keyboard", score: 0.2 }], policy).reason,
    "below-threshold",
  );
  assert.equal(
    acceptProposal([{ id: "keyboard", score: 0.95 }], policy).slot_id,
    "keyboard",
  );
  assert.equal(
    acceptProposal(
      [
        { id: "mouse", score: 0.9 },
        { id: "keyboard", score: 0.9 },
        { score: 1 },
      ],
      { threshold: 0.5, margin: 0 },
    ).slot_id,
    "keyboard",
  );
  assert.equal(
    acceptProposal(
      [
        { id: "keyboard", score: 0.8 },
        { id: "editor-ide", score: 0.75 },
      ],
      policy,
    ).reason,
    "margin",
  );
  assert.equal(
    acceptProposal(
      [
        { id: "editor-ide", score: Number.NaN },
        { id: "keyboard", score: 0.91 },
        { id: "mouse", score: 0.4 },
      ],
      policy,
    ).slot_id,
    "keyboard",
  );
});

test("model text uses the product section and not a neighboring heading", () => {
  const text = modelClaimText({
    name: "Mimestream",
    section: "Things 3",
    section_path: "Productivity",
    context: "A native Gmail client",
    excerpt: "A native Gmail client",
  });
  assert.match(text.presented, /^Mimestream\./);
  assert.match(text.presented, /Productivity/);
  assert.equal(text.presented.includes("Things 3"), false);
  assert.equal(text.presented.includes("Product:"), false);
  assert.equal(text.full.includes("A native Gmail client"), true);
  assert.deepEqual(modelClaimText(null), { full: "", presented: "" });
  assert.equal(
    modelClaimText({ name: "Desk", section: "Desk", context: "Desk" })
      .presented,
    "Desk",
  );
  const long = modelClaimText({
    name: "Keyboard",
    context: `${"pad ".repeat(80)}replaced by`,
  });
  assert.equal(long.presented.length < long.full.length, true);
});

test("a cached score still has to clear the policy", async () => {
  let calls = 0;
  const cache = new Map();
  const stats = { hits: 0, misses: 0, decisions: 0, abstained: 0 };
  const claim = {
    claim: { name: "CODE Keyboard", context: "daily driver" },
    catalog: {
      categories: [
        {
          id: "keyboard",
          name: "Keyboards",
          role: "ranked",
          scope: "a keyboard",
        },
      ],
    },
    policy,
    cache,
    cacheKey: "same",
    stats,
    classify: async () => {
      calls += 1;
      return { labels: ["a keyboard"], scores: [0.2] };
    },
  };
  const first = await applyModelProposal(claim);
  const second = await applyModelProposal(claim);
  assert.equal(first.reason, "below-threshold");
  assert.equal(second.reason, "below-threshold");
  assert.equal(calls, 1);
  assert.equal(stats.hits, 1);
  assert.equal(stats.misses, 1);
  assert.equal(stats.abstained, 2);
  const uncached = await applyModelProposal({
    claim: { name: "CODE Keyboard" },
    catalog: claim.catalog,
    policy,
    cache: new Map(),
    classify: async () => ({ labels: ["a keyboard"], scores: [0.91] }),
  });
  assert.equal(uncached.reason, "accepted");
});

test("classification fingerprints change when the catalog hash changes", () => {
  const left = classificationFingerprint({
    evidenceHash: "e",
    extractorVersion: 3,
    modelRevision: "rev",
    templateVersion: 1,
    labelHash: "l",
    catalogHash: "a",
  });
  const right = classificationFingerprint({
    evidenceHash: "e",
    extractorVersion: 3,
    modelRevision: "rev",
    templateVersion: 1,
    labelHash: "l",
    catalogHash: "b",
  });
  assert.notEqual(left, right);
  assert.equal(classificationFingerprint({}).length, 64);
  assert.equal(
    automaticPublishAllowed("I use a keyboard", "keyboard", { accepted: true }),
    true,
  );
  assert.equal(
    automaticPublishAllowed("I no longer use it", "use it", { accepted: true }),
    false,
  );
  assert.equal(
    automaticPublishAllowed("I no longer use it", "no longer use it", {
      accepted: true,
    }),
    true,
  );
  assert.equal(
    automaticPublishAllowed("I use it", "use it", { accepted: false }),
    false,
  );
  assert.equal(automaticPublishAllowed("I use it", "use it", null), false);
  assert.equal(automaticPublishAllowed("", "", { accepted: true }), true);
  assert.equal(
    automaticPublishAllowed("not this", "", { accepted: true }),
    false,
  );
});

const proposalCatalog = {
  categories: [
    { id: "keyboard", name: "Keyboards", role: "ranked", scope: "a keyboard" },
    { id: "lamp", name: "Lamps", role: "ranked", scope: "" },
    { id: "games", name: "Games", role: "excluded", scope: "a game" },
  ],
};

test("pairSlotScores keeps finite scores for known labels", () => {
  assert.deepEqual(pairSlotScores(null, null), []);
  assert.deepEqual(
    pairSlotScores({ labels: ["a keyboard"] }, [
      { id: "keyboard", description: "a keyboard" },
    ]),
    [],
  );
  assert.deepEqual(
    pairSlotScores(
      { labels: ["a keyboard", "missing", "a lamp"], scores: [0.9, 0.2, "no"] },
      [
        null,
        { id: "bare" },
        { id: "keyboard", description: "a keyboard" },
        { description: "no id" },
        { id: "lamp", description: "a lamp" },
      ],
    ),
    [{ id: "keyboard", score: 0.9 }],
  );
});

test("applyModelProposal publishes only a clear slot", async () => {
  const accepted = await applyModelProposal({
    claim: {
      name: "CODE Keyboard",
      context: "daily driver",
      section: 1,
      excerpt: "",
    },
    catalog: proposalCatalog,
    policy,
    classify: async (text, labels) => {
      assert.match(text, /CODE Keyboard/);
      assert.deepEqual(labels, ["a keyboard", "a Lamps"]);
      return { labels: ["a keyboard", "a Lamps"], scores: [0.91, 0.1] };
    },
  });
  assert.equal(accepted.slot_id, "keyboard");
  assert.equal(accepted.reason, "accepted");

  const low = await applyModelProposal({
    claim: { name: "CODE Keyboard" },
    catalog: proposalCatalog,
    policy,
    classify: async () => ({ labels: ["a keyboard"], scores: [0.2] }),
  });
  assert.equal(low.reason, "below-threshold");

  const tight = await applyModelProposal({
    claim: { name: "CODE Keyboard" },
    catalog: proposalCatalog,
    policy,
    classify: async () => ({
      labels: ["a keyboard", "a Lamps"],
      scores: [0.84, 0.8],
    }),
  });
  assert.equal(tight.reason, "margin");

  const negated = await applyModelProposal({
    claim: {
      name: "Keyboard",
      context: `${"pad ".repeat(80)}no longer`,
    },
    catalog: proposalCatalog,
    policy,
    classify: async () => ({ labels: ["a keyboard"], scores: [0.95] }),
  });
  assert.equal(negated.reason, "negation");

  const unlabeled = await applyModelProposal({
    catalog: { categories: [{ id: "games", role: "excluded" }] },
    policy,
    classify: async () => {
      throw new Error("should not classify");
    },
  });
  assert.equal(unlabeled.reason, "no-labels");

  const empty = await applyModelProposal({
    catalog: proposalCatalog,
    policy,
    classify: async () => null,
  });
  assert.equal(empty.reason, "no-scores");
});

test("cacheMatchesLock requires every locked file hash", () => {
  assert.equal(cacheMatchesLock(null, null).reason, "lock has no files");
  assert.equal(
    cacheMatchesLock([{ path: "" }, { sha256: "abc" }], []).reason,
    "lock has no files",
  );
  assert.equal(
    cacheMatchesLock([{ path: "model.onnx", sha256: "abc" }], null).reason,
    "missing model.onnx",
  );
  assert.equal(
    cacheMatchesLock(
      [{ path: "model.onnx", sha256: "abc" }],
      [{ path: "model.onnx", sha256: "def" }, null, { path: "model.onnx" }],
    ).reason,
    "hash mismatch model.onnx",
  );
  assert.equal(
    cacheMatchesLock(
      [{ path: "model.onnx", sha256: "abc" }],
      [
        { path: "model.onnx", sha256: "abc" },
        { path: "extra.bin", sha256: "fff" },
      ],
    ).ok,
    true,
  );
});

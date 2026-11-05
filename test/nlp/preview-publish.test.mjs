/**
 * Goal: Local preview publish defaults on; CI stays shadow unless opted in.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  isCiEnvironment,
  resolvePreviewPublish,
} from "../../scripts/nlp/preview-publish.mjs";

/**
 * Runs a callback with temporary process.env overrides, then restores them.
 * @param {Record<string, string|undefined>} values
 * @param {() => void} fn
 * @returns {void}
 */
function withEnv(values, fn) {
  /** @type {Record<string, string|undefined>} */
  const previous = {};

  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];

    if (values[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = values[key];
    }
  }

  try {
    fn();
  } finally {
    for (const key of Object.keys(previous)) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

test("isCiEnvironment detects CI and GITHUB_ACTIONS", () => {
  withEnv({ CI: undefined, GITHUB_ACTIONS: undefined }, () => {
    assert.equal(isCiEnvironment(), false);
  });
  withEnv({ CI: "true", GITHUB_ACTIONS: undefined }, () => {
    assert.equal(isCiEnvironment(), true);
  });
  withEnv({ CI: undefined, GITHUB_ACTIONS: "true" }, () => {
    assert.equal(isCiEnvironment(), true);
  });
});

test("resolvePreviewPublish defaults on locally and off in CI", () => {
  withEnv(
    {
      CI: undefined,
      GITHUB_ACTIONS: undefined,
      JOSHTERNET_USES_PUBLISH: undefined,
    },
    () => {
      assert.equal(resolvePreviewPublish("JOSHTERNET_USES_PUBLISH"), true);
    },
  );
  withEnv(
    {
      CI: "true",
      GITHUB_ACTIONS: undefined,
      JOSHTERNET_USES_PUBLISH: undefined,
    },
    () => {
      assert.equal(resolvePreviewPublish("JOSHTERNET_USES_PUBLISH"), false);
    },
  );
});

test("resolvePreviewPublish honors explicit and env overrides", () => {
  withEnv({ CI: "true", JOSHTERNET_SEEKING_PUBLISH: undefined }, () => {
    assert.equal(
      resolvePreviewPublish("JOSHTERNET_SEEKING_PUBLISH", true),
      true,
    );
    assert.equal(
      resolvePreviewPublish("JOSHTERNET_SEEKING_PUBLISH", false),
      false,
    );
  });
  withEnv({ CI: "true", JOSHTERNET_USES_PUBLISH: "1" }, () => {
    assert.equal(resolvePreviewPublish("JOSHTERNET_USES_PUBLISH"), true);
  });
  withEnv(
    {
      CI: undefined,
      GITHUB_ACTIONS: undefined,
      JOSHTERNET_USES_PUBLISH: "0",
    },
    () => {
      assert.equal(resolvePreviewPublish("JOSHTERNET_USES_PUBLISH"), false);
    },
  );
  withEnv({ CI: "1", GITHUB_ACTIONS: undefined }, () => {
    assert.equal(isCiEnvironment(), true);
    assert.equal(resolvePreviewPublish(""), false);
  });
  withEnv(
    {
      CI: undefined,
      GITHUB_ACTIONS: undefined,
      JOSHTERNET_USES_PUBLISH: "false",
    },
    () => {
      assert.equal(resolvePreviewPublish("JOSHTERNET_USES_PUBLISH"), false);
    },
  );
});

#!/usr/bin/env node
/**
 * Goal & Constraints:
 * Dev/CI CLI to fetch <origin>/.well-known/josh and validate against RFC-JOSH-0002
 * using the site's declaration-validate helpers. Not a visitor-facing page.
 * Inputs: origin URL. Outputs: human + JSON report. No secrets. No silent coercion.
 *
 * @example
 * node scripts/declaration-verify.mjs https://example.invalid
 * npm run declaration:verify -- https://example.invalid --json
 */

import { pathToFileURL } from "node:url";

import {
  classifyLiveResponse,
  declarationURL,
  validateDeclaration,
} from "../assets/js/declaration-validate.js";

const MAX_REDIRECTS = 5;

/**
 * @typedef {object} RedirectHop
 * @property {number} status
 * @property {string} from
 * @property {string} to
 */

/**
 * @typedef {object} VerifyReport
 * @property {string} requestedOrigin
 * @property {string} requestURL
 * @property {number | null} status
 * @property {string | null} finalURL
 * @property {RedirectHop[]} redirectChain
 * @property {string} contentType
 * @property {string | null} body
 * @property {boolean} sameOrigin
 * @property {{ ok: boolean, identity: string | null, reasons: string[] } | null} json
 * @property {{ kind: string, summary: string, details: string[] }} classification
 * @property {string | null} error
 */

/**
 * Parses CLI argv into origin and flags.
 * @param {string[]} argv - Process arguments after node + script.
 * @returns {{ origin: string | null, json: boolean, help: boolean }}
 */
function parseArgs(argv) {
  let json = false;
  let help = false;
  /** @type {string | null} */
  let origin = null;

  for (const arg of argv) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (!arg.startsWith("-") && origin === null) {
      origin = arg;
    }
  }

  return { origin, json, help };
}

/**
 * Follows same-origin redirects manually and returns the final response.
 * @param {string} startURL - Declaration URL.
 * @param {string} requestedOrigin - Origin under evaluation.
 * @returns {Promise<{ status: number | null, finalURL: string | null, contentType: string, body: string | null, redirectChain: RedirectHop[], sameOrigin: boolean, error: string | null }>}
 */
async function fetchDeclaration(startURL, requestedOrigin) {
  /** @type {RedirectHop[]} */
  const redirectChain = [];
  let currentURL = startURL;
  let sameOrigin = true;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response;

    try {
      response = await fetch(currentURL, {
        method: "GET",
        redirect: "manual",
        headers: { Accept: "application/json, */*" },
      });
    } catch (error) {
      return {
        status: null,
        finalURL: currentURL,
        contentType: "",
        body: null,
        redirectChain,
        sameOrigin,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    const status = response.status;
    const location = response.headers.get("location");

    if (status >= 300 && status < 400 && location) {
      const nextURL = new URL(location, currentURL).href;
      redirectChain.push({ status, from: currentURL, to: nextURL });

      let nextOrigin = "";
      try {
        nextOrigin = new URL(nextURL).origin;
      } catch {
        nextOrigin = "";
      }

      if (nextOrigin && nextOrigin !== requestedOrigin) {
        sameOrigin = false;
        return {
          status,
          finalURL: nextURL,
          contentType: response.headers.get("content-type") || "",
          body: null,
          redirectChain,
          sameOrigin,
          error: null,
        };
      }

      currentURL = nextURL;
      continue;
    }

    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();

    return {
      status,
      finalURL: currentURL,
      contentType,
      body,
      redirectChain,
      sameOrigin,
      error: null,
    };
  }

  return {
    status: null,
    finalURL: currentURL,
    contentType: "",
    body: null,
    redirectChain,
    sameOrigin,
    error: `Exceeded ${MAX_REDIRECTS} redirects.`,
  };
}

/**
 * Verifies a live origin's /.well-known/josh declaration.
 * @param {string} originText - Origin or URL whose origin is evaluated.
 * @returns {Promise<VerifyReport>}
 */
export async function verifyOrigin(originText) {
  const target = declarationURL(originText);

  if ("error" in target) {
    return {
      requestedOrigin: "",
      requestURL: "",
      status: null,
      finalURL: null,
      redirectChain: [],
      contentType: "",
      body: null,
      sameOrigin: true,
      json: null,
      classification: {
        kind: "unread",
        summary: target.error,
        details: [],
      },
      error: target.error,
    };
  }

  const requestedOrigin = new URL(target.url).origin;
  const fetched = await fetchDeclaration(target.url, requestedOrigin);

  if (fetched.error && fetched.status === null && fetched.body === null) {
    return {
      requestedOrigin,
      requestURL: target.url,
      status: null,
      finalURL: fetched.finalURL,
      redirectChain: fetched.redirectChain,
      contentType: "",
      body: null,
      sameOrigin: fetched.sameOrigin,
      json: null,
      classification: {
        kind: "unread",
        summary:
          "The declaration could not be read. That is not an invalid file, and it is not a withdrawal.",
        details: [fetched.error],
      },
      error: fetched.error,
    };
  }

  const classification = classifyLiveResponse({
    requestedOrigin,
    finalURL: fetched.finalURL,
    status: fetched.status,
    contentType: fetched.contentType,
    body: fetched.body,
  });

  /** @type {VerifyReport["json"]} */
  let json = null;
  if (
    fetched.body !== null &&
    fetched.status !== null &&
    fetched.status < 300
  ) {
    const declaration = validateDeclaration(fetched.body);
    json = {
      ok: declaration.ok,
      identity: declaration.identity,
      reasons: declaration.reasons,
    };
  }

  return {
    requestedOrigin,
    requestURL: target.url,
    status: fetched.status,
    finalURL: fetched.finalURL,
    redirectChain: fetched.redirectChain,
    contentType: fetched.contentType,
    body: fetched.body,
    sameOrigin: fetched.sameOrigin,
    json,
    classification: {
      kind: classification.kind,
      summary: classification.summary,
      details: classification.details,
    },
    error: null,
  };
}

/**
 * Prints a human-readable report to stdout.
 * @param {VerifyReport} report
 * @returns {void}
 */
function printHuman(report) {
  if (report.error && !report.requestURL) {
    console.error(report.error);
    return;
  }

  console.log(`Requested origin: ${report.requestedOrigin}`);
  console.log(`Request URL:      ${report.requestURL}`);
  console.log(`Final URL:        ${report.finalURL ?? "(none)"}`);
  console.log(`HTTP status:      ${report.status ?? "(none)"}`);
  console.log(`Content-Type:     ${report.contentType || "(none)"}`);
  console.log(`Same origin:      ${report.sameOrigin ? "yes" : "no"}`);
  if (report.redirectChain.length > 0) {
    console.log("Redirects:");
    for (const hop of report.redirectChain) {
      console.log(`  ${hop.status} ${hop.from} -> ${hop.to}`);
    }
  }
  console.log(`Classification:   ${report.classification.kind}`);
  console.log(`Summary:          ${report.classification.summary}`);
  if (report.json) {
    console.log(`JSON ok:          ${report.json.ok}`);
    console.log(`Identity:         ${report.json.identity ?? "(n/a)"}`);
  }
  if (report.body !== null) {
    console.log("Body:");
    console.log(report.body);
  }
}

/**
 * CLI entrypoint.
 * @returns {Promise<number>} Process exit code.
 */
async function main() {
  const { origin, json, help } = parseArgs(process.argv.slice(2));

  if (help || !origin) {
    console.log(`Usage: npm run declaration:verify -- <origin> [--json]

Fetches <origin>/.well-known/josh and validates RFC-JOSH-0002 semantics.
Dev/CI only; not published with the site.`);
    return help ? 0 : 2;
  }

  const report = await verifyOrigin(origin);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }

  if (report.error && !report.requestURL) {
    return 2;
  }

  if (report.classification.kind === "declaration" && report.json?.ok) {
    return 0;
  }

  return 1;
}

const isMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().then((code) => {
    process.exitCode = code;
  });
}

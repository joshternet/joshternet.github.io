import {
  classifyLiveResponse,
  declarationURL,
  validateDeclaration,
} from "./declaration-validate.mjs";

const PAUSE_MS = 450;

const pasteForm = document.querySelector("[data-declaration-paste]");
const pasteInput = document.querySelector("[data-declaration-text]");
const pasteField = document.querySelector("[data-declaration-paste-field]");
const pasteMirror = document.querySelector("[data-declaration-mirror]");
const pasteResult = document.querySelector("[data-declaration-paste-result]");
const pasteError = document.querySelector("[data-declaration-paste-error]");
const originForm = document.querySelector("[data-declaration-origin]");
const originInput = document.querySelector("[data-declaration-origin-input]");
const originResult = document.querySelector("[data-declaration-origin-result]");
const originError = document.querySelector("[data-declaration-origin-error]");
const checkConfig = document.querySelector("[data-declaration-check-config]");
const checkApi = checkConfig?.getAttribute("data-declaration-check-api") || "";

let pasteTimer = 0;
let originTimer = 0;
let originRequest = 0;

if (
  pasteForm &&
  pasteInput &&
  pasteField &&
  pasteMirror &&
  pasteResult &&
  pasteError &&
  originForm &&
  originInput &&
  originResult &&
  originError
) {
  paintMirror(pasteInput.value, null);

  pasteInput.addEventListener("input", () => {
    window.clearTimeout(pasteTimer);

    if (pasteInput.value.trim() === "") {
      resetField(pasteField, pasteInput, pasteError);
      clearResult(pasteResult);
      paintMirror("", null);
      return;
    }

    pasteTimer = window.setTimeout(checkPaste, PAUSE_MS);
  });

  pasteInput.addEventListener("scroll", () => {
    pasteMirror.scrollTop = pasteInput.scrollTop;
    pasteMirror.scrollLeft = pasteInput.scrollLeft;
  });

  pasteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    window.clearTimeout(pasteTimer);

    if (pasteInput.value.trim() === "") {
      resetField(pasteField, pasteInput, pasteError);
      clearResult(pasteResult);
      paintMirror("", null);
      return;
    }

    checkPaste();
  });

  originInput.addEventListener("input", () => {
    window.clearTimeout(originTimer);

    if (originInput.value.trim() === "") {
      resetField(originInput, originInput, originError);
      clearResult(originResult);
      return;
    }

    originTimer = window.setTimeout(checkOriginField, PAUSE_MS);
  });

  originForm.addEventListener("submit", (event) => {
    event.preventDefault();
    window.clearTimeout(originTimer);

    if (originInput.value.trim() === "") {
      resetField(originInput, originInput, originError);
      clearResult(originResult);
      return;
    }

    checkOriginField();
  });
}

/**
 * Checks only the pasted text and writes only to the paste result.
 */
function checkPaste() {
  const declaration = validateDeclaration(pasteInput.value);
  const kind = declaration.ok ? "valid" : "invalid";

  paintMirror(pasteInput.value, declaration.ok ? null : declaration.span);
  markField(pasteField, pasteInput, pasteError, {
    kind,
    error: declaration.ok ? "" : declaration.reasons[0],
  });
  showMessage(pasteResult, {
    kind,
    title: declaration.ok ? "This file is valid." : "This file is not valid.",
    summary: declaration.reasons[0],
    details: declaration.rule ? [ruleLine(declaration.rule)] : [],
  });
}

/**
 * Checks only the origin field and writes only to the origin result.
 */
function checkOriginField() {
  const built = declarationURL(originInput.value);

  if ("error" in built) {
    if (originInput.value.trim() === "") {
      resetField(originInput, originInput, originError);
      clearResult(originResult);
      return;
    }

    markField(originInput, originInput, originError, {
      kind: "invalid",
      error: built.error,
    });
    showMessage(originResult, {
      kind: "invalid",
      title: "That origin cannot be checked.",
      summary: built.error,
      details: built.rule ? [ruleLine(built.rule)] : [],
    });
    return;
  }

  checkOrigin(built.url);
}

/**
 * Reads one live declaration through the Joshternet check API and reports
 * only in the origin result. Direct browser fetches fail for publishers that
 * do not send CORS headers, including otherwise valid declarations.
 * @param {string} url
 */
async function checkOrigin(url) {
  const requestId = originRequest + 1;

  originRequest = requestId;

  const requestedOrigin = new URL(url).origin;

  if (!checkApi) {
    markField(originInput, originInput, originError, {
      kind: "unread",
      error: "",
    });
    showMessage(originResult, {
      kind: "unread",
      title: "This live origin could not be read.",
      summary:
        "The live checker is not configured on this page, so the declaration cannot be retrieved.",
      details: [`Looked up ${url}.`],
    });
    return;
  }

  markField(originInput, originInput, originError, {
    kind: "pending",
    error: "",
  });
  showMessage(originResult, {
    kind: "pending",
    title: "Reading the live declaration…",
    summary: `Requesting ${url}`,
    details: [
      "RFC-JOSH-0002 §3.2 Path. The canonical path is /.well-known/josh.",
    ],
  });

  try {
    const endpoint = new URL(checkApi);

    endpoint.searchParams.set("origin", requestedOrigin);

    const response = await fetch(endpoint, {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (requestId !== originRequest) {
      return;
    }

    if (!response.ok) {
      let message =
        "The live checker could not complete this request. That is not an invalid file, and it is not a withdrawal.";

      try {
        const failure = await response.json();

        if (typeof failure?.message === "string" && failure.message) {
          message = failure.message;
        }
      } catch {
        // Keep the generic unread summary when the error body is unavailable.
      }

      markField(originInput, originInput, originError, {
        kind: "unread",
        error: "",
      });
      showMessage(originResult, {
        kind: "unread",
        title: "This live origin could not be read.",
        summary: message,
        details: [
          `Looked up ${url}.`,
          "RFC-JOSH-0002 §11 Removal and §9 Retrieval. A DNS failure, TLS failure, timeout, or a response the browser is not allowed to read does not establish withdrawal.",
        ],
      });
      return;
    }

    const payload = await response.json();

    if (payload.error === "redirect") {
      const outcome = classifyLiveResponse({
        requestedOrigin: payload.requestedOrigin || requestedOrigin,
        finalURL: payload.finalURL || null,
        status: payload.status,
        contentType: payload.contentType || "",
        body: null,
      });

      markField(originInput, originInput, originError, {
        kind: "unread",
        error: "",
      });
      showMessage(originResult, {
        kind: "unread",
        title: "This live origin could not be read.",
        summary: outcome.summary,
        details: [
          ...(outcome.details ?? []),
          outcome.rule ? ruleLine(outcome.rule) : "",
          `Looked up ${url}.`,
        ].filter(Boolean),
      });
      return;
    }

    const outcome = classifyLiveResponse({
      requestedOrigin: payload.requestedOrigin || requestedOrigin,
      finalURL: payload.finalURL || null,
      status: payload.status,
      contentType: payload.contentType || "",
      body: payload.body,
    });

    const declaration = outcome.declaration;
    const kind =
      outcome.kind === "declaration"
        ? declaration?.ok
          ? "valid"
          : "invalid"
        : outcome.kind;
    const title =
      kind === "valid"
        ? "This live origin publishes a valid declaration."
        : kind === "invalid"
          ? "This live origin returned an invalid declaration."
          : kind === "unpublished"
            ? "This live origin is not publishing a declaration."
            : "This live origin could not be read.";
    const fieldError =
      kind === "invalid" ? declaration?.reasons[0] || outcome.summary : "";

    markField(originInput, originInput, originError, {
      kind,
      error: fieldError,
    });
    showMessage(originResult, {
      kind,
      title,
      summary: outcome.summary,
      details: [
        ...(outcome.details ?? []),
        outcome.rule ? ruleLine(outcome.rule) : "",
        declaration?.rule && declaration.rule !== outcome.rule
          ? ruleLine(declaration.rule)
          : "",
        typeof payload.body === "string" && payload.body.length > 0
          ? `Response body:\n${payload.body}`
          : "",
      ].filter(Boolean),
    });
  } catch {
    if (requestId !== originRequest) {
      return;
    }

    markField(originInput, originInput, originError, {
      kind: "unread",
      error: "",
    });
    showMessage(originResult, {
      kind: "unread",
      title: "This live origin could not be read.",
      summary:
        "The live checker could not be reached from this browser. That is not an invalid file, and it is not a withdrawal.",
      details: [
        `Looked up ${url}.`,
        "RFC-JOSH-0002 §11 Removal and §9 Retrieval. A DNS failure, TLS failure, timeout, or a response the browser is not allowed to read does not establish withdrawal.",
      ],
    });
  }
}

/**
 * Colors a field and shows a field error only when that field is invalid.
 * @param {HTMLElement} field
 * @param {HTMLElement} input
 * @param {HTMLElement} errorEl
 * @param {{ kind: string, error: string }} state
 */
function markField(field, input, errorEl, state) {
  field.setAttribute("data-field-state", state.kind);
  input.setAttribute(
    "aria-invalid",
    state.kind === "invalid" ? "true" : "false",
  );

  if (state.kind === "invalid" && state.error) {
    errorEl.hidden = false;
    errorEl.textContent = state.error;
    return;
  }

  errorEl.hidden = true;
  errorEl.textContent = "";
}

/**
 * Clears field coloring and the attached field error.
 * @param {HTMLElement} field
 * @param {HTMLElement} input
 * @param {HTMLElement} errorEl
 */
function resetField(field, input, errorEl) {
  field.removeAttribute("data-field-state");
  input.removeAttribute("aria-invalid");
  errorEl.hidden = true;
  errorEl.textContent = "";
}

/**
 * @param {HTMLElement} target
 * @param {{ kind: string, title: string, summary: string, details: string[] }} outcome
 */
function showMessage(target, outcome) {
  target.hidden = false;
  target.className = `declaration-result declaration-result--${outcome.kind}`;
  target.replaceChildren();

  const title = document.createElement("strong");

  title.className = "declaration-result__title";
  title.textContent = outcome.title;
  target.append(title);

  const summary = document.createElement("p");

  summary.textContent = outcome.summary;
  target.append(summary);

  const seen = new Set([outcome.summary, outcome.title]);

  for (const detail of outcome.details ?? []) {
    if (!detail || seen.has(detail)) {
      continue;
    }

    seen.add(detail);

    const line = document.createElement("p");

    if (detail.includes("\n")) {
      line.className = "declaration-result__body";
      line.textContent = detail;
    } else {
      line.textContent = detail;
    }

    target.append(line);
  }
}

/**
 * @param {HTMLElement} target
 */
function clearResult(target) {
  target.hidden = true;
  target.className = "declaration-result";
  target.replaceChildren();
}

/**
 * @param {{ rfc: string, section: string, text: string }} rule
 * @returns {string}
 */
function ruleLine(rule) {
  return `${rule.rfc} ${rule.section}. ${rule.text}`;
}

/**
 * @param {string} source
 * @param {{ start: number, end: number } | null} span
 */
function paintMirror(source, span) {
  pasteMirror.replaceChildren();

  if (!span || span.end <= span.start) {
    pasteMirror.textContent = source.length > 0 ? source : " ";
    pasteMirror.scrollTop = pasteInput.scrollTop;
    return;
  }

  const start = Math.max(0, Math.min(span.start, source.length));
  const end = Math.max(start, Math.min(span.end, source.length));

  pasteMirror.append(source.slice(0, start));

  const mark = document.createElement("mark");

  mark.className = "declaration-error";
  mark.textContent = source.slice(start, end) || " ";
  pasteMirror.append(mark);
  pasteMirror.append(source.slice(end));

  if (!source.endsWith("\n")) {
    pasteMirror.append("\n");
  }

  pasteMirror.scrollTop = pasteInput.scrollTop;
}

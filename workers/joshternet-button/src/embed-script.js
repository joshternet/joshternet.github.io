/**
 * Goal & Constraints:
 * Async embed that reads window.location.origin, asks Joshternet for the
 * registry-backed button state, and inserts linked inline SVG. Renders
 * nothing when the registry is unavailable. Does not load image files.
 */

import { BUTTON_STATES } from "./button-state.js";
import { svgMarkupForState } from "./button-artwork.js";

/**
 * @param {{
 *   version: string,
 *   siteOrigin: string,
 * }} options
 * @returns {string}
 */
export function buildEmbedScript({ version, siteOrigin }) {
  const site = JSON.stringify(siteOrigin);
  const ver = JSON.stringify(version);
  /** @type {Record<string, string>} */
  const artwork = {};

  for (const [state, meta] of Object.entries(BUTTON_STATES)) {
    artwork[state] = svgMarkupForState(state, meta.alt);
  }

  const artworkLiteral = JSON.stringify(artwork);

  return `/*! Joshternet button embed ${version} */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script || !script.parentNode) {
    return;
  }

  var siteOrigin = ${site};
  var version = ${ver};
  var artwork = ${artworkLiteral};
  var apiBase = new URL(script.src).origin;
  var origin = window.location.origin;
  var url =
    apiBase +
    "/api/button-state?origin=" +
    encodeURIComponent(origin) +
    "&v=" +
    encodeURIComponent(version);

  fetch(url, {
    credentials: "omit",
    cache: "default",
  })
    .then(function (response) {
      if (!response.ok) {
        return null;
      }
      return response.json();
    })
    .then(function (payload) {
      if (
        !payload ||
        payload.ok !== true ||
        typeof payload.state !== "string" ||
        payload.state === "unavailable" ||
        typeof payload.href !== "string" ||
        typeof payload.alt !== "string" ||
        typeof artwork[payload.state] !== "string"
      ) {
        return;
      }

      var dest;
      var expectedOrigin;

      try {
        dest = new URL(payload.href);
        expectedOrigin = new URL(siteOrigin).origin;
      } catch {
        return;
      }

      if (dest.origin !== expectedOrigin) {
        return;
      }

      var link = document.createElement("a");
      link.href = dest.href;
      link.rel = "noopener";
      link.referrerPolicy = "origin";
      link.setAttribute(
        "aria-label",
        typeof payload.linkLabel === "string" && payload.linkLabel
          ? payload.linkLabel
          : payload.alt,
      );

      var holder = document.createElement("span");
      holder.innerHTML = artwork[payload.state];
      var svg = holder.firstChild;
      if (!svg) {
        return;
      }

      link.appendChild(svg);
      script.parentNode.insertBefore(link, script.nextSibling);
      void siteOrigin;
    })
    .catch(function () {});
})();
`;
}

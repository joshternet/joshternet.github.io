/**
 * Goal & Constraints:
 * Async embed that reads window.location.origin, asks Joshternet for the
 * registry-backed button state, and inserts a linked web button.
 * Renders nothing when the registry is unavailable.
 */

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

  return `/*! Joshternet button embed ${version} */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script || !script.parentNode) {
    return;
  }

  var siteOrigin = ${site};
  var version = ${ver};
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
        typeof payload.imageURL !== "string" ||
        typeof payload.href !== "string" ||
        typeof payload.alt !== "string"
      ) {
        return;
      }

      var link = document.createElement("a");
      link.href = payload.href;
      link.rel = "noopener noreferrer";
      link.setAttribute(
        "aria-label",
        typeof payload.linkLabel === "string" && payload.linkLabel
          ? payload.linkLabel
          : payload.alt,
      );

      var img = document.createElement("img");
      // Prefer the Worker image route so local embeds do not depend on
      // production Pages assets being deployed yet.
      img.src =
        apiBase +
        "/button?origin=" +
        encodeURIComponent(origin) +
        "&v=" +
        encodeURIComponent(version);
      img.width = 88;
      img.height = 31;
      img.alt = payload.alt;
      img.decoding = "async";
      img.loading = "lazy";

      link.appendChild(img);
      script.parentNode.insertBefore(link, script.nextSibling);
      void siteOrigin;
    })
    .catch(function () {});
})();
`;
}

/**
 * Goal & Constraints:
 * Client search over the compact /search/index.json corpus. Textual scores
 * only. Does not load site_signals.
 */
(() => {
  const input = document.querySelector("[data-search-input]");
  const results = document.querySelector("[data-search-results]");
  const status = document.querySelector("[data-search-status]");

  if (!input || !results || !status) {
    return;
  }

  /**
   * @param {string} value
   * @returns {string}
   */
  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  /**
   * @param {string} iso
   * @returns {string}
   */
  function formatPublishedDate(iso) {
    if (!iso) {
      return "";
    }

    const date = new Date(iso);

    if (!Number.isFinite(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  /**
   * Renders one hit with the What's New activity-card markup.
   * @param {Record<string, unknown>} document
   * @returns {string}
   */
  function renderCard(document) {
    const href = String(document.url || "");
    const external = href.startsWith("http");
    const title = escapeHTML(String(document.title || href));
    const summary = String(document.summary || "");
    const author = String(document.site_title || "");
    const domain = String(document.domain || "");
    const publishedAt = String(document.published_at || "");
    const image = String(document.image || "");
    const topics = Array.isArray(document.topics) ? document.topics : [];
    const dateLabel = formatPublishedDate(publishedAt);
    let titleLink = `<a class="u-url" href="${escapeHTML(href)}">${title}</a>`;

    if (external) {
      titleLink = `<a class="u-url" href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${title} <span aria-hidden="true">↗</span><span class="visually-hidden">(opens on the publisher’s site)</span></a>`;
    }

    let media = "";

    if (image.startsWith("https://")) {
      let mediaAttrs = `class="activity-card__media" href="${escapeHTML(href)}" tabindex="-1" aria-hidden="true"`;

      if (external) {
        mediaAttrs += ' target="_blank" rel="noopener noreferrer"';
      }

      media = `<a ${mediaAttrs}><img class="u-photo" src="${escapeHTML(image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>`;
    }

    let dateMarkup = "";

    if (dateLabel) {
      dateMarkup = `<time class="activity-card__date dt-published" datetime="${escapeHTML(publishedAt)}">${escapeHTML(dateLabel)}</time>`;
    }

    let authorMarkup = "";

    if (author && author !== String(document.title || "")) {
      authorMarkup = `<p class="activity-card__author p-author h-card"><span class="p-name">${escapeHTML(author)}</span></p>`;
    }

    let summaryMarkup = "";

    if (summary) {
      summaryMarkup = `<p class="activity-card__summary p-summary">${escapeHTML(summary)}</p>`;
    }

    const topicSpans = topics
      .map(
        (topic) =>
          `<span class="p-category">${escapeHTML(String(topic))}</span>`,
      )
      .join("");

    let domainMarkup = "";

    if (domain) {
      domainMarkup = `<p class="activity-card__domain">${escapeHTML(domain)}</p>`;
    }

    return `<li class="activity-card h-entry"><article>${media}<div class="activity-card__body"><div class="activity-card__heading"><h2 class="activity-card__title p-name">${titleLink}</h2>${dateMarkup}</div>${authorMarkup}${summaryMarkup}<div class="activity-card__footer"><p class="activity-card__topics">${topicSpans}</p>${domainMarkup}</div></div></article></li>`;
  }

  /**
   * @param {string} query
   * @returns {string[]}
   */
  function tokens(query) {
    return query
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }

  /**
   * @param {string} query
   * @param {Record<string, unknown>} document
   * @returns {number}
   */
  function score(query, document) {
    const parts = tokens(query);

    if (parts.length === 0) {
      return 0;
    }

    const title = String(document.title || "").toLowerCase();
    const summary = String(document.summary || "").toLowerCase();
    const domain = String(document.domain || "").toLowerCase();
    const topics = (Array.isArray(document.topics) ? document.topics : [])
      .join(" ")
      .toLowerCase();
    let total = 0;

    for (const token of parts) {
      if (title === token || domain === token) {
        total += 12;
      } else if (title.includes(token)) {
        total += 8;
      }

      if (topics.includes(token)) {
        total += 5;
      }

      if (summary.includes(token)) {
        total += 2;
      }

      if (domain.includes(token)) {
        total += 3;
      }
    }

    return total;
  }

  let documents = [];
  let type = "all";

  /**
   * @returns {void}
   */
  function render() {
    const query = input.value.trim();

    if (!query) {
      results.innerHTML = "";
      status.textContent = "Type a word from a title, domain, or topic.";
      return;
    }

    const ranked = documents
      .filter((document) => type === "all" || document.type === type)
      .map((document) => ({ document, value: score(query, document) }))
      .filter((entry) => entry.value > 0)
      .sort(
        (left, right) =>
          right.value - left.value ||
          String(left.document.title).localeCompare(
            String(right.document.title),
          ),
      );

    const counts = new Map();
    const capped = [];

    for (const entry of ranked) {
      if (entry.document.type === "content") {
        const origin = String(entry.document.origin || "");
        const used = counts.get(origin) || 0;

        if (used >= 3) {
          continue;
        }

        counts.set(origin, used + 1);
      }

      capped.push(entry);

      if (capped.length >= 40) {
        break;
      }
    }

    status.textContent =
      capped.length === 0
        ? "No matches in the indexed Joshternet corpus."
        : `${capped.length} matching ${capped.length === 1 ? "result" : "results"}`;

    results.innerHTML = capped
      .map((entry) => renderCard(entry.document))
      .join("");
  }

  for (const radio of document.querySelectorAll("[data-search-type]")) {
    radio.addEventListener("change", () => {
      if (radio.checked) {
        type = radio.value;
        render();
      }
    });
  }

  input.addEventListener("input", render);

  fetch("/search/index.json", { credentials: "same-origin" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("index missing");
      }

      return response.json();
    })
    .then((payload) => {
      documents = Array.isArray(payload.documents) ? payload.documents : [];
      render();
    })
    .catch(() => {
      status.textContent =
        "The search index is unavailable. Browse What's New or the Network instead.";
    });
})();

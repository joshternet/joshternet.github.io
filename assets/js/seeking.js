/**
 * Goal & Constraints:
 * Category filters for /seeking/ show and hide request cards in place.
 * Uses approved visitor copy only. No-ops when filters are absent.
 */
(() => {
  const root = document.querySelector("[data-seeking]");

  if (!root) {
    return;
  }

  const filters = Array.from(root.querySelectorAll("[data-seeking-filter]"));
  const clearButton = root.querySelector("[data-seeking-clear]");
  const items = Array.from(root.querySelectorAll("[data-seeking-item]"));
  const sites = Array.from(root.querySelectorAll("[data-seeking-site]"));
  const filterEmpty = root.querySelector("[data-seeking-filter-empty]");
  const counts = root.querySelector("[data-seeking-counts]");
  const countsAll = counts ? counts.textContent.trim() : "";

  if (filters.length === 0 || items.length === 0) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const requested = String(params.get("topic") || "")
    .trim()
    .toLowerCase();
  const known = new Set(
    filters
      .map((button) => String(button.dataset.seekingFilter || "").toLowerCase())
      .filter(Boolean),
  );
  let topic =
    requested && known.has(requested) && requested !== "all"
      ? requested
      : "all";

  /**
   * Topic labels printed on the card. A joined attribute cannot be split on
   * spaces: the markdown renderer deletes the separator and glues the words.
   * @param {Element} item
   * @returns {string[]}
   */
  function itemTopics(item) {
    return Array.from(item.querySelectorAll(".p-category"))
      .map((node) => node.textContent.trim().toLowerCase())
      .filter(Boolean);
  }

  /**
   * Same request/website sentence the page prints before a topic is chosen.
   * @param {number} requests
   * @param {number} websites
   * @returns {string}
   */
  function countSentence(requests, websites) {
    const requestLabel = requests === 1 ? "1 request" : `${requests} requests`;
    const websiteLabel = websites === 1 ? "1 website" : `${websites} websites`;
    return `${requestLabel} from ${websiteLabel}`;
  }

  /**
   * Applies the active category filter to request items and site groups.
   * @returns {void}
   */
  function apply() {
    let visibleItems = 0;

    for (const item of items) {
      const categories = itemTopics(item);
      const show = topic === "all" || categories.includes(topic);
      item.hidden = !show;

      if (show) {
        visibleItems += 1;
      }
    }

    let visibleSites = 0;

    for (const site of sites) {
      const siteItems = Array.from(
        site.querySelectorAll("[data-seeking-item]"),
      );
      const anyVisible = siteItems.some((item) => !item.hidden);
      site.hidden = !anyVisible;

      if (anyVisible) {
        visibleSites += 1;
      }
    }

    if (counts) {
      counts.textContent =
        topic === "all" ? countsAll : countSentence(visibleItems, visibleSites);
    }

    for (const filter of filters) {
      const value = String(filter.dataset.seekingFilter || "").toLowerCase();
      const active = value === topic;
      filter.classList.toggle("is-active", active);
      filter.setAttribute("aria-pressed", String(active));
    }

    if (clearButton) {
      clearButton.hidden = topic === "all";
    }

    if (filterEmpty) {
      filterEmpty.hidden = visibleItems > 0;
    }

    const nextParams = new URLSearchParams(window.location.search);

    if (topic === "all") {
      nextParams.delete("topic");
    } else {
      nextParams.set("topic", topic);
    }

    const query = nextParams.toString();
    const nextURL = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextURL);
    root.dataset.seekingFilterActive = topic;
    root.dataset.seekingVisibleItems = String(visibleItems);
  }

  for (const filter of filters) {
    filter.addEventListener("click", () => {
      topic = String(filter.dataset.seekingFilter || "all").toLowerCase();
      apply();
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      topic = "all";
      apply();
    });
  }

  apply();
})();

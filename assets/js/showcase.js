/**
 * Goal & Constraints:
 * Showcase kind filters show/hide sections in place (not hash scroll-to).
 * Mirrors Network filter buttons: aria-pressed, is-active, optional ?kind=.
 * No-ops when the filter nav is absent. Privacy-safe Umami via joshternetTrack.
 */
(() => {
  const root = document.querySelector("[data-showcase]");

  if (!root) {
    return;
  }

  const filters = Array.from(root.querySelectorAll("[data-showcase-filter]"));
  const sections = Array.from(root.querySelectorAll("[data-showcase-kind]"));

  if (filters.length === 0 || sections.length === 0) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const requested = String(params.get("kind") || "")
    .trim()
    .toLowerCase();
  const known = new Set(
    filters
      .map((button) =>
        String(button.dataset.showcaseFilter || "").toLowerCase(),
      )
      .filter(Boolean),
  );
  let kind =
    requested && known.has(requested) && requested !== "all"
      ? requested
      : "all";

  /**
   * Applies the active kind filter to sections and filter button state.
   * @returns {void}
   */
  function apply() {
    let visible = 0;

    for (const section of sections) {
      const sectionKind = String(
        section.dataset.showcaseKind || "",
      ).toLowerCase();
      const show = kind === "all" || sectionKind === kind;
      section.hidden = !show;

      if (show) {
        visible += 1;
      }
    }

    for (const filter of filters) {
      const value = String(filter.dataset.showcaseFilter || "").toLowerCase();
      const active = value === kind;
      filter.classList.toggle("is-active", active);
      filter.setAttribute("aria-pressed", String(active));
    }

    const nextParams = new URLSearchParams(window.location.search);

    if (kind === "all") {
      nextParams.delete("kind");
    } else {
      nextParams.set("kind", kind);
    }

    const query = nextParams.toString();
    const nextURL = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextURL);

    root.dataset.showcaseFilterActive = kind;
    root.dataset.showcaseVisibleSections = String(visible);
  }

  /**
   * @param {string} name
   * @param {Record<string, string>} data
   * @returns {void}
   */
  function trackShowcase(name, data) {
    const track = globalThis.joshternetTrack;

    if (typeof track === "function") {
      track(name, data);
    }
  }

  for (const filter of filters) {
    filter.addEventListener("click", () => {
      kind =
        String(filter.dataset.showcaseFilter || "all").toLowerCase() || "all";
      trackShowcase("showcase-filter", { kind });
      apply();
    });
  }

  apply();
})();

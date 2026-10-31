/**
 * Goal & Constraints: Network directory filters by identity and optionally
 * sorts by discover (random, default), recent, oldest, or alphabetical.
 * Preserve ?site= deep links and keep identity + sort in the URL. Missing or
 * invalid first_participated_at values sort last for date-based modes.
 */
(() => {
  const toolbar = document.querySelector("[data-network-toolbar]");
  const grid = document.querySelector("[data-network-grid]");
  const cards = Array.from(document.querySelectorAll("[data-network-card]"));
  const filters = Array.from(
    document.querySelectorAll("[data-network-filter]"),
  );
  const sorts = Array.from(document.querySelectorAll("[data-network-sort]"));
  const count = document.querySelector("[data-network-count]");
  const countLabel = document.querySelector("[data-network-count-label]");

  if (!toolbar || !grid || cards.length === 0) {
    return;
  }

  toolbar.hidden = false;

  /**
   * Returns a new array in Fisher-Yates order.
   * @param {Element[]} values
   * @returns {Element[]}
   */
  function shuffle(values) {
    const copy = values.slice();

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[target]] = [copy[target], copy[index]];
    }

    return copy;
  }

  /**
   * @param {string | undefined} value
   * @returns {number | null}
   */
  function parseParticipatedAt(value) {
    if (!value || typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const parsed = Date.parse(trimmed);

    if (Number.isNaN(parsed)) {
      return null;
    }

    return parsed;
  }

  /**
   * @param {Element} card
   * @returns {string}
   */
  function cardLabel(card) {
    return (
      card.dataset.title ||
      card.dataset.domain ||
      card.dataset.origin ||
      ""
    ).toLowerCase();
  }

  /**
   * @param {Element} card
   * @returns {string}
   */
  function cardOrigin(card) {
    return (card.dataset.origin || card.dataset.domain || "").toLowerCase();
  }

  /**
   * @param {Element} left
   * @param {Element} right
   * @param {"recent" | "oldest" | "alpha"} mode
   * @returns {number}
   */
  function compareCards(left, right, mode) {
    if (mode === "alpha") {
      const labelCompare = cardLabel(left).localeCompare(cardLabel(right));

      if (labelCompare !== 0) {
        return labelCompare;
      }

      return cardOrigin(left).localeCompare(cardOrigin(right));
    }

    const leftAt = parseParticipatedAt(left.dataset.firstParticipatedAt);
    const rightAt = parseParticipatedAt(right.dataset.firstParticipatedAt);
    const leftMissing = leftAt === null;
    const rightMissing = rightAt === null;

    if (leftMissing && rightMissing) {
      return cardOrigin(left).localeCompare(cardOrigin(right));
    }

    if (leftMissing) {
      return 1;
    }

    if (rightMissing) {
      return -1;
    }

    if (leftAt !== rightAt) {
      return mode === "recent" ? rightAt - leftAt : leftAt - rightAt;
    }

    return cardOrigin(left).localeCompare(cardOrigin(right));
  }

  const discoveryOrder = shuffle(cards);
  const surprise = grid.querySelector(".network-surprise-card");

  const params = new URLSearchParams(window.location.search);
  const requestedIdentity = params.get("identity");
  const requestedSort = params.get("sort");
  const validIdentities = new Set([
    "all",
    "affirmed",
    "declined",
    "undeclared",
  ]);
  const validSorts = new Set(["discover", "recent", "oldest", "alpha"]);

  /**
   * @param {string | null} value
   * @returns {string}
   */
  function normalizeRequestedSite(value) {
    if (!value) {
      return "";
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return "";
    }

    try {
      const url = trimmed.includes("://")
        ? new URL(trimmed)
        : new URL(`https://${trimmed}`);

      return url.hostname.replace(/\.$/, "").toLowerCase();
    } catch {
      return "";
    }
  }

  const requestedSite = normalizeRequestedSite(params.get("site"));

  const targetedCard = requestedSite
    ? cards.find((card) => {
        return (card.dataset.domain || "").toLowerCase() === requestedSite;
      })
    : null;

  let identity = validIdentities.has(requestedIdentity)
    ? requestedIdentity
    : "all";
  let sort = validSorts.has(requestedSort) ? requestedSort : "discover";
  let targetRevealed = false;

  /**
   * @returns {Element[]}
   */
  function orderedCards() {
    if (sort === "discover") {
      return discoveryOrder.slice();
    }

    return cards.slice().sort((left, right) => compareCards(left, right, sort));
  }

  function apply() {
    const ordered = orderedCards();
    let visible = 0;

    for (const card of ordered) {
      const matchesFilter =
        identity === "all" || card.dataset.identity === identity;
      const show = matchesFilter || card === targetedCard;
      card.hidden = !show;
      grid.insertBefore(card, surprise);

      if (show) {
        visible += 1;
      }
    }

    for (const filter of filters) {
      const active = filter.dataset.networkFilter === identity;
      filter.classList.toggle("is-active", active);
      filter.setAttribute("aria-pressed", String(active));
    }

    for (const control of sorts) {
      const active = control.dataset.networkSort === sort;
      control.classList.toggle("is-active", active);
      control.setAttribute("aria-pressed", String(active));
    }

    if (count) {
      count.textContent = String(visible);
    }

    if (countLabel) {
      countLabel.textContent = visible === 1 ? "site" : "sites";
    }

    const nextParams = new URLSearchParams(window.location.search);

    if (identity === "all") {
      nextParams.delete("identity");
    } else {
      nextParams.set("identity", identity);
    }

    if (sort === "discover") {
      nextParams.delete("sort");
    } else {
      nextParams.set("sort", sort);
    }

    if (requestedSite) {
      nextParams.set("site", requestedSite);
    }

    const query = nextParams.toString();
    const nextURL = `${window.location.pathname}${query ? `?${query}` : ""}`;

    window.history.replaceState(null, "", nextURL);

    if (targetedCard && !targetRevealed) {
      targetRevealed = true;

      window.requestAnimationFrame(() => {
        targetedCard.classList.add("is-targeted");

        targetedCard.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
          block: "center",
        });

        const link = targetedCard.querySelector(".network-card__link");

        if (link) {
          link.focus({
            preventScroll: true,
          });
        }

        window.setTimeout(() => {
          targetedCard.classList.remove("is-targeted");
        }, 4000);
      });
    }
  }

  /**
   * @param {string} name
   * @param {Record<string, string>} data
   * @returns {void}
   */
  function trackNetwork(name, data) {
    const track = globalThis.joshternetTrack;

    if (typeof track === "function") {
      track(name, data);
    }
  }

  for (const filter of filters) {
    filter.addEventListener("click", () => {
      identity = filter.dataset.networkFilter || "all";
      trackNetwork("network-filter", { identity });
      apply();
    });
  }

  for (const control of sorts) {
    control.addEventListener("click", () => {
      sort = control.dataset.networkSort || "discover";
      trackNetwork("network-sort", { sort });
      apply();
    });
  }

  apply();
})();

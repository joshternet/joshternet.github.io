(() => {
  const toolbar = document.querySelector("[data-network-toolbar]");
  const grid = document.querySelector("[data-network-grid]");
  const cards = Array.from(document.querySelectorAll("[data-network-card]"));
  const filters = Array.from(
    document.querySelectorAll("[data-network-filter]"),
  );
  const sort = document.querySelector("[data-network-sort]");
  const count = document.querySelector("[data-network-count]");
  const countLabel = document.querySelector("[data-network-count-label]");

  if (!toolbar || !grid || cards.length === 0) {
    return;
  }

  toolbar.hidden = false;

  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  });

  const params = new URLSearchParams(window.location.search);
  const requestedIdentity = params.get("identity");
  const validIdentities = new Set([
    "all",
    "affirmed",
    "declined",
    "undeclared",
  ]);

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

  if (
    targetedCard &&
    identity !== "all" &&
    targetedCard.dataset.identity !== identity
  ) {
    identity = targetedCard.dataset.identity;
  }

  let targetRevealed = false;

  function cardName(card) {
    return card.dataset.title || card.dataset.domain || "";
  }

  function apply() {
    const direction = sort && sort.value === "desc" ? -1 : 1;
    const ordered = cards.slice().sort((left, right) => {
      return collator.compare(cardName(left), cardName(right)) * direction;
    });

    let visible = 0;

    for (const card of ordered) {
      const show = identity === "all" || card.dataset.identity === identity;
      card.hidden = !show;

      if (show) {
        visible += 1;
      }

      grid.insertBefore(card, grid.querySelector(".network-surprise-card"));
    }

    for (const filter of filters) {
      const active = filter.dataset.networkFilter === identity;
      filter.classList.toggle("is-active", active);
      filter.setAttribute("aria-pressed", String(active));
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

  for (const filter of filters) {
    filter.addEventListener("click", () => {
      identity = filter.dataset.networkFilter;
      apply();
    });
  }

  if (sort) {
    sort.addEventListener("change", apply);
  }

  apply();
})();

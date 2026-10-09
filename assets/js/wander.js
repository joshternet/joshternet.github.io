(() => {
  const consoleElement = document.querySelector("[data-wander-console]");

  if (!consoleElement) {
    return;
  }

  const stage = consoleElement.querySelector("[data-wander-stage]");
  const goButton = consoleElement.querySelector("[data-wander-go]");
  const addressInput = consoleElement.querySelector("[data-wander-address]");
  const openButton = consoleElement.querySelector("[data-wander-open]");
  const statusElement = document.querySelector("[data-wander-status]");

  if (!stage || !goButton || !addressInput || !openButton) {
    return;
  }

  const storageKey = "joshternet-wander-v2";

  const identities = new Set(["affirmed", "declined", "undeclared"]);

  /**
   * Appends Joshternet UTM params when the shared helper is loaded.
   * @param {string} href
   * @returns {string}
   */
  function outboundHref(href) {
    const decorate = globalThis.joshternetOutboundHref;

    return typeof decorate === "function" ? decorate(href) : href;
  }

  const frameReasons = new Set([
    "allowed",
    "blocked-by-site",
    "http",
    "unknown",
  ]);

  const linkNotice =
    "Wander blocks links that leave that site, and Open opens the publisher's site in another tab.";

  let sites = [];
  let bag = [];
  let currentOrigin = null;
  let linkNoticeOpen = false;
  let lastPointer = null;
  let stopWatchingFrame = () => {};

  function announce(message) {
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  /**
   * Places the blocked-link bubble beside the pointer that tried to leave.
   * The framed document is cross-origin, so this uses the last pointer position
   * recorded over the frame. Without one, the bubble stays at the top of the stage.
   * @param {HTMLElement} bubble - Notice shown for a blocked departure.
   * @returns {void}
   */
  function placeLinkBubble(bubble) {
    const embedStage = bubble.closest(".wander-embed__stage");

    if (!embedStage || !lastPointer) {
      return;
    }

    const bounds = embedStage.getBoundingClientRect();
    const width = bubble.offsetWidth;
    const height = bubble.offsetHeight;
    let left = lastPointer.x - bounds.left + 12;
    let top = lastPointer.y - bounds.top + 12;

    if (left + width > bounds.width - 8) {
      left = lastPointer.x - bounds.left - width - 12;
    }

    if (top + height > bounds.height - 8) {
      top = lastPointer.y - bounds.top - height - 12;
    }

    const maxLeft = Math.max(8, bounds.width - width - 8);
    const maxTop = Math.max(8, bounds.height - height - 8);

    bubble.style.insetInlineStart = `${Math.min(Math.max(8, left), maxLeft)}px`;
    bubble.style.insetBlockStart = `${Math.min(Math.max(8, top), maxTop)}px`;
  }

  /**
   * Shows the blocked-link bubble beside the click and says the sentence once.
   * Focus stays on Dismiss without scrolling the page to that button.
   * @returns {void}
   */
  function showLinkBubble() {
    const bubble = stage.querySelector("[data-wander-link-notice]");

    if (!bubble) {
      return;
    }

    bubble.hidden = false;
    placeLinkBubble(bubble);

    if (linkNoticeOpen) {
      return;
    }

    linkNoticeOpen = true;
    announce(linkNotice);
    bubble.querySelector("[data-wander-dismiss-link]")?.focus({
      preventScroll: true,
    });
  }

  /**
   * Records the pointer over the framed site without taking its clicks or scrolling.
   * The cell under the pointer ignores later events so they reach the site.
   * @param {Element | null} embedStage - Stage that contains the frame.
   * @returns {ResizeObserver | null} Observer disconnected when the frame changes.
   */
  function watchPointerGrid(embedStage) {
    const grid = embedStage?.querySelector("[data-wander-pointer-grid]");

    if (!grid || !(embedStage instanceof HTMLElement)) {
      return null;
    }

    const cellSize = 32;
    let openCell = null;

    /**
     * @param {PointerEvent} event
     * @returns {void}
     */
    function rememberPointer(event) {
      const cell = event.currentTarget;

      if (!(cell instanceof HTMLElement)) {
        return;
      }

      lastPointer = { x: event.clientX, y: event.clientY };

      if (openCell && openCell !== cell) {
        openCell.style.pointerEvents = "";
      }

      cell.style.pointerEvents = "none";
      openCell = cell;
    }

    function fillGrid() {
      const columns = Math.max(1, Math.ceil(embedStage.clientWidth / cellSize));
      const rows = Math.max(1, Math.ceil(embedStage.clientHeight / cellSize));
      const count = columns * rows;

      if (grid.childElementCount === count) {
        return;
      }

      openCell = null;
      grid.replaceChildren();
      grid.style.gridTemplateColumns = `repeat(${columns}, ${cellSize}px)`;
      grid.style.gridAutoRows = `${cellSize}px`;

      const fragment = document.createDocumentFragment();

      for (let index = 0; index < count; index += 1) {
        const cell = document.createElement("div");

        cell.addEventListener("pointerover", rememberPointer);
        fragment.append(cell);
      }

      grid.append(fragment);
    }

    fillGrid();

    const observer = new ResizeObserver(fillGrid);

    observer.observe(embedStage);

    return observer;
  }

  /**
   * Hides the blocked-link bubble so another click can show it again.
   * @returns {void}
   */
  function hideLinkBubble() {
    const bubble = stage.querySelector("[data-wander-link-notice]");

    if (bubble) {
      bubble.hidden = true;
    }

    linkNoticeOpen = false;
  }

  /**
   * Loads the participant in the frame the visitor scrolls and clicks.
   * A blocked departure shows the bubble and steps back to the open page.
   * @param {HTMLIFrameElement} frame - Direct frame for the participant.
   * @param {string} origin - Framed participant origin.
   * @returns {void}
   */
  function watchFramedSite(frame, origin) {
    stopWatchingFrame();

    let departure = "idle";
    const gridObserver = watchPointerGrid(
      frame.closest(".wander-embed__stage"),
    );

    /**
     * Steps back over the browser's blocked-navigation entry.
     * The blank document is same-origin, so its history can return to the page
     * that was open. Loading the site root again would discard that page.
     * @returns {void}
     */
    function returnToOpenPage() {
      let href = null;

      try {
        href = frame.contentWindow.location.href;
      } catch {
        href = null;
      }

      if (departure === "blank" && href === "about:blank") {
        const steps = frame.contentWindow.history.length > 2 ? -2 : -1;

        departure = "back";

        try {
          frame.contentWindow.history.go(steps);
        } catch {
          departure = "idle";
          frame.src = origin;
        }

        return;
      }

      if (departure === "back") {
        departure = "idle";
      }
    }

    /**
     * @param {SecurityPolicyViolationEvent} event
     * @returns {void}
     */
    const onViolation = (event) => {
      if (event.effectiveDirective !== "frame-src" || departure !== "idle") {
        return;
      }

      let blockedOrigin = "";

      try {
        blockedOrigin = new URL(event.blockedURI).origin;
      } catch {
        return;
      }

      if (
        blockedOrigin === "" ||
        blockedOrigin === "null" ||
        blockedOrigin === origin
      ) {
        return;
      }

      departure = "blank";
      showLinkBubble();
      frame.src = "about:blank";
    };

    document.addEventListener("securitypolicyviolation", onViolation);
    stopWatchingFrame = () => {
      document.removeEventListener("securitypolicyviolation", onViolation);
      gridObserver?.disconnect();
    };

    frame.addEventListener("load", returnToOpenPage);

    frame.src = origin;
  }

  function canonicalOrigin(value) {
    if (typeof value !== "string" || value === "" || value.trim() !== value) {
      return null;
    }

    try {
      const url = new URL(value);

      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return null;
      }

      if (url.username || url.password) {
        return null;
      }

      if (url.pathname !== "/" || url.search || url.hash) {
        return null;
      }

      if (url.origin !== value) {
        return null;
      }

      return url;
    } catch {
      return null;
    }
  }

  function textValue(value, maximumLength) {
    if (typeof value !== "string") {
      return "";
    }

    return value.slice(0, maximumLength);
  }

  function screenshotPath(value) {
    if (value === "") {
      return "";
    }

    if (typeof value !== "string" || !value.startsWith("/assets/")) {
      return "";
    }

    if (value.includes("\\") || value.includes("%") || value.includes("//")) {
      return "";
    }

    try {
      const url = new URL(value, window.location.origin);

      if (
        url.origin !== window.location.origin ||
        url.search ||
        url.hash ||
        url.pathname !== value ||
        !url.pathname.startsWith("/assets/")
      ) {
        return "";
      }

      return url.pathname;
    } catch {
      return "";
    }
  }

  function validateSite(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const origin = canonicalOrigin(value.origin);

    if (!origin) {
      return null;
    }

    if (typeof value.domain !== "string" || value.domain !== origin.host) {
      return null;
    }

    if (!identities.has(value.identity)) {
      return null;
    }

    if (typeof value.embeddable !== "boolean") {
      return null;
    }

    if (!frameReasons.has(value.frame_reason)) {
      return null;
    }

    if (
      value.embeddable &&
      (origin.protocol !== "https:" || value.frame_reason !== "allowed")
    ) {
      return null;
    }

    return {
      origin: origin.origin,
      domain: origin.host,
      identity: value.identity,
      title: textValue(value.title, 256),
      description: textValue(value.description, 2_000),
      screenshot: screenshotPath(value.screenshot),
      embeddable: value.embeddable,
      frame_reason: value.frame_reason,
    };
  }

  function validateSites(data) {
    if (!Array.isArray(data)) {
      throw new Error("Network data is not an array");
    }

    const accepted = [];
    const seen = new Set();

    for (const value of data) {
      const site = validateSite(value);

      if (!site || seen.has(site.origin)) {
        continue;
      }

      seen.add(site.origin);
      accepted.push(site);
    }

    return accepted;
  }

  function shuffle(values) {
    const copy = values.slice();

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[target]] = [copy[target], copy[index]];
    }

    return copy;
  }

  function findSite(origin) {
    return sites.find((site) => site.origin === origin);
  }

  function rebuildBag() {
    bag = shuffle(sites.map((site) => site.origin));

    if (currentOrigin && bag.length > 1 && bag[0] === currentOrigin) {
      [bag[0], bag[1]] = [bag[1], bag[0]];
    }
  }

  function persist() {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          bag,
          currentOrigin,
        }),
      );
    } catch {
      // Session state is optional.
    }
  }

  function restore() {
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey));

      if (!stored || typeof stored !== "object") {
        return false;
      }

      const validOrigins = new Set(sites.map((site) => site.origin));

      bag = Array.isArray(stored.bag)
        ? stored.bag.filter((origin) => {
            return validOrigins.has(origin);
          })
        : [];

      currentOrigin =
        typeof stored.currentOrigin === "string" &&
        validOrigins.has(stored.currentOrigin)
          ? stored.currentOrigin
          : null;

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Hub origin must not be framed from local Jekyll (`127.0.0.1`) either:
   * CSP omits `site.url`, so an iframe would fail closed.
   * @param {{origin: string, domain: string}} site
   * @returns {boolean}
   */
  function isHubOrigin(site) {
    if (site.origin === window.location.origin) {
      return true;
    }

    return (
      site.domain === "joshternet.org" || site.domain === "www.joshternet.org"
    );
  }

  function fallbackReason(site) {
    if (isHubOrigin(site)) {
      return {
        message: "Joshternet isn’t embedded inside its own Wander view.",
        kind: "self",
      };
    }

    if (site.frame_reason === "blocked-by-site") {
      return {
        message:
          "This site doesn’t allow itself to be displayed inside another site, and we respect that.",
        kind: "blocked-by-site",
      };
    }

    if (site.frame_reason === "http") {
      return {
        message:
          "This site can’t be displayed securely inside Wander because it is served over HTTP.",
        kind: "http",
      };
    }

    return {
      message: "This site can’t be displayed inside Wander right now.",
      kind: "unknown",
    };
  }

  function identityClass(site) {
    return site.identity;
  }

  function networkURL(site) {
    return `/network/?site=${encodeURIComponent(site.domain)}`;
  }

  function fallbackMarkup(site) {
    const identity = identityClass(site);
    const reason = fallbackReason(site);

    const preview = site.screenshot
      ? `<img
                class="network-card__image"
                src="${escapeAttribute(site.screenshot)}"
                alt="Screenshot of ${escapeAttribute(site.title || site.domain)}"
                loading="eager"
                decoding="async"
              >`
      : `<div class="network-card__fallback" aria-hidden="true">
                <span>${escapeHTML(
                  (site.domain || "?").slice(0, 1).toUpperCase(),
                )}</span>
              </div>`;

    const description = site.description
      ? `<p class="network-card__description">${escapeHTML(
          site.description,
        )}</p>`
      : "";

    return `
            <div
                class="wander-fallback"
                data-frame-reason="${escapeAttribute(reason.kind)}"
            >
                <div class="wander-fallback__card">
                    <article
                        class="network-card network-card--${escapeAttribute(identity)}"
                    >
                        <a
                            class="network-card__link"
                            href="${escapeAttribute(outboundHref(site.origin))}"
                            target="_blank"
                            rel="noopener"
                        >
                            <div class="network-card__preview">
                                ${preview}
                            </div>

                            <div class="network-card__body">
                                <h2 class="network-card__title">
                                    ${escapeHTML(site.title || site.domain)}
                                    <span aria-hidden="true">↗</span>
                                </h2>

                                ${description}

                                <span class="network-card__domain">
                                    ${escapeHTML(site.domain)}
                                </span>
                            </div>
                        </a>
                    </article>
                </div>

                <div class="wander-fallback__notice">
                    <p>${escapeHTML(reason.message)}</p>

                    <a
                        class="wander-fallback__network"
                        href="${escapeAttribute(networkURL(site))}"
                    >
                        View in Network →
                    </a>
                </div>
            </div>
        `;
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHTML(value);
  }

  function parseAddress() {
    const site = findSite(addressInput.value.trim());

    if (!site) {
      return null;
    }

    return new URL(site.origin);
  }

  function updateOpenState() {
    openButton.disabled = !parseAddress();
  }

  function openAddress() {
    const url = parseAddress();

    if (!url) {
      addressInput.focus();
      return;
    }

    window.open(outboundHref(url.href), "_blank", "noopener");
  }

  function render(site) {
    stopWatchingFrame();

    if (!site) {
      currentOrigin = null;
      addressInput.value = "";
      openButton.disabled = true;

      stage.innerHTML = `
                <div class="wander-empty">
                    <p>There are no participating sites in Wander yet.</p>
                    <a href="/network/">Browse The Network</a>
                </div>
            `;

      announce("There are no participating sites in Wander yet.");
      persist();
      return;
    }

    currentOrigin = site.origin;
    addressInput.value = site.origin;
    updateOpenState();

    if (
      site.embeddable &&
      site.frame_reason === "allowed" &&
      site.origin.startsWith("https://") &&
      !isHubOrigin(site)
    ) {
      linkNoticeOpen = false;
      lastPointer = null;

      stage.innerHTML = `
                <div class="wander-embed">
                    <div class="wander-embed__stage">
                        <iframe
                            class="wander-frame"
                            title="${escapeAttribute(site.title || site.domain)}"
                            sandbox="allow-scripts allow-same-origin"
                            referrerpolicy="no-referrer"
                        ></iframe>
                        <div class="wander-pointer-grid" data-wander-pointer-grid aria-hidden="true"></div>
                        <div class="wander-link-bubble" data-wander-link-notice hidden>
                            <p>${escapeHTML(linkNotice)}</p>
                            <button type="button" data-wander-dismiss-link>Dismiss</button>
                        </div>
                    </div>
                </div>
            `;

      const frame = stage.querySelector(".wander-frame");

      if (frame instanceof HTMLIFrameElement) {
        watchFramedSite(frame, site.origin);
      }

      announce(`Now viewing ${site.title || site.domain}.`);
    } else {
      stage.innerHTML = fallbackMarkup(site);
      announce(`Now viewing ${site.title || site.domain}.`);
    }

    persist();
  }

  function go() {
    if (sites.length === 0) {
      render(null);
      return;
    }

    if (bag.length === 0) {
      rebuildBag();
    }

    let origin = bag.shift();

    if (sites.length > 1 && origin === currentOrigin) {
      if (bag.length === 0) {
        rebuildBag();
      }

      const alternative = bag.shift();

      if (alternative) {
        bag.push(origin);
        origin = alternative;
      }
    }

    render(findSite(origin));
  }

  fetch("/network/data.json", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Network data request failed: ${response.status}`);
      }

      return response.json();
    })
    .then((data) => {
      sites = validateSites(data);
      restore();

      if (currentOrigin) {
        render(findSite(currentOrigin));
        return;
      }

      if (bag.length === 0) {
        rebuildBag();
      }

      go();
    })
    .catch(() => {
      currentOrigin = null;
      addressInput.value = "";
      openButton.disabled = true;

      stage.innerHTML = `
                <div class="wander-empty">
                    <p>The network data could not be loaded right now.</p>
                    <a href="/network/">Browse The Network</a>
                </div>
            `;

      announce("The network data could not be loaded right now.");
    });

  stage.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    if (!target.closest("[data-wander-dismiss-link]")) {
      return;
    }

    hideLinkBubble();
  });

  goButton.addEventListener("click", go);

  openButton.addEventListener("click", openAddress);

  addressInput.addEventListener("input", updateOpenState);

  addressInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    openAddress();
  });
})();

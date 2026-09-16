(() => {
    const consoleElement = document.querySelector("[data-wander-console]");

    if (!consoleElement) {
        return;
    }

    const stage = consoleElement.querySelector("[data-wander-stage]");
    const domain = consoleElement.querySelector("[data-wander-domain]");
    const previousButton = consoleElement.querySelector("[data-wander-previous]");
    const nextButton = consoleElement.querySelector("[data-wander-next]");
    const filter = consoleElement.querySelector("[data-wander-filter]");
    const openLink = consoleElement.querySelector("[data-wander-open]");
    const networkLink = consoleElement.querySelector("[data-wander-network]");

    const storageKey = "joshternet-wander-v1";

    let sites = [];
    let pool = [];
    let bag = [];
    let history = [];
    let historyIndex = -1;

    function shuffle(values) {
        const copy = values.slice();

        for (let index = copy.length - 1; index > 0; index -= 1) {
            const target = Math.floor(Math.random() * (index + 1));
            [copy[index], copy[target]] = [copy[target], copy[index]];
        }

        return copy;
    }

    function currentFilter() {
        return filter ? filter.value : "all";
    }

    function rebuildPool() {
        const identity = currentFilter();

        pool = sites.filter((site) => {
            return identity === "all" || site.identity === identity;
        });

        bag = shuffle(pool.map((site) => site.origin));
        history = [];
        historyIndex = -1;
        persist();
    }

    function findSite(origin) {
        return sites.find((site) => site.origin === origin);
    }

    function persist() {
        try {
            sessionStorage.setItem(
                storageKey,
                JSON.stringify({
                    filter: currentFilter(),
                    bag,
                    history,
                    historyIndex,
                }),
            );
        } catch {
            // Session history is optional.
        }
    }

    function restore() {
        try {
            const stored = JSON.parse(sessionStorage.getItem(storageKey));

            if (!stored || typeof stored !== "object") {
                return false;
            }

            if (
                filter &&
                ["all", "affirmed", "declined", "undeclared"].includes(
                    stored.filter,
                )
            ) {
                filter.value = stored.filter;
            }

            const allowedOrigins = new Set(
                sites
                    .filter((site) => {
                        return (
                            currentFilter() === "all" ||
                            site.identity === currentFilter()
                        );
                    })
                    .map((site) => site.origin),
            );

            bag = Array.isArray(stored.bag)
                ? stored.bag.filter((origin) => allowedOrigins.has(origin))
                : [];

            history = Array.isArray(stored.history)
                ? stored.history.filter((origin) => allowedOrigins.has(origin))
                : [];

            historyIndex = Number.isInteger(stored.historyIndex)
                ? Math.min(stored.historyIndex, history.length - 1)
                : -1;

            pool = sites.filter((site) => allowedOrigins.has(site.origin));

            return true;
        } catch {
            return false;
        }
    }

    function fallbackReason(site) {
        if (site.origin === window.location.origin) {
            return {
                message:
                    "Wander doesn’t embed Joshternet inside itself. Here’s its Network card instead.",
                kind: "self",
            };
        }

        if (site.frame_reason === "blocked-by-site") {
            return {
                message:
                    "This site doesn’t allow itself to be displayed inside another site, and we respect that. Here’s its Joshternet card instead.",
                kind: "blocked-by-site",
            };
        }

        if (site.frame_reason === "http") {
            return {
                message:
                    "This site can’t be displayed securely inside Wander because it is served over HTTP. Here’s its Joshternet card instead.",
                kind: "http",
            };
        }

        return {
            message:
                "We can’t safely display this site inside Wander right now. Here’s its Joshternet card instead.",
            kind: "unknown",
        };
    }

    function identityClass(site) {
        if (
            site.identity === "affirmed" ||
            site.identity === "declined" ||
            site.identity === "undeclared"
        ) {
            return site.identity;
        }

        return "undeclared";
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
                <span>${escapeHTML((site.domain || "?").slice(0, 1).toUpperCase())}</span>
              </div>`;

        const description = site.description
            ? `<p class="network-card__description">${escapeHTML(site.description)}</p>`
            : "";

        return `
            <div
                class="wander-fallback"
                data-frame-reason="${escapeAttribute(reason.kind)}"
            >
                <div class="wander-fallback__notice">
                    <p>${escapeHTML(reason.message)}</p>
                    <a
                        href="${escapeAttribute(site.origin)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Visit ${escapeHTML(site.domain)} ↗
                    </a>
                </div>

                <div class="wander-fallback__card">
                    <article
                        class="network-card network-card--${escapeAttribute(identity)}"
                    >
                        <a
                            class="network-card__link"
                            href="${escapeAttribute(site.origin)}"
                            target="_blank"
                            rel="noopener noreferrer"
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

                <button
                    class="wander-again"
                    type="button"
                    data-wander-again
                >
                    Keep wandering →
                </button>
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

    function render(site) {
        if (!site) {
            domain.textContent = "No sites available";
            openLink.hidden = true;
            networkLink.href = "/network/";
            stage.innerHTML = `
                <div class="wander-empty">
                    <p>There are no participating sites in this Wander view yet.</p>
                    <a href="/network/">Return to The Network</a>
                </div>
            `;
            previousButton.disabled = true;
            nextButton.disabled = true;
            return;
        }

        domain.textContent = site.domain;
        openLink.href = site.origin;
        openLink.hidden = false;
        networkLink.href = `/network/?site=${encodeURIComponent(site.domain)}`;
        nextButton.disabled = false;
        previousButton.disabled = historyIndex <= 0;

        if (
            site.embeddable &&
            site.origin.startsWith("https://") &&
            site.origin !== window.location.origin
        ) {
            stage.innerHTML = `
                <iframe
                    class="wander-frame"
                    src="${escapeAttribute(site.origin)}"
                    title="${escapeAttribute(site.title || site.domain)}"
                    sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                    referrerpolicy="no-referrer"
                ></iframe>
            `;
        } else {
            stage.innerHTML = fallbackMarkup(site);

            const again = stage.querySelector("[data-wander-again]");

            if (again) {
                again.addEventListener("click", next);
            }
        }

        persist();
    }

    function next() {
        if (historyIndex < history.length - 1) {
            historyIndex += 1;
            render(findSite(history[historyIndex]));
            return;
        }

        if (pool.length === 0) {
            render(null);
            return;
        }

        if (bag.length === 0) {
            const currentOrigin =
                historyIndex >= 0 ? history[historyIndex] : null;

            bag = shuffle(pool.map((site) => site.origin));

            if (bag.length > 1 && bag[0] === currentOrigin) {
                [bag[0], bag[1]] = [bag[1], bag[0]];
            }
        }

        const origin = bag.shift();

        history = history.slice(0, historyIndex + 1);
        history.push(origin);
        historyIndex = history.length - 1;

        render(findSite(origin));
    }

    function previous() {
        if (historyIndex <= 0) {
            return;
        }

        historyIndex -= 1;
        render(findSite(history[historyIndex]));
    }

    fetch("/network/data.json", {
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
        },
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Network data request failed: ${response.status}`);
            }

            return response.json();
        })
        .then((data) => {
            if (!Array.isArray(data)) {
                throw new Error("Network data is not an array");
            }

            sites = data;

            const restored = restore();

            if (!restored) {
                rebuildPool();
            }

            if (historyIndex >= 0 && history[historyIndex]) {
                render(findSite(history[historyIndex]));
            } else {
                next();
            }
        })
        .catch(() => {
            domain.textContent = "Network unavailable";
            previousButton.disabled = true;
            nextButton.disabled = true;
            openLink.hidden = true;
            stage.innerHTML = `
                <div class="wander-empty">
                    <p>The network data could not be loaded right now.</p>
                    <a href="/network/">Return to The Network</a>
                </div>
            `;
        });

    previousButton.addEventListener("click", previous);
    nextButton.addEventListener("click", next);

    if (filter) {
        filter.addEventListener("change", () => {
            rebuildPool();
            next();
        });
    }
})();

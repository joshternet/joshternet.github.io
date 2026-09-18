(() => {
    const consoleElement = document.querySelector("[data-wander-console]");

    if (!consoleElement) {
        return;
    }

    const stage = consoleElement.querySelector("[data-wander-stage]");
    const goButton = consoleElement.querySelector("[data-wander-go]");
    const addressInput = consoleElement.querySelector("[data-wander-address]");
    const openButton = consoleElement.querySelector("[data-wander-open]");

    if (!stage || !goButton || !addressInput || !openButton) {
        return;
    }

    const storageKey = "joshternet-wander-v2";

    let sites = [];
    let bag = [];
    let currentOrigin = null;

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

        if (
            currentOrigin &&
            bag.length > 1 &&
            bag[0] === currentOrigin
        ) {
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
            const stored = JSON.parse(
                sessionStorage.getItem(storageKey),
            );

            if (!stored || typeof stored !== "object") {
                return false;
            }

            const validOrigins = new Set(
                sites.map((site) => site.origin),
            );

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

    function fallbackReason(site) {
        if (site.origin === window.location.origin) {
            return {
                message:
                    "Joshternet isn’t embedded inside its own Wander view.",
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
            message:
                "This site can’t be displayed inside Wander right now.",
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
        try {
            const url = new URL(addressInput.value.trim());

            if (
                url.protocol !== "https:" &&
                url.protocol !== "http:"
            ) {
                return null;
            }

            return url;
        } catch {
            return null;
        }
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

        window.open(
            url.href,
            "_blank",
            "noopener,noreferrer",
        );
    }

    function render(site) {
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

            persist();
            return;
        }

        currentOrigin = site.origin;
        addressInput.value = site.origin;
        updateOpenState();

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

        if (
            sites.length > 1 &&
            origin === currentOrigin
        ) {
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
        headers: {
            Accept: "application/json",
        },
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(
                    `Network data request failed: ${response.status}`,
                );
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

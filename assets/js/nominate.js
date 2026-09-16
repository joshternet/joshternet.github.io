const form = document.querySelector("[data-seed-nomination-form]");

if (form) {
    const urlField = form.querySelector("#seed-url");
    const ownerField = form.querySelector("#seed-owner");
    const turnstileContainer = form.querySelector(
        "[data-seed-nomination-turnstile]",
    );
    const submitButton = form.querySelector(
        "[data-seed-nomination-submit]",
    );
    const statusElement = form.querySelector(
        "[data-seed-nomination-status]",
    );

    const apiUrl = form.dataset.seedNominationApi;
    const sitekey = form.dataset.turnstileSitekey;

    let widgetId = null;
    let turnstileToken = "";
    let submitting = false;

    function showStatus(message, kind = "") {
        statusElement.textContent = message;
        statusElement.hidden = false;

        statusElement.classList.toggle(
            "seed-nomination-status--success",
            kind === "success",
        );

        statusElement.classList.toggle(
            "seed-nomination-status--error",
            kind === "error",
        );
    }

    function clearStatus() {
        statusElement.textContent = "";
        statusElement.hidden = true;
        statusElement.classList.remove(
            "seed-nomination-status--success",
            "seed-nomination-status--error",
        );
    }

    function setVerificationToken(token) {
        turnstileToken = token || "";
        submitButton.disabled = submitting || !turnstileToken;
    }

    function resetTurnstile() {
        setVerificationToken("");

        if (
            widgetId !== null &&
            window.turnstile &&
            typeof window.turnstile.reset === "function"
        ) {
            window.turnstile.reset(widgetId);
        }
    }

    function initializeTurnstile() {
        if (!apiUrl || !sitekey) {
            showStatus(
                "Seed nominations are not available yet.",
                "error",
            );
            return;
        }

        if (
            !window.turnstile ||
            typeof window.turnstile.render !== "function"
        ) {
            showStatus(
                "Verification could not be loaded. Please reload the page and try again.",
                "error",
            );
            return;
        }

        widgetId = window.turnstile.render(turnstileContainer, {
            sitekey,
            action: "seed-nomination",
            theme: "auto",
            size: "flexible",

            callback(token) {
                clearStatus();
                setVerificationToken(token);
            },

            "error-callback"() {
                setVerificationToken("");
                showStatus(
                    "Verification failed. Please try again.",
                    "error",
                );
            },

            "expired-callback"() {
                setVerificationToken("");
                showStatus(
                    "Verification expired. Please complete it again.",
                    "error",
                );
            },

            "timeout-callback"() {
                setVerificationToken("");
                showStatus(
                    "Verification timed out. Please try again.",
                    "error",
                );
            },
        });
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (submitting) {
            return;
        }

        if (!form.reportValidity()) {
            return;
        }

        if (!turnstileToken) {
            showStatus(
                "Complete the verification before nominating a site.",
                "error",
            );
            return;
        }

        submitting = true;
        submitButton.disabled = true;
        showStatus("Submitting nomination…");

        try {
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "omit",
                cache: "no-store",
                body: JSON.stringify({
                    url: urlField.value,
                    owner_attestation: ownerField.checked,
                    turnstile_token: turnstileToken,
                }),
            });

            let result = null;

            try {
                result = await response.json();
            } catch {
                result = null;
            }

            if (
                response.ok &&
                result?.status === "accepted"
            ) {
                urlField.value = "";
                ownerField.checked = false;

                showStatus(
                    "Thanks. That site is now in JoshBot's seed nomination queue.",
                    "success",
                );
            } else if (
                response.ok &&
                result?.status === "already_nominated"
            ) {
                urlField.value = "";
                ownerField.checked = false;

                showStatus(
                    "That site has already been nominated for JoshBot.",
                    "success",
                );
            } else {
                showStatus(
                    result?.message ||
                        "The nomination could not be submitted. Please try again.",
                    "error",
                );
            }
        } catch {
            showStatus(
                "The nomination service could not be reached. Please try again.",
                "error",
            );
        } finally {
            submitting = false;
            resetTurnstile();
        }
    });

    window.addEventListener(
        "load",
        initializeTurnstile,
        { once: true },
    );
}

/**
 * Goal & Constraints:
 * Join page helpers: copy declarations to the clipboard and emit privacy-safe
 * Umami events (platform/identity enums only). Does not invent membership
 * success or send URLs, names, or free-text fields.
 */
(() => {
  const root = document.querySelector(".join-steps");

  if (!root) {
    return;
  }

  /**
   * @param {string} name
   * @param {Record<string, string | number | boolean>} [data]
   * @returns {void}
   */
  function track(name, data) {
    const send = globalThis.joshternetTrack;

    if (typeof send === "function") {
      send(name, data);
    }
  }

  track("join-start");

  const copyStatus = document.querySelector("[data-join-copy-status]");

  /**
   * @param {string} message
   * @returns {void}
   */
  function setCopyStatus(message) {
    if (copyStatus) {
      copyStatus.textContent = message;
    }
  }

  /**
   * @param {string} text
   * @returns {Promise<void>}
   */
  async function copyText(text) {
    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.insetInlineStart = "-9999px";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  for (const button of root.querySelectorAll("[data-join-copy]")) {
    button.addEventListener("click", async () => {
      const targetId = button.getAttribute("data-join-copy") || "";
      const identity = button.getAttribute("data-join-identity") || "";
      const block = document.getElementById(targetId);
      const code = block ? block.textContent || "" : "";

      if (!code.trim()) {
        setCopyStatus("Nothing to copy.");
        return;
      }

      try {
        await copyText(code.trim() + "\n");
        setCopyStatus("Declaration copied.");
        track("join-declaration-copy", { identity });
      } catch {
        setCopyStatus("Could not copy. Select the JSON and copy it manually.");
      }
    });
  }

  for (const link of root.querySelectorAll("[data-join-platform]")) {
    link.addEventListener("click", () => {
      const platform = link.getAttribute("data-join-platform") || "";

      if (platform) {
        track("join-platform", { platform });
      }
    });
  }

  const checkOpen = root.querySelector("[data-join-check-open]");

  if (checkOpen) {
    checkOpen.addEventListener("click", () => {
      track("join-check-open");
    });
  }

  const nominateOpen = root.querySelector("[data-join-nominate-open]");

  if (nominateOpen) {
    nominateOpen.addEventListener("click", () => {
      track("join-nominate-open");
    });
  }

  for (const link of root.querySelectorAll("[data-join-share]")) {
    link.addEventListener("click", () => {
      const target = link.getAttribute("data-join-share") || "";

      if (target) {
        track("join-share-open", { target });
      }
    });
  }
})();

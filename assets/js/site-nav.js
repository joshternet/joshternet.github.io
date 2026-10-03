/**
 * Goal: Reliable submenu open/close for About, Network, Implement, and JoshBot.
 * Inputs: .site-header, [data-nav-branch], [data-nav-secondary]
 * Output: toggles [hidden] / .is-open; sticky on matching section pages.
 * Fine-pointer hover opens the row. Touch/pen: first tap opens without
 * navigating; a later tap on the same top-level link follows it.
 */
(() => {
  const header = document.querySelector(".site-header");

  if (!header) {
    return;
  }

  const branchItems = Array.from(
    header.querySelectorAll(".site-nav--wide [data-nav-branch]"),
  );
  const secondaries = Array.from(
    header.querySelectorAll("[data-nav-secondary]"),
  );

  if (branchItems.length === 0 || secondaries.length === 0) {
    return;
  }

  let stickyBranch = null;

  if (header.classList.contains("site-header--section-about")) {
    stickyBranch = "about";
  } else if (header.classList.contains("site-header--section-network")) {
    stickyBranch = "network";
  } else if (header.classList.contains("site-header--section-implement")) {
    stickyBranch = "implement";
  } else if (header.classList.contains("site-header--section-joshbot")) {
    stickyBranch = "joshbot";
  }

  const leaveMs = 160;
  let activeBranch = null;
  let leaveTimer = 0;
  /** @type {string | null} */
  let openBeforeGesture = null;

  /**
   * iPad and other coarse pointers have no persistent hover.
   * @returns {boolean}
   */
  function useHoverSubmenus() {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }

  /**
   * @param {PointerEvent} event
   * @returns {boolean}
   */
  function isCoarsePointer(event) {
    return event.pointerType === "touch" || event.pointerType === "pen";
  }

  /**
   * @returns {string | null}
   */
  function openName() {
    return activeBranch || stickyBranch;
  }

  /**
   * @returns {void}
   */
  function sync() {
    const current = openName();

    for (const secondary of secondaries) {
      const name = secondary.getAttribute("data-nav-secondary");
      const open = current === name;
      secondary.hidden = !open;
      secondary.classList.toggle("is-open", open);
    }

    for (const item of branchItems) {
      const name = item.getAttribute("data-nav-branch");
      const link = item.querySelector(":scope > a");

      if (link) {
        link.setAttribute("aria-expanded", current === name ? "true" : "false");
      }
    }
  }

  /**
   * @returns {void}
   */
  function cancelLeave() {
    window.clearTimeout(leaveTimer);
    leaveTimer = 0;
  }

  /**
   * @returns {void}
   */
  function scheduleLeave() {
    cancelLeave();
    leaveTimer = window.setTimeout(() => {
      activeBranch = null;
      sync();
    }, leaveMs);
  }

  /**
   * @param {string} branch
   * @returns {void}
   */
  function openBranch(branch) {
    cancelLeave();
    activeBranch = branch;
    sync();
  }

  /**
   * @returns {void}
   */
  function clearBranch() {
    cancelLeave();
    activeBranch = null;
    sync();
  }

  /**
   * @param {FocusEvent} event
   * @returns {void}
   */
  function onFocusIn(event) {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const branchItem = target.closest("[data-nav-branch]");

    if (branchItem && header.contains(branchItem)) {
      openBranch(branchItem.getAttribute("data-nav-branch") || "");
      return;
    }

    if (target.closest("[data-nav-secondary]")) {
      cancelLeave();
    }
  }

  for (const item of branchItems) {
    const name = item.getAttribute("data-nav-branch");
    const link = item.querySelector(":scope > a");

    item.addEventListener("pointerenter", (event) => {
      if (!useHoverSubmenus() || isCoarsePointer(event)) {
        return;
      }

      openBranch(name || "");
    });

    if (link) {
      link.addEventListener("pointerdown", () => {
        openBeforeGesture = openName();
      });

      link.addEventListener("click", (event) => {
        const prior = openBeforeGesture;
        openBeforeGesture = null;

        if (prior === name) {
          return;
        }

        event.preventDefault();
        openBranch(name || "");
      });
    }
  }

  for (const item of header.querySelectorAll(
    ".site-nav--wide .site-nav__item:not([data-nav-branch])",
  )) {
    item.addEventListener("pointerenter", (event) => {
      if (!useHoverSubmenus() || isCoarsePointer(event)) {
        return;
      }

      clearBranch();
    });
  }

  header.addEventListener("pointerleave", (event) => {
    if (!useHoverSubmenus() || isCoarsePointer(event)) {
      return;
    }

    scheduleLeave();
  });

  header.addEventListener("pointerenter", (event) => {
    if (!useHoverSubmenus() || isCoarsePointer(event)) {
      return;
    }

    cancelLeave();
  });

  header.addEventListener("focusin", onFocusIn);

  header.addEventListener("focusout", (event) => {
    const next = event.relatedTarget;

    if (next instanceof Node && header.contains(next)) {
      return;
    }

    if (!useHoverSubmenus()) {
      return;
    }

    scheduleLeave();
  });

  document.addEventListener("pointerdown", (event) => {
    if (!isCoarsePointer(event) && useHoverSubmenus()) {
      return;
    }

    const target = event.target;

    if (!(target instanceof Node) || header.contains(target)) {
      return;
    }

    clearBranch();
  });

  sync();
})();

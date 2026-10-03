/**
 * Goal: Reliable Implement submenu open/close without layout shift.
 * Inputs: .site-header, .site-nav__item--implement, .site-nav-secondary--implement
 * Output: toggles [hidden] / .is-open; sticky on Implement section pages;
 * closes when another top-level item is entered (sticky still wins on section pages)
 * or when the pointer leaves the header (non-sticky).
 * The header is the hover zone so the gap under the circle-dot rule cannot drop the menu.
 */
(() => {
  const header = document.querySelector(".site-header");
  if (!header) {
    return;
  }

  const implementItem = header.querySelector(
    ".site-nav--wide .site-nav__item--implement",
  );
  const secondary = header.querySelector(".site-nav-secondary--implement");
  if (!implementItem || !secondary) {
    return;
  }

  const stickySection = header.classList.contains(
    "site-header--section-implement",
  );
  const leaveMs = 160;
  let activeBranch = null;
  let leaveTimer = 0;

  /**
   * @returns {void}
   */
  function sync() {
    const open =
      activeBranch === "implement" || (stickySection && !activeBranch);
    secondary.hidden = !open;
    secondary.classList.toggle("is-open", open);
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
   * @param {"implement"} branch
   * @returns {void}
   */
  function openBranch(branch) {
    cancelLeave();
    activeBranch = branch;
    sync();
  }

  /**
   * Dismiss the hover-opened branch. Sticky section pages stay open.
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
  function onFocusOut(event) {
    const next = event.relatedTarget;
    if (
      next instanceof Node &&
      (implementItem.contains(next) || secondary.contains(next))
    ) {
      return;
    }
    if (
      next instanceof Node &&
      header.contains(next) &&
      !implementItem.contains(next) &&
      !secondary.contains(next)
    ) {
      clearBranch();
      return;
    }
    scheduleLeave();
  }

  implementItem.addEventListener("pointerenter", () => {
    openBranch("implement");
  });
  implementItem.addEventListener("focusin", () => {
    openBranch("implement");
  });
  implementItem.addEventListener("focusout", onFocusOut);

  secondary.addEventListener("pointerenter", () => {
    openBranch("implement");
  });
  secondary.addEventListener("focusin", () => {
    openBranch("implement");
  });
  secondary.addEventListener("focusout", onFocusOut);

  const siblingItems = header.querySelectorAll(
    ".site-nav--wide .site-nav__list > .site-nav__item",
  );
  for (const item of siblingItems) {
    if (item === implementItem) {
      continue;
    }
    item.addEventListener("pointerenter", clearBranch);
    item.addEventListener("focusin", clearBranch);
  }

  header.addEventListener("pointerleave", scheduleLeave);
  header.addEventListener("pointerenter", cancelLeave);

  sync();
})();

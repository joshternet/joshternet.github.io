/**
 * Goal & Constraints:
 * Beside the copy, posters share one column so those titles line up. Cards
 * with no poster stay full width. On a phone the poster stacks above the
 * title, so that shared width is cleared. Inputs are laid-out images. Output
 * is `--activity-media-width` on the list. Search results use the same
 * `.activity-card__media` markup.
 */

(() => {
  const watched = new WeakSet();
  const stackedQuery = window.matchMedia("(max-width: 42rem)");

  /**
   * Shares one poster-column width across every card in a list.
   * @param {HTMLElement} list - Activity list that contains the cards.
   * @returns {void}
   */
  function alignList(list) {
    if (stackedQuery.matches) {
      list.style.removeProperty("--activity-media-width");
      return;
    }

    const medias = list.querySelectorAll(".activity-card__media");
    let max = 0;

    for (const media of medias) {
      const image = media.querySelector("img");

      if (!image) {
        continue;
      }

      const width = image.getBoundingClientRect().width;

      if (width > max) {
        max = width;
      }
    }

    if (max <= 0) {
      list.style.removeProperty("--activity-media-width");
      return;
    }

    const cap = list.clientWidth * 0.46;
    const used = Math.min(max, cap);
    const next = `${Math.round(used * 100) / 100}px`;

    if (list.style.getPropertyValue("--activity-media-width") === next) {
      return;
    }

    list.style.setProperty("--activity-media-width", next);
  }

  /**
   * Keeps one poster column fitted when the copy or viewport changes.
   * @param {Element} media - Candidate poster link.
   * @returns {void}
   */
  function watchMedia(media) {
    if (!(media instanceof HTMLElement) || watched.has(media)) {
      return;
    }

    const image = media.querySelector("img");

    if (!image) {
      return;
    }

    const list = media.closest(".activity-list");

    if (!(list instanceof HTMLElement)) {
      return;
    }

    watched.add(media);

    const apply = () => {
      alignList(list);
    };

    apply();

    if (!image.complete) {
      image.addEventListener("load", apply, { once: true });
    }

    const observer = new ResizeObserver(apply);

    observer.observe(image);
  }

  /**
   * Fits every poster column under a root.
   * @param {ParentNode} root - Document or a newly inserted subtree.
   * @returns {void}
   */
  function watchRoot(root) {
    for (const media of root.querySelectorAll(".activity-card__media")) {
      watchMedia(media);
    }
  }

  watchRoot(document);

  const added = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) {
          continue;
        }

        if (node.matches(".activity-card__media")) {
          watchMedia(node);
        }

        watchRoot(node);
      }
    }
  });

  added.observe(document.body, {
    childList: true,
    subtree: true,
  });

  stackedQuery.addEventListener("change", () => {
    for (const list of document.querySelectorAll(".activity-list")) {
      if (list instanceof HTMLElement) {
        alignList(list);
      }
    }
  });
})();

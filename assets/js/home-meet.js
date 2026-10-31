/**
 * Goal: Homepage Meet preview shuffles Jekyll-emitted participant cards and
 * shows three per visit. Eligibility (hub omit, Welcome omit) is build-time.
 */
(() => {
  const PREVIEW_COUNT = 3;
  const grid = document.querySelector("[data-home-meet-grid]");

  if (!grid) {
    return;
  }

  const cards = Array.from(grid.querySelectorAll("[data-home-meet-card]"));

  if (cards.length === 0) {
    return;
  }

  /**
   * Returns a Fisher-Yates shuffle of the given cards.
   * @param {Element[]} values - Participant card elements.
   * @returns {Element[]} Shuffled copy.
   */
  function shuffle(values) {
    const copy = values.slice();

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[target]] = [copy[target], copy[index]];
    }

    return copy;
  }

  const ordered = shuffle(cards);

  for (const card of cards) {
    card.hidden = true;
  }

  for (const [index, card] of ordered.entries()) {
    card.hidden = index >= PREVIEW_COUNT;
    grid.appendChild(card);
  }

  grid.dataset.homeMeetReady = "true";
})();

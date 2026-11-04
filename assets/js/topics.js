/**
 * Goal & Constraints:
 * Filter the static topic directory. HTML list remains complete without JS.
 */
(() => {
  const list = document.querySelector("[data-topics-index]");
  const input = document.querySelector("[data-topics-filter]");
  const status = document.querySelector("[data-topics-status]");

  if (!list || !input) {
    return;
  }

  const items = Array.from(list.querySelectorAll("[data-topic-item]"));

  /**
   * @returns {void}
   */
  function apply() {
    const query = input.value.trim().toLowerCase();
    let visible = 0;

    for (const item of items) {
      const label = item.getAttribute("data-label") || "";
      const match = !query || label.includes(query);
      item.hidden = !match;

      if (match) {
        visible += 1;
      }
    }

    if (status) {
      if (!query) {
        status.textContent = "";
      } else if (visible === 0) {
        status.textContent = "No matching topics.";
      } else if (visible === 1) {
        status.textContent = "1 matching topic.";
      } else {
        status.textContent = `${visible} matching topics.`;
      }
    }
  }

  input.addEventListener("input", apply);
})();

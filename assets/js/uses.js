/**
 * Goal & Constraints:
 * Progressive enhancement for /uses/. HTML summary works without JS.
 * Fetch public JSON when present; recover gracefully from missing assets.
 * Query params are allowlisted. No external chart libraries.
 */
(function () {
  "use strict";

  const ALLOWED_PERIODS = new Set(["month", "quarter", "year", "all-time"]);
  const NO_TREND =
    "History starts with the first recorded observations. There isn’t enough comparable history to show a trend yet, but you can explore the current snapshot and its sources.";

  /**
   * Publisher label for a tool row. Internal ids stay out of the table.
   * @param {{ name?: string, tool_id?: string }} tool
   * @returns {string}
   */
  function toolLabel(tool) {
    const name = String((tool && tool.k42) || "");
    if (name && name.indexOf("observed:") !== 0) {
      return name;
    }
    return String((tool && tool.k7g) || "").replace(/^observed:/, "");
  }

  /**
   * @param {string} value
   * @returns {string}
   */
  function escapeText(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * @returns {boolean}
   */
  function hasCurrentResults() {
    const table = document.querySelector("[data-uses-table]");
    if (!table) {
      return false;
    }
    return table.querySelectorAll("tbody tr").length > 0;
  }

  /**
   * @param {string} base
   * @returns {string}
   */
  function withCurrentAbove(base) {
    if (hasCurrentResults()) {
      return base + " Current results are shown above.";
    }
    return base;
  }

  /**
   * @returns {void}
   */
  function init() {
    const root = document.querySelector("[data-uses]");
    if (!root) {
      return;
    }
    const enhance = document.querySelector("[data-uses-enhance]");
    if (enhance) {
      enhance.hidden = false;
    }

    const status = document.querySelector("[data-uses-status]");
    const chart = document.querySelector("[data-uses-chart]");
    const buttons = document.querySelectorAll("[data-uses-period]");

    const params = new URLSearchParams(window.location.search);
    let period = params.get("period") || "month";
    if (!ALLOWED_PERIODS.has(period)) {
      period = "month";
    }

    /**
     * @param {string} next
     * @returns {void}
     */
    function setPeriod(next) {
      if (!ALLOWED_PERIODS.has(next)) {
        return;
      }
      period = next;
      const url = new URL(window.location.href);
      url.searchParams.set("period", period);
      window.history.replaceState({}, "", url);
      buttons.forEach(function (button) {
        const active = button.getAttribute("data-uses-period") === period;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      loadPeriod(period);
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        setPeriod(button.getAttribute("data-uses-period") || "month");
      });
    });

    /**
     * @param {string} granularity
     * @returns {Promise<void>}
     */
    async function loadPeriod(granularity) {
      if (status) {
        status.textContent = "Loading historical view…";
      }
      try {
        const indexRes = await fetch("/assets/data/uses/index.json", {
          credentials: "same-origin",
        });
        if (!indexRes.ok) {
          if (status) {
            status.textContent = withCurrentAbove(
              "Historical views are not available yet.",
            );
          }
          if (chart) {
            chart.innerHTML = "";
          }
          return;
        }
        const index = await indexRes.json();
        const snapshotNode = document.querySelector("[data-uses-snapshot]");
        const pageSnapshot = snapshotNode
          ? snapshotNode.getAttribute("data-uses-snapshot") || ""
          : "";
        if (
          pageSnapshot &&
          index.k6p &&
          pageSnapshot !== index.k6p
        ) {
          if (status) {
            status.textContent =
              "The interactive view is unavailable. The table above is the recorded snapshot.";
          }
          return;
        }
        const match = (index.k4y || []).find(function (entry) {
          return entry.k2s === granularity;
        });
        if (!match) {
          if (status) {
            status.textContent = withCurrentAbove(
              "Historical views are not available yet.",
            );
          }
          if (chart) {
            chart.innerHTML = "";
          }
          return;
        }
        let path;
        if (granularity === "all-time") {
          path = "/assets/data/uses/periods/all-time.json";
        } else {
          path =
            "/assets/data/uses/periods/" +
            granularity +
            "/" +
            encodeURIComponent(match.k30) +
            ".json";
        }
        const rollupRes = await fetch(path, { credentials: "same-origin" });
        if (!rollupRes.ok) {
          if (status) {
            status.textContent =
              "This historical view could not be loaded. Try again.";
          }
          if (chart) {
            chart.innerHTML = "";
          }
          return;
        }
        const rollup = await rollupRes.json();
        if (
          index.k7l === false ||
          rollup.k7l === false ||
          (index.k2c &&
            rollup.k2c &&
            index.k2c !== rollup.k2c)
        ) {
          if (chart) {
            chart.innerHTML = "";
          }
          if (status) {
            status.textContent = NO_TREND;
          }
          return;
        }
        const tools = rollup.k7h || [];
        if (!tools.length) {
          if (chart) {
            chart.innerHTML = "";
          }
          if (status) {
            status.textContent =
              "No observations are recorded for this period. Choose another period to explore the available history.";
          }
          return;
        }
        renderChart(chart, rollup);
        if (status) {
          const label = rollup.k37 ? "complete" : "in progress";
          status.textContent =
            "Showing " + (rollup.k4t || granularity) + " (" + label + ").";
        }
      } catch (error) {
        if (status) {
          status.textContent =
            "This historical view could not be loaded. Try again.";
        }
        if (chart) {
          chart.innerHTML = "";
        }
        void error;
      }
    }

    setPeriod(period);
  }

  /**
   * @param {Element|null} chart
   * @param {object} rollup
   * @returns {void}
   */
  function renderChart(chart, rollup) {
    if (!chart) {
      return;
    }
    const slots = rollup.k6n || [];
    if (slots.length) {
      const max = Math.max.apply(
        null,
        slots.map(function (slot) {
          return (slot.k56 || []).length;
        }),
      );
      chart.innerHTML = slots
        .map(function (slot) {
          const count = (slot.k56 || []).length;
          const width = max > 0 ? Math.round((100 * count) / max) : 0;
          return (
            '<div class="uses-bar">' +
            '<div class="uses-bar__label">' +
            escapeText(slot.k42 || slot.k30 || "") +
            "</div>" +
            '<div class="uses-bar__track" role="img" aria-label="' +
            escapeText(String(count)) +
            ' ranked product rows">' +
            '<span class="uses-bar__fill" style="width:' +
            width +
            '%"></span>' +
            "</div>" +
            '<div class="uses-bar__count">' +
            escapeText(String(count)) +
            " ranked product rows</div>" +
            "</div>"
          );
        })
        .join("");
      return;
    }
    const tools = rollup.k7h || [];
    const denom = rollup.k7v || 0;
    if (!tools.length) {
      chart.innerHTML = "";
      return;
    }
    const max = Math.max.apply(
      null,
      tools.map(function (tool) {
        return tool.k4 || 0;
      }),
    );
    const rows = tools
      .map(function (tool) {
        const count = tool.k4 || 0;
        const width = max > 0 ? Math.round((100 * count) / max) : 0;
        return (
          '<div class="uses-bar">' +
          '<div class="uses-bar__label">' +
          escapeText(toolLabel(tool)) +
          "</div>" +
          '<div class="uses-bar__track" role="img" aria-label="' +
          escapeText(String(count)) +
          " of " +
          escapeText(String(denom)) +
          '">' +
          '<span class="uses-bar__fill" style="width:' +
          width +
          '%"></span>' +
          "</div>" +
          '<div class="uses-bar__count">' +
          escapeText(String(count)) +
          "/" +
          escapeText(String(denom)) +
          "</div>" +
          "</div>"
        );
      })
      .join("");
    chart.innerHTML = rows;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

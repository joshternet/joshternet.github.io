/**
 * Goal & Constraints:
 * Progressive enhancement for /uses/. HTML summary works without JS.
 * Fetch public JSON when present; recover gracefully from missing assets.
 * Query params are allowlisted. No external chart libraries.
 * Slot cards use one row per choice. No hover banners or dimming—links stay calm.
 */
(function () {
  "use strict";

  const ALLOWED_PERIODS = new Set(["month", "quarter", "year", "all-time"]);
  const NO_TREND =
    "History starts with the first recorded observations. There isn’t enough comparable history to show a trend yet, but you can explore the current anonymous snapshot.";

  /**
   * Publisher label for a tool row. Internal ids stay out of the UI.
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
   * @param {unknown} value
   * @returns {number|null}
   */
  function normalizeShare(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return null;
    }
    return n;
  }

  /**
   * Mirrors scripts/uses/slot-chart-shape.mjs for optional card accents.
   * @param {{ share: number|null }[]} products
   * @returns {'solo'|'head_to_head'|'even_pack'|'leader_field'|'long_tail'|'overlapping'}
   */
  function classifySlotChartShape(products) {
    const list = Array.isArray(products) ? products : [];
    const shares = list
      .map(function (p) {
        return normalizeShare(p && p.share);
      })
      .filter(function (s) {
        return s !== null;
      })
      .sort(function (a, b) {
        return b - a;
      });

    if (list.length === 0 || shares.length === 0) {
      return "solo";
    }

    if (list.length === 1 || (shares.length === 1 && shares[0] >= 100)) {
      return "solo";
    }

    const sum = shares.reduce(function (acc, s) {
      return acc + s;
    }, 0);
    const max = shares[0];
    const second = shares[1] || 0;
    const hasClearLeader = max >= second * 2 || (max >= 80 && second < 50);

    if (sum > 105) {
      if (list.length >= 5) {
        return "long_tail";
      }
      if (list.length >= 3 && hasClearLeader) {
        return "leader_field";
      }
      return "overlapping";
    }

    if (list.length >= 5) {
      return "long_tail";
    }

    if (list.length === 2) {
      return "head_to_head";
    }

    const min = shares[shares.length - 1];
    const spread = max - min;

    if (list.length >= 3 && list.length <= 4 && spread <= 15) {
      return "even_pack";
    }

    if (hasClearLeader) {
      return "leader_field";
    }

    if (list.length === 3 || list.length === 4) {
      return "even_pack";
    }

    return "overlapping";
  }

  /**
   * @returns {boolean}
   */
  function hasCurrentResults() {
    const slots = document.querySelector("[data-uses-slots]");
    if (!slots) {
      return false;
    }
    return slots.querySelectorAll("[data-uses-product]").length > 0;
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
   * @param {Element} card
   * @returns {{ id: string, name: string, count: number, share: number|null, denominator: number }[]}
   */
  function readCardProducts(card) {
    const denominator = Number(card.getAttribute("data-uses-denominator") || 0);
    return Array.prototype.map.call(
      card.querySelectorAll("[data-uses-product]"),
      function (node) {
        return {
          id: node.getAttribute("data-uses-product") || "",
          name: node.getAttribute("data-uses-name") || "",
          count: Number(node.getAttribute("data-uses-count") || 0),
          share: normalizeShare(node.getAttribute("data-uses-share")),
          denominator: denominator,
        };
      },
    );
  }

  /**
   * Tag cards with chart shape for progressive enhancement. No hover chrome.
   * @returns {void}
   */
  function enhanceSlotCharts() {
    document
      .querySelectorAll(".uses-card[data-uses-slot]")
      .forEach(function (card) {
        const products = readCardProducts(card);
        if (!products.length) {
          return;
        }
        card.setAttribute(
          "data-uses-chart-shape",
          classifySlotChartShape(products),
        );
      });
  }

  /**
   * @returns {void}
   */
  function init() {
    const root = document.querySelector("[data-uses]");
    if (!root) {
      return;
    }
    enhanceSlotCharts();

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
        if (pageSnapshot && index.k6p && pageSnapshot !== index.k6p) {
          if (status) {
            status.textContent =
              "The interactive view is unavailable. The cards above are the recorded snapshot.";
          }
          return;
        }
        const matches = (index.k4y || []).filter(function (entry) {
          return entry.k2s === granularity;
        });
        let match = null;
        for (let i = matches.length - 1; i >= 0; i -= 1) {
          if (matches[i].kz === true) {
            match = matches[i];
            break;
          }
        }
        if (!match) {
          match = matches[0];
        }
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
          (index.k2c && rollup.k2c && index.k2c !== rollup.k2c)
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
            '<svg class="uses-bar__track" viewBox="0 0 100 1" preserveAspectRatio="none" role="img" aria-label="' +
            escapeText(String(count)) +
            ' ranked product rows">' +
            '<rect class="uses-bar__fill" x="0" y="0" width="' +
            width +
            '" height="1"></rect>' +
            "</svg>" +
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
          '<svg class="uses-bar__track" viewBox="0 0 100 1" preserveAspectRatio="none" role="img" aria-label="' +
          escapeText(String(count)) +
          " of " +
          escapeText(String(denom)) +
          '">' +
          '<rect class="uses-bar__fill" x="0" y="0" width="' +
          width +
          '" height="1"></rect>' +
          "</svg>" +
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

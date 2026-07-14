/* ==========================================================================
   MindBloom — charts.js
   The only file that talks to the Chart.js library directly. Every chart
   on the Analytics page is created through one of the factory functions
   below, which pull colors from MindBloom's design tokens (CSS custom
   properties) so charts always match the app's theme, including dark mode.
   analytics.js never constructs a `new Chart(...)` itself — it only calls
   into ChartsFactory, keeping Chart.js fully encapsulated in this module.
   ========================================================================== */

(function (window) {
  "use strict";

  if (typeof Chart === "undefined") {
    console.error("charts.js: Chart.js was not found. Make sure the Chart.js <script> tag loads before charts.js.");
  }

  const instances = {};

  function readCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function theme() {
    return {
      primary: readCssVar("--color-bloom-500") || "#3FA66B",
      secondary: readCssVar("--color-lavender-500") || "#8A7FE0",
      accent: readCssVar("--color-coral-500") || "#FF7A59",
      gold: readCssVar("--color-gold-500") || "#FFC94D",
      textPrimary: readCssVar("--color-text-primary") || "#14161A",
      textSecondary: readCssVar("--color-text-secondary") || "#6B7078",
      gridLine: readCssVar("--color-border-subtle") || "#E9E6DE",
      surface: readCssVar("--color-bg-surface") || "#FFFFFF",
      fontFamily: readCssVar("--font-body") || "Inter, sans-serif",
    };
  }

  function applyGlobalDefaults() {
    if (typeof Chart === "undefined") return;
    const t = theme();
    Chart.defaults.font.family = t.fontFamily;
    Chart.defaults.color = t.textSecondary;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.tooltip.backgroundColor = t.textPrimary;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.titleFont = { weight: "600" };
  }

  /** Destroys any existing chart bound to a canvas id before re-creating it. */
  function destroyChart(canvasId) {
    if (instances[canvasId]) {
      instances[canvasId].destroy();
      delete instances[canvasId];
    }
  }

  function register(canvasId, chart) {
    instances[canvasId] = chart;
    return chart;
  }

  const ChartsFactory = {
    applyGlobalDefaults: applyGlobalDefaults,
    theme: theme,
    destroyChart: destroyChart,

    /** @returns {boolean} whether Chart.js loaded successfully (e.g. false if offline and the CDN was blocked) */
    isAvailable() {
      return typeof Chart !== "undefined";
    },

    /**
     * @param {string} canvasId
     * @param {{labels:string[], data:number[], label:string, color?:string, suggestedMin?:number, suggestedMax?:number}} config
     */
    createLineChart(canvasId, config) {
      if (typeof Chart === "undefined") return null;
      destroyChart(canvasId);
      const ctx = document.getElementById(canvasId);
      if (!ctx) return null;
      const t = theme();
      const color = config.color || t.primary;

      const chart = new Chart(ctx, {
        type: "line",
        data: {
          labels: config.labels,
          datasets: [
            {
              label: config.label,
              data: config.data,
              borderColor: color,
              backgroundColor: color + "26",
              fill: true,
              tension: 0.35,
              pointRadius: 3,
              pointBackgroundColor: t.surface,
              pointBorderColor: color,
              pointBorderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: {
              suggestedMin: config.suggestedMin,
              suggestedMax: config.suggestedMax,
              grid: { color: t.gridLine },
            },
          },
        },
      });

      return register(canvasId, chart);
    },

    /**
     * @param {string} canvasId
     * @param {{labels:string[], datasets:Array<{label:string, data:number[], color:string}>, horizontal?:boolean}} config
     */
    createBarChart(canvasId, config) {
      if (typeof Chart === "undefined") return null;
      destroyChart(canvasId);
      const ctx = document.getElementById(canvasId);
      if (!ctx) return null;
      const t = theme();

      const chart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: config.labels,
          datasets: config.datasets.map(function (ds) {
            return {
              label: ds.label,
              data: ds.data,
              backgroundColor: ds.color,
              borderRadius: 6,
              maxBarThickness: 28,
            };
          }),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: config.horizontal ? "y" : "x",
          plugins: {
            legend: { display: config.datasets.length > 1, position: "bottom" },
          },
          scales: {
            x: { grid: { display: config.horizontal ? true : false, color: t.gridLine } },
            y: { grid: { display: config.horizontal ? false : true, color: t.gridLine } },
          },
        },
      });

      return register(canvasId, chart);
    },

    /**
     * @param {string} canvasId
     * @param {{labels:string[], data:number[], color?:string, label?:string}} config
     */
    createRadarChart(canvasId, config) {
      if (typeof Chart === "undefined") return null;
      destroyChart(canvasId);
      const ctx = document.getElementById(canvasId);
      if (!ctx) return null;
      const t = theme();
      const color = config.color || t.secondary;

      const chart = new Chart(ctx, {
        type: "radar",
        data: {
          labels: config.labels,
          datasets: [
            {
              label: config.label || "Score",
              data: config.data,
              borderColor: color,
              backgroundColor: color + "33",
              pointBackgroundColor: color,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              min: 0,
              max: 100,
              grid: { color: t.gridLine },
              angleLines: { color: t.gridLine },
              pointLabels: { font: { size: 11 } },
              ticks: { display: false, stepSize: 25 },
            },
          },
        },
      });

      return register(canvasId, chart);
    },

    /**
     * @param {string} canvasId
     * @param {{labels:string[], data:number[], colors:string[]}} config
     */
    createDoughnutChart(canvasId, config) {
      if (typeof Chart === "undefined") return null;
      destroyChart(canvasId);
      const ctx = document.getElementById(canvasId);
      if (!ctx) return null;

      const chart = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: config.labels,
          datasets: [
            {
              data: config.data,
              backgroundColor: config.colors,
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "72%",
          plugins: {
            legend: { display: true, position: "bottom" },
          },
        },
      });

      return register(canvasId, chart);
    },

    /**
     * A semi-circular "gauge" built on Chart.js's doughnut type using
     * rotation/circumference — no extra plugin required.
     * @param {string} canvasId
     * @param {{value:number, max:number, color:string}} config
     */
    createGaugeChart(canvasId, config) {
      if (typeof Chart === "undefined") return null;
      destroyChart(canvasId);
      const ctx = document.getElementById(canvasId);
      if (!ctx) return null;
      const t = theme();
      const remainder = Math.max(0, config.max - config.value);

      const chart = new Chart(ctx, {
        type: "doughnut",
        data: {
          datasets: [
            {
              data: [config.value, remainder],
              backgroundColor: [config.color, t.gridLine],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          circumference: 180,
          rotation: 270,
          cutout: "75%",
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
        },
      });

      return register(canvasId, chart);
    },
  };

  window.ChartsFactory = ChartsFactory;
})(window);

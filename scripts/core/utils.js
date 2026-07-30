/* ==========================================================================
   MindBloom — core/utils.js
   Shared, dependency-free helpers used across every page. Consolidates
   what used to be copy-pasted in dashboard.js, journal.js, planner.js,
   analytics.js, calendar.js, task-manager.js, habit-analysis.js, and
   conversation-ui.js. Load this before any page controller.
   ========================================================================== */

(function (window, document) {
  "use strict";

  /** Create a DOM element with an optional class and innerHTML in one call. */
  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  /** Normalize any Date/string into a plain "YYYY-MM-DD" key. */
  function toDateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  /** Show a toast in the page's #toast-root (every page includes this element). */
  function showToast(message, type) {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const toast = el("div", "toast anim-toast-in" + (type ? " toast--" + type : ""), message);
    root.appendChild(toast);
    setTimeout(function () {
      toast.remove();
    }, 2200);
  }

  /**
   * Wires the shared sidebar + bottom-nav shell that appears on every
   * authenticated page: marks the active nav item and hooks up logout.
   * @param {string} activeKey - matches a data-nav attribute in the shell markup
   */
  function initShell(activeKey) {
    document.querySelectorAll("[data-nav]").forEach(function (link) {
      if (link.dataset.nav === activeKey) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    const logoutBtn = document.getElementById("sidebar-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        if (window.AuthService && typeof window.AuthService.logout === "function") {
          window.AuthService.logout();
        }
        window.location.href = "login.html";
      });
    }

    // Redirect to login if there's no session — every shell page requires auth.
    if (window.AuthService && typeof window.AuthService.isAuthenticated === "function") {
      if (!window.AuthService.isAuthenticated()) {
        window.location.href = "login.html";
      }
    }
  }

  /** Applies the saved theme (light/dark) as early as possible to avoid a flash. */
  function applySavedTheme() {
    const saved = localStorage.getItem("mindbloom_theme");
    if (saved === "dark" || saved === "light") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("mindbloom_theme", theme);
  }

  function getTheme() {
    return (
      document.documentElement.getAttribute("data-theme") ||
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    );
  }

  /**
   * Renders an <svg> referencing a symbol from the icon sprite that's
   * inlined at the top of every page's <body> (see pages/*.html). We
   * reference it as a same-document fragment ("#icon-x") rather than an
   * external file ("assets/icons/icons.svg#icon-x") because <use> against
   * an external SVG document does not resolve when a page is opened
   * directly via file:// (no server) — inlining is the fix that works
   * everywhere.
   * @param {string} name - icon name without the "icon-" prefix, e.g. "home"
   * @param {string} extraClass - additional classes appended to "icon"
   */
  function icon(name, extraClass) {
    const cls = "icon" + (extraClass ? " " + extraClass : "");
    return (
      '<svg class="' + cls + '" aria-hidden="true">' +
      '<use href="#icon-' + name + '"></use>' +
      "</svg>"
    );
  }

  /**
   * Renders the shared 5-option mood picker (rough/low/okay/good/great)
   * into `container`, wiring click-to-select. Used by both physical.html's
   * Mood tab and journal.html's composer so the two never drift apart.
   * @param {HTMLElement} container
   * @param {string|null} selectedMood - a MindBloomData mood key, or null
   * @param {(mood:string)=>void} onSelect
   */
  function renderMoodPicker(container, selectedMood, onSelect) {
    if (!container || !window.MindBloomData) return;
    container.innerHTML = "";
    window.MindBloomData.MOOD_META.forEach(function (m) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mood-option";
      btn.dataset.mood = m.key;
      btn.setAttribute("aria-pressed", String(m.key === selectedMood));
      btn.setAttribute("aria-label", m.label);
      btn.innerHTML = icon("mood-" + m.key, "icon--lg");
      btn.addEventListener("click", function () {
        container.querySelectorAll(".mood-option").forEach(function (opt) {
          opt.setAttribute("aria-pressed", "false");
        });
        btn.setAttribute("aria-pressed", "true");
        if (typeof onSelect === "function") onSelect(m.key);
      });
      container.appendChild(btn);
    });
  }

  window.MindBloomUtils = {
    el: el,
    toDateKey: toDateKey,
    showToast: showToast,
    initShell: initShell,
    applySavedTheme: applySavedTheme,
    setTheme: setTheme,
    getTheme: getTheme,
    icon: icon,
    renderMoodPicker: renderMoodPicker,
  };

  // Apply theme immediately on script load, before first paint of content.
  applySavedTheme();

  // Actively remove any service worker + cache left over from earlier
  // testing (a service worker registered mid-development will otherwise
  // keep serving stale, cached versions of the app and can surface as
  // "no internet connection" errors once file paths change). Service
  // worker registration is intentionally NOT re-added here — that's a
  // deliberate, opt-in step for when the app is actually ready to ship
  // as a PWA, not something that should run silently during development.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      registrations.forEach(function (registration) {
        registration.unregister();
      });
    });
  }
  if (window.caches && typeof caches.keys === "function") {
    caches.keys().then(function (keys) {
      keys.forEach(function (key) {
        caches.delete(key);
      });
    });
  }
})(window, document);

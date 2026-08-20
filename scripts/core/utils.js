/* ==========================================================================
   MindBloom — core/utils.js
   Shared, dependency-free helpers used by nearly every page controller:
   element creation, the icon-sprite helper, toasts, theme persistence,
   the shared mood picker, shell/nav wiring (active state + logout + the
   signed-out redirect guard), and a Date -> "YYYY-MM-DD" key formatter.
   Load this before any other MindBloom script.
   ========================================================================== */

(function (window, document) {
  "use strict";

  const THEME_KEY = "mindbloom_theme";

  /* ======================================================================
     DOM
     ====================================================================== */
  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined && html !== null) node.innerHTML = html;
    return node;
  }

  /* Every page inlines the same "AURORA SIGNAL" <symbol> sprite at the top
     of <body>, so referencing #icon-<name> via <use> always resolves. */
  function icon(name, extraClass) {
    return (
      '<svg class="icon' +
      (extraClass ? " " + extraClass : "") +
      '" aria-hidden="true"><use href="#icon-' +
      name +
      '"></use></svg>'
    );
  }

  /* ======================================================================
     TOASTS — mounts into the page's #toast-root (see global.css .toast-root
     and components.css .toast / .toast--success / .toast--error).
     ====================================================================== */
  function showToast(message, type) {
    const root = document.getElementById("toast-root");
    if (!root) return;

    const toast = el("div", "toast" + (type ? " toast--" + type : ""), null);
    toast.setAttribute("role", "status");
    toast.textContent = message;
    root.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add("anim-fade-in");
    });

    setTimeout(function () {
      toast.style.transition = "opacity 200ms ease, transform 200ms ease";
      toast.style.opacity = "0";
      toast.style.transform = "translate(-50%, -6px)";
      setTimeout(function () {
        toast.remove();
      }, 220);
    }, 2600);
  }

  /* ======================================================================
     THEME — data-theme="dark"|"light" on <html>, persisted in localStorage.
     Applied as early as possible (script runs before body paints on pages
     that load utils.js in <head>, or immediately on DOMContentLoaded when
     loaded at the end of <body> — either way this runs before other
     controllers touch the DOM).
     ====================================================================== */
  function getTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
  }

  (function applyStoredThemeEarly() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  })();

  /* ======================================================================
     SHELL — marks the active sidebar/bottom-nav item (elements carrying
     [data-nav]), wires #sidebar-logout, and guards signed-in-only pages:
     if AuthService is loaded and there's no session, bounce to login.html
     before the page's own init has a chance to render anything sensitive.
     ====================================================================== */
  function initShell(navKey) {
    if (window.AuthService && typeof window.AuthService.isAuthenticated === "function") {
      if (!window.AuthService.isAuthenticated()) {
        window.location.href = "login.html";
        return false;
      }
    }

    document.querySelectorAll("[data-nav]").forEach(function (link) {
      if (link.dataset.nav === navKey) {
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

    return true;
  }

  /* ======================================================================
     MOOD PICKER — shared by physical.html (check-in) and journal.html
     (composer + filter row), rendered from MindBloomData.MOOD_META so the
     five moods only need to be defined once (see core/data-store.js).
     ====================================================================== */
  function renderMoodPicker(container, selectedMood, onSelect) {
    if (!container) return;
    container.innerHTML = "";
    container.classList.add("mood-picker");

    const moods = (window.MindBloomData && window.MindBloomData.MOOD_META) || [];
    moods.forEach(function (mood) {
      const btn = el("button", "mood-option", icon("mood-" + mood.key));
      btn.type = "button";
      btn.dataset.mood = mood.key;
      btn.setAttribute("aria-pressed", String(mood.key === selectedMood));
      btn.setAttribute("aria-label", mood.label);
      btn.addEventListener("click", function () {
        container.querySelectorAll(".mood-option").forEach(function (b) {
          b.setAttribute("aria-pressed", "false");
        });
        btn.setAttribute("aria-pressed", "true");
        onSelect(mood.key);
      });
      container.appendChild(btn);
    });
  }

  /* ======================================================================
     DATES
     ====================================================================== */
  function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  window.MindBloomUtils = {
    el: el,
    icon: icon,
    showToast: showToast,
    getTheme: getTheme,
    setTheme: setTheme,
    initShell: initShell,
    renderMoodPicker: renderMoodPicker,
    toDateKey: toDateKey,
  };
})(window, document);

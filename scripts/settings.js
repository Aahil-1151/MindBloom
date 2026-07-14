/* ==========================================================================
   MindBloom — settings.js
   Controller for settings.html: shows the signed-in user's profile,
   handles the dark-mode and notification toggles, clears local data on
   request, and logs out.
   ========================================================================== */

(function (window, document) {
  "use strict";

  const showToast = MindBloomUtils.showToast;
  const NOTIF_KEY = "mindbloom_notifications_enabled";

  // Every localStorage key MindBloom writes to, in one place, so "Clear
  // all local data" genuinely clears everything rather than silently
  // missing a module added later.
  const ALL_DATA_KEYS = [
    "mindbloom_journal",
    "mindbloom_academic_tasks",
    "mindbloom_chat_history",
    "mindbloom_physical_logs",
    "mindbloom_mental_checkins",
    "mindbloom_moods",
    "mindbloom_reset_requests",
    NOTIF_KEY,
  ];

  let els = {};

  function cacheElements() {
    els = {
      avatar: document.getElementById("profile-avatar"),
      name: document.getElementById("profile-name"),
      email: document.getElementById("profile-email"),
      themeToggle: document.getElementById("theme-toggle"),
      notifToggle: document.getElementById("notif-toggle"),
      clearDataBtn: document.getElementById("clear-data-btn"),
      logoutBtn: document.getElementById("logout-btn"),
    };
    MindBloomUtils.initShell("settings");
  }

  function renderProfile() {
    const session = window.AuthService && window.AuthService.getSession();
    if (!session) return;
    els.avatar.textContent = session.name.charAt(0).toUpperCase();
    els.name.textContent = session.name;
    els.email.textContent = session.email;
  }

  function renderThemeToggle() {
    const isDark = MindBloomUtils.getTheme() === "dark";
    els.themeToggle.setAttribute("aria-checked", String(isDark));
  }

  function wireThemeToggle() {
    els.themeToggle.addEventListener("click", function () {
      const next = MindBloomUtils.getTheme() === "dark" ? "light" : "dark";
      MindBloomUtils.setTheme(next);
      renderThemeToggle();
    });
  }

  function renderNotifToggle() {
    const stored = localStorage.getItem(NOTIF_KEY);
    const enabled = stored === null ? true : stored === "true";
    els.notifToggle.setAttribute("aria-checked", String(enabled));
  }

  function wireNotifToggle() {
    els.notifToggle.addEventListener("click", function () {
      const current = els.notifToggle.getAttribute("aria-checked") === "true";
      const next = !current;
      localStorage.setItem(NOTIF_KEY, String(next));
      els.notifToggle.setAttribute("aria-checked", String(next));
      showToast(next ? "Daily reminders on" : "Daily reminders off");
    });
  }

  function wireClearData() {
    els.clearDataBtn.addEventListener("click", function () {
      const confirmed = window.confirm(
        "This clears your journal, tasks, chat history, and wellbeing logs from this device. Your account stays signed in. This can't be undone — continue?"
      );
      if (!confirmed) return;

      ALL_DATA_KEYS.forEach(function (key) {
        localStorage.removeItem(key);
      });
      showToast("All local data cleared");
    });
  }

  function wireLogout() {
    els.logoutBtn.addEventListener("click", function () {
      if (window.AuthService && typeof window.AuthService.logout === "function") {
        window.AuthService.logout();
      }
      window.location.href = "login.html";
    });
  }

  function init() {
    cacheElements();
    renderProfile();
    renderThemeToggle();
    renderNotifToggle();
    wireThemeToggle();
    wireNotifToggle();
    wireClearData();
    wireLogout();
  }

  document.addEventListener("DOMContentLoaded", init);
})(window, document);

/* ==========================================================================
   MindBloom — onboarding.js
   Controller for onboarding.html: a short 3-step welcome flow shown once
   right after signup. Saves selected goals to localStorage and redirects
   into the real app.
   ========================================================================== */

(function (window, document) {
  "use strict";

  const GOALS_KEY = "mindbloom_user_goals";
  let currentStep = 1;
  const selectedGoals = new Set();

  function showStep(step) {
    currentStep = step;
    document.querySelectorAll(".onboarding-step").forEach(function (el, index) {
      el.hidden = index + 1 !== step;
    });
    document.querySelectorAll(".onboarding-dot").forEach(function (dot) {
      dot.classList.toggle("onboarding-dot--active", Number(dot.dataset.step) === step);
    });
  }

  function wireNavButtons() {
    document.querySelectorAll("[data-next]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showStep(Math.min(3, currentStep + 1));
      });
    });
    document.querySelectorAll("[data-back]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showStep(Math.max(1, currentStep - 1));
      });
    });
  }

  function wireGoalChips() {
    document.querySelectorAll(".onboarding-goal").forEach(function (chip) {
      chip.addEventListener("click", function () {
        const goal = chip.dataset.goal;
        if (selectedGoals.has(goal)) {
          selectedGoals.delete(goal);
          chip.setAttribute("aria-pressed", "false");
        } else {
          selectedGoals.add(goal);
          chip.setAttribute("aria-pressed", "true");
        }
      });
    });
  }

  function wireFinish() {
    document.getElementById("finish-onboarding").addEventListener("click", function () {
      localStorage.setItem(GOALS_KEY, JSON.stringify(Array.from(selectedGoals)));
      window.location.href = "dashboard.html";
    });
  }

  function greetByName() {
    const session = window.AuthService && window.AuthService.getSession();
    const nameEl = document.getElementById("welcome-name");
    if (session && session.name && nameEl) {
      nameEl.textContent = ", " + session.name.split(" ")[0];
    }
  }

  function init() {
    greetByName();
    wireNavButtons();
    wireGoalChips();
    wireFinish();
    showStep(1);
  }

  document.addEventListener("DOMContentLoaded", init);
})(window, document);

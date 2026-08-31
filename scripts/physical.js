/* ==========================================================================
   MindBloom — physical.js
   Wellbeing hub controller (physical.html): the Physical tab logs today's
   sleep/water/activity, the Mental tab runs a guided breathing exercise
   and a stress check-in slider, and the Mood tab logs how you're feeling
   right now plus your mood history. Every "Save" / "Log" action writes
   through MindBloomData (core/data-store.js) — the same shared, per-user
   record the dashboard reads — so it shows up there immediately too.
   ========================================================================== */

(function (window, document) {
  "use strict";

  function qs(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  const el = MindBloomUtils.el;
  let record = null;

  /* ======================================================================
     TAB SWITCHING
     ====================================================================== */
  function activateTab(tabKey) {
    document.querySelectorAll(".segmented-control__tab").forEach(function (tab) {
      tab.setAttribute("aria-selected", String(tab.dataset.tab === tabKey));
    });
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
      panel.hidden = panel.id !== "tab-" + tabKey;
    });
  }

  function wireTabs() {
    document.querySelectorAll(".segmented-control__tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        activateTab(tab.dataset.tab);
      });
    });

    // Deep-link support for the dashboard's Quick Actions ("Log Mood" ->
    // #mood, "Breathe" -> #mental).
    const hash = (window.location.hash || "").replace("#", "");
    if (hash === "mood" || hash === "mental") {
      activateTab(hash);
    }
  }

  /* ======================================================================
     PHYSICAL TAB — sleep / water / activity steppers
     ====================================================================== */
  const STEPPER_LIMITS = {
    sleep: { min: 0, max: 14 },
    water: { min: 0, max: 20 },
    activity: { min: 0, max: 300 },
  };

  const STEPPER_SUFFIX = { sleep: "h", water: "cups", activity: "min" };

  let physicalState = { sleep: 8, water: 0, activity: 0 };

  function formatStepperValue(key, value) {
    const display = key === "sleep" ? (Math.round(value * 10) / 10).toString() : String(Math.round(value));
    return display + "<small>" + STEPPER_SUFFIX[key] + "</small>";
  }

  function renderSteppers() {
    const sleepEl = qs("#sleep-value");
    const waterEl = qs("#water-value");
    const activityEl = qs("#activity-value");
    if (sleepEl) sleepEl.innerHTML = formatStepperValue("sleep", physicalState.sleep);
    if (waterEl) waterEl.innerHTML = formatStepperValue("water", physicalState.water);
    if (activityEl) activityEl.innerHTML = formatStepperValue("activity", physicalState.activity);
  }

  function wireSteppers() {
    document.querySelectorAll("[data-stepper]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const key = btn.dataset.stepper;
        const delta = parseFloat(btn.dataset.delta);
        const limits = STEPPER_LIMITS[key];
        physicalState[key] = Math.min(limits.max, Math.max(limits.min, physicalState[key] + delta));
        renderSteppers();
      });
    });

    const saveBtn = qs("#save-physical");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        record = MindBloomData.logPhysical({
          sleepHours: physicalState.sleep,
          waterCups: physicalState.water,
          activityMinutes: physicalState.activity,
        });
        MindBloomUtils.showToast("Today's check-in saved!", "success");
      });
    }
  }

  function prefillPhysicalFromToday() {
    const todays = record.physicalLogs.find(function (p) {
      return MindBloomData.isToday(p.timestamp);
    });
    if (todays) {
      physicalState = {
        sleep: typeof todays.sleepHours === "number" ? todays.sleepHours : 8,
        water: todays.waterCups || 0,
        activity: todays.activityMinutes || 0,
      };
    }
    renderSteppers();
  }

  /* ======================================================================
     MENTAL TAB — breathing exercise + stress check-in
     ====================================================================== */
  const BREATH_PHASES = [
    { label: "Breathe in…", duration: 4000, scale: 1.35 },
    { label: "Hold…", duration: 4000, scale: 1.35 },
    { label: "Breathe out…", duration: 4000, scale: 1 },
  ];

  let breathingActive = false;
  let breathingTimer = null;

  function stepBreathing(phaseIndex) {
    if (!breathingActive) return;
    const phase = BREATH_PHASES[phaseIndex % BREATH_PHASES.length];
    const labelEl = qs("#breathing-label");
    const circleEl = qs("#breathing-circle");
    if (labelEl) labelEl.textContent = phase.label;
    if (circleEl) {
      circleEl.style.transition = "transform " + phase.duration + "ms ease-in-out";
      circleEl.style.transform = "scale(" + phase.scale + ")";
    }
    breathingTimer = setTimeout(function () {
      stepBreathing(phaseIndex + 1);
    }, phase.duration);
  }

  function wireBreathing() {
    const toggleBtn = qs("#breathing-toggle");
    const labelEl = qs("#breathing-label");
    const circleEl = qs("#breathing-circle");
    if (!toggleBtn) return;

    toggleBtn.addEventListener("click", function () {
      breathingActive = !breathingActive;
      if (breathingActive) {
        toggleBtn.textContent = "Stop";
        stepBreathing(0);
      } else {
        toggleBtn.textContent = "Start breathing";
        if (breathingTimer) clearTimeout(breathingTimer);
        if (labelEl) labelEl.textContent = "Tap start for a guided breath";
        if (circleEl) {
          circleEl.style.transition = "transform 400ms ease-out";
          circleEl.style.transform = "scale(1)";
        }
      }
    });
  }

  const STRESS_LABELS = { 1: "Calm", 2: "Mild", 3: "Moderate", 4: "High", 5: "Overwhelmed" };

  function wireStress() {
    const slider = qs("#stress-slider");
    const valueLabel = qs("#stress-value-label");
    const saveBtn = qs("#save-stress");
    if (!slider) return;

    slider.addEventListener("input", function () {
      if (valueLabel) valueLabel.textContent = STRESS_LABELS[slider.value] || "Moderate";
    });

    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        record = MindBloomData.logStress(Number(slider.value));
        MindBloomUtils.showToast("Stress check-in logged.", "success");
      });
    }
  }

  /* ======================================================================
     MOOD TAB — mood picker + history
     ====================================================================== */
  let selectedMood = null;

  function renderMoodTab() {
    const picker = qs("#mood-log-picker");
    const saveBtn = qs("#save-mood");

    MindBloomUtils.renderMoodPicker(picker, selectedMood, function (mood) {
      selectedMood = mood;
      if (saveBtn) saveBtn.disabled = false;
    });

    if (saveBtn) {
      saveBtn.disabled = !selectedMood;
      saveBtn.onclick = function () {
        if (!selectedMood) return;
        record = MindBloomData.logMood(selectedMood);
        MindBloomUtils.showToast("Mood logged — thanks for checking in.", "success");
        renderMoodHistory();
      };
    }
  }

  function renderMoodHistory() {
    const list = qs("#mood-history-list");
    const emptyState = qs("#mood-empty");
    if (!list) return;
    list.innerHTML = "";

    const logs = record.moodLogs.slice(0, 30);
    const isEmpty = !logs.length;
    if (emptyState) emptyState.hidden = !isEmpty;
    list.hidden = isEmpty;
    if (isEmpty) return;

    logs.forEach(function (log, index) {
      const meta = MindBloomData.moodMeta(log.mood);
      const li = el(
        "li",
        "mood-history-item anim-stagger",
        '<span class="mood-history-item__emoji">' + MindBloomUtils.icon("mood-" + log.mood) + "</span>" +
          '<span class="mood-history-item__date">' +
          (meta ? meta.label : log.mood) +
          " · " +
          MindBloomData.formatRelativeTime(log.timestamp) +
          "</span>"
      );
      li.style.setProperty("--delay", index * 40 + "ms");
      list.appendChild(li);
    });
  }

  /* ======================================================================
     INIT
     ====================================================================== */
  function init() {
    record = MindBloomData.load();
    wireTabs();
    prefillPhysicalFromToday();
    wireSteppers();
    wireBreathing();
    wireStress();
    renderMoodTab();
    renderMoodHistory();
    MindBloomUtils.initShell("wellbeing");
  }

  window.MindBloomPhysical = { init: init };

  document.addEventListener("DOMContentLoaded", init);
})(window, document);

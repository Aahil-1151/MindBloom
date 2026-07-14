/* ==========================================================================
   MindBloom — physical.js
   Controller for physical.html (the Wellbeing hub: Physical / Mental /
   Mood tabs). Uses the same localStorage-first, Firebase-ready pattern as
   the rest of the app. Supports deep-linking via URL hash
   (physical.html#mood, physical.html#mental) since Dashboard's quick
   actions link directly into a specific tab.
   ========================================================================== */

(function (window, document) {
  "use strict";

  const el = MindBloomUtils.el;
  const showToast = MindBloomUtils.showToast;
  const toDateKey = MindBloomUtils.toDateKey;

  const PHYSICAL_KEY = "mindbloom_physical_logs";
  const MENTAL_KEY = "mindbloom_mental_checkins";
  const MOOD_KEY = "mindbloom_moods";

  const MOOD_OPTIONS = [
    { key: "rough", emoji: "mood-rough", label: "Rough" },
    { key: "low", emoji: "mood-low", label: "Low" },
    { key: "okay", emoji: "mood-okay", label: "Okay" },
    { key: "good", emoji: "mood-good", label: "Good" },
    { key: "great", emoji: "mood-great", label: "Great" },
  ];

  let els = {};
  let physicalState = { sleep: 7.5, water: 0, activity: 0 };
  let selectedMood = null;
  let breathingActive = false;
  let breathingTimer = null;

  /* ----------------------------------------------------------------------
     STORAGE HELPERS (small + local to this page, same read/write pattern
     used by every other *-storage.js in the app)
     ---------------------------------------------------------------------- */
  function readAll(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  function writeAll(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function upsertTodayLog(key, fields) {
    const all = readAll(key);
    const todayKey = toDateKey(new Date());
    const index = all.findIndex(function (entry) {
      return entry.date === todayKey;
    });

    if (index !== -1) {
      all[index] = Object.assign({}, all[index], fields);
    } else {
      all.push(Object.assign({ id: "log_" + Date.now(), date: todayKey, createdAt: new Date().toISOString() }, fields));
    }
    writeAll(key, all);
  }

  function addEntry(key, fields) {
    const all = readAll(key);
    all.push(Object.assign({ id: "entry_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6), createdAt: new Date().toISOString() }, fields));
    writeAll(key, all);
  }

  /* ----------------------------------------------------------------------
     TAB SWITCHING (with hash deep-linking)
     ---------------------------------------------------------------------- */
  function switchTab(tabKey) {
    document.querySelectorAll(".segmented-control__tab").forEach(function (tab) {
      const active = tab.dataset.tab === tabKey;
      tab.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
      panel.hidden = panel.id !== "tab-" + tabKey;
    });
    if (tabKey !== "mental" && breathingActive) {
      stopBreathing();
    }
  }

  function wireTabs() {
    document.querySelectorAll(".segmented-control__tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        switchTab(tab.dataset.tab);
        history.replaceState(null, "", "#" + tab.dataset.tab);
      });
    });
  }

  /* ----------------------------------------------------------------------
     PHYSICAL TAB
     ---------------------------------------------------------------------- */
  function renderPhysicalValues() {
    document.getElementById("sleep-value").innerHTML = physicalState.sleep + "<small>h</small>";
    document.getElementById("water-value").innerHTML = physicalState.water + "<small>cups</small>";
    document.getElementById("activity-value").innerHTML = physicalState.activity + "<small>min</small>";
  }

  function wirePhysicalSteppers() {
    document.querySelectorAll("[data-stepper]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const field = btn.dataset.stepper;
        const delta = Number(btn.dataset.delta);
        const next = physicalState[field] + delta;

        if (field === "sleep") physicalState.sleep = Math.max(0, Math.min(14, next));
        else physicalState[field] = Math.max(0, next);

        renderPhysicalValues();
      });
    });

    document.getElementById("save-physical").addEventListener("click", function () {
      upsertTodayLog(PHYSICAL_KEY, {
        sleepHours: physicalState.sleep,
        waterCups: physicalState.water,
        activityMinutes: physicalState.activity,
      });
      showToast("Today's log saved");
    });
  }

  function loadTodayPhysical() {
    const todayKey = toDateKey(new Date());
    const existing = readAll(PHYSICAL_KEY).find(function (e) {
      return e.date === todayKey;
    });
    if (existing) {
      physicalState = {
        sleep: existing.sleepHours,
        water: existing.waterCups,
        activity: existing.activityMinutes,
      };
    }
    renderPhysicalValues();
  }

  /* ----------------------------------------------------------------------
     MENTAL TAB — breathing exercise
     ---------------------------------------------------------------------- */
  function startBreathing() {
    breathingActive = true;
    els.breathingCircle.classList.add("anim-breathe");
    els.breathingLabel.textContent = "Breathe in… and out… follow the circle";
    els.breathingToggle.textContent = "Stop";
  }

  function stopBreathing() {
    breathingActive = false;
    els.breathingCircle.classList.remove("anim-breathe");
    els.breathingLabel.textContent = "Tap start for a guided breath";
    els.breathingToggle.textContent = "Start breathing";
    if (breathingTimer) clearTimeout(breathingTimer);
  }

  function wireBreathing() {
    els.breathingToggle.addEventListener("click", function () {
      if (breathingActive) {
        stopBreathing();
      } else {
        startBreathing();
        breathingTimer = setTimeout(function () {
          stopBreathing();
          addEntry(MENTAL_KEY, { type: "breathing", durationSeconds: 60 });
          showToast("Nice work — breathing session logged");
        }, 60000);
      }
    });
  }

  /* ----------------------------------------------------------------------
     MENTAL TAB — stress check-in
     ---------------------------------------------------------------------- */
  const STRESS_LABELS = { 1: "Calm", 2: "Mild", 3: "Moderate", 4: "High", 5: "Overwhelmed" };

  function wireStressSlider() {
    els.stressSlider.addEventListener("input", function () {
      els.stressValueLabel.textContent = STRESS_LABELS[els.stressSlider.value];
    });

    document.getElementById("save-stress").addEventListener("click", function () {
      addEntry(MENTAL_KEY, { type: "check-in", stressLevel: Number(els.stressSlider.value) });
      showToast("Stress check-in logged");
    });
  }

  /* ----------------------------------------------------------------------
     MOOD TAB
     ---------------------------------------------------------------------- */
  function renderMoodPicker() {
    els.moodPicker.innerHTML = "";
    MOOD_OPTIONS.forEach(function (mood) {
      const button = el("button", "mood-option", MindBloomUtils.icon(mood.emoji));
      button.type = "button";
      button.dataset.mood = mood.key;
      button.setAttribute("aria-pressed", String(selectedMood === mood.key));
      button.setAttribute("aria-label", mood.label);
      button.addEventListener("click", function () {
        selectedMood = mood.key;
        document.getElementById("save-mood").disabled = false;
        renderMoodPicker();
      });
      els.moodPicker.appendChild(button);
    });
  }

  function formatMoodDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function renderMoodHistory() {
    const moods = readAll(MOOD_KEY).slice().reverse().slice(0, 10);
    const list = document.getElementById("mood-history-list");
    const empty = document.getElementById("mood-empty");
    list.innerHTML = "";

    if (moods.length === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    moods.forEach(function (entry) {
      const option = MOOD_OPTIONS.find(function (m) {
        return m.key === entry.mood;
      });
      list.appendChild(
        el(
          "li",
          "mood-history-item",
          '<span class="mood-history-item__emoji">' + MindBloomUtils.icon(option ? option.emoji : "mood-good") + "</span>" +
            '<span class="mood-history-item__date">' + formatMoodDate(entry.createdAt) + "</span>"
        )
      );
    });
  }

  function wireMoodSave() {
    document.getElementById("save-mood").addEventListener("click", function () {
      if (!selectedMood) return;
      addEntry(MOOD_KEY, { mood: selectedMood });
      selectedMood = null;
      document.getElementById("save-mood").disabled = true;
      renderMoodPicker();
      renderMoodHistory();
      showToast("Mood logged");
    });
  }

  /* ----------------------------------------------------------------------
     INIT
     ---------------------------------------------------------------------- */
  function cacheElements() {
    els = {
      breathingCircle: document.getElementById("breathing-circle"),
      breathingLabel: document.getElementById("breathing-label"),
      breathingToggle: document.getElementById("breathing-toggle"),
      stressSlider: document.getElementById("stress-slider"),
      stressValueLabel: document.getElementById("stress-value-label"),
      moodPicker: document.getElementById("mood-log-picker"),
    };
    MindBloomUtils.initShell("wellbeing");
  }

  function init() {
    cacheElements();
    wireTabs();
    wirePhysicalSteppers();
    wireBreathing();
    wireStressSlider();
    wireMoodSave();

    loadTodayPhysical();
    renderMoodPicker();
    renderMoodHistory();

    const hashTab = window.location.hash.replace("#", "");
    if (["physical", "mental", "mood"].indexOf(hashTab) !== -1) {
      switchTab(hashTab);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})(window, document);

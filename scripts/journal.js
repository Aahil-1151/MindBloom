/* ==========================================================================
   MindBloom — journal.js
   Page controller for journal.html. This is the only file that talks to
   the data layer (journal-storage.js) and the AI layers
   (emotion-analysis.js, reflection.js), and it owns all DOM rendering for
   this page (no separate UI module was requested for this module).
   Attaches its own DOMContentLoaded listener — journal.html has no inline
   scripts.
   ========================================================================== */

(function (window, document) {
  "use strict";

  let els = {};
  let selectedMood = null;
  let activeFilter = "all";
  let searchQuery = "";

  const MOOD_OPTIONS = [
    { key: "rough", emoji: "mood-rough", label: "Rough" },
    { key: "low", emoji: "mood-low", label: "Low" },
    { key: "okay", emoji: "mood-okay", label: "Okay" },
    { key: "good", emoji: "mood-good", label: "Good" },
    { key: "great", emoji: "mood-great", label: "Great" },
  ];

  const FILTER_OPTIONS = [
    { key: "all", label: "All" },
    { key: "great", label: "Great" },
    { key: "good", label: "Good" },
    { key: "okay", label: "Okay" },
    { key: "low", label: "Low" },
    { key: "rough", label: "Rough" },
  ];

  /* ----------------------------------------------------------------------
     DOM helpers
     ---------------------------------------------------------------------- */
  const el = MindBloomUtils.el;
  const showToast = MindBloomUtils.showToast;

  function cacheElements() {
    els = {
      promptText: document.getElementById("prompt-text"),
      refreshPrompt: document.getElementById("refresh-prompt"),
      moodPicker: document.getElementById("composer-mood-picker"),
      textarea: document.getElementById("journal-textarea"),
      saveBtn: document.getElementById("journal-save"),
      composerStatus: document.getElementById("composer-status"),
      filterRow: document.getElementById("filter-row"),
      searchInput: document.getElementById("journal-search"),
      entriesList: document.getElementById("entries-list"),
      emptyState: document.getElementById("entries-empty"),
    };
    MindBloomUtils.initShell("journal");
  }

  function formatDate(isoString) {
    return new Date(isoString).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function truncate(text, max) {
    if (text.length <= max) return text;
    return text.slice(0, max).trim() + "…";
  }

  function themeLabel(theme) {
    const labels = {
      academic: { icon: "cap", text: "School" },
      friends: { icon: "users", text: "Friends" },
      family: { icon: "home", text: "Family" },
      sleep: { icon: "moon", text: "Sleep" },
      health: { icon: "medical", text: "Health" },
      relationship: { icon: "heart", text: "Relationship" },
      future: { icon: "chart", text: "Future" },
    };
    const entry = labels[theme];
    if (!entry) return theme;
    return MindBloomUtils.icon(entry.icon, "icon--sm") + " " + entry.text;
  }

  /* ----------------------------------------------------------------------
     COMPOSER: prompt suggestion + mood picker
     ---------------------------------------------------------------------- */
  async function loadNewPrompt() {
    els.promptText.textContent = "Thinking of a prompt…";
    const prompt = await Reflection.getPrompt();
    els.promptText.textContent = prompt;
  }

  function renderMoodPicker() {
    els.moodPicker.innerHTML = "";
    MOOD_OPTIONS.forEach(function (mood) {
      const button = el("button", "mood-option", MindBloomUtils.icon(mood.emoji));
      button.type = "button";
      button.dataset.mood = mood.key;
      button.setAttribute("aria-pressed", String(selectedMood === mood.key));
      button.setAttribute("aria-label", mood.label);
      button.addEventListener("click", function () {
        selectedMood = selectedMood === mood.key ? null : mood.key;
        renderMoodPicker();
      });
      els.moodPicker.appendChild(button);
    });
  }

  /* ----------------------------------------------------------------------
     ENTRY LIST RENDERING
     ---------------------------------------------------------------------- */
  function getFilteredEntries() {
    let entries = JournalStorage.getRecent(1000); // newest first

    if (activeFilter !== "all") {
      entries = entries.filter(function (entry) {
        return EmotionAnalysis.mapToMoodBucket(entry.sentimentLabel) === activeFilter;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      entries = entries.filter(function (entry) {
        return entry.text.toLowerCase().indexOf(q) !== -1;
      });
    }

    return entries;
  }

  function renderFilterRow() {
    els.filterRow.innerHTML = "";
    FILTER_OPTIONS.forEach(function (filter) {
      const chip = el("button", "chip chip--selectable", filter.label);
      chip.type = "button";
      chip.setAttribute("aria-pressed", String(activeFilter === filter.key));
      chip.addEventListener("click", function () {
        activeFilter = filter.key;
        renderFilterRow();
        renderEntries();
      });
      els.filterRow.appendChild(chip);
    });
  }

  function buildEntryCard(entry, index) {
    const bucket = EmotionAnalysis.mapToMoodBucket(entry.sentimentLabel);

    const card = el("li", "journal-entry card card--mood anim-stagger");
    card.dataset.mood = bucket;
    card.style.setProperty("--delay", index * 40 + "ms");

    const header = el(
      "div",
      "journal-entry__header",
      '<span class="journal-entry__emoji">' + MindBloomUtils.icon(entry.sentimentEmoji) + "</span>" +
        '<span class="journal-entry__date">' + formatDate(entry.createdAt) + "</span>"
    );

    const deleteBtn = el("button", "btn btn--icon btn--sm journal-entry__delete", MindBloomUtils.icon("trash", "icon--sm"));
    deleteBtn.type = "button";
    deleteBtn.setAttribute("aria-label", "Delete entry");
    deleteBtn.addEventListener("click", function () {
      if (window.confirm("Delete this journal entry? This can't be undone.")) {
        JournalStorage.remove(entry.id);
        renderEntries();
        showToast("Entry deleted");
      }
    });
    header.appendChild(deleteBtn);

    const isLong = entry.text.length > 220;
    const body = el(
      "p",
      "journal-entry__text",
      isLong ? truncate(entry.text, 220) : entry.text
    );

    if (isLong) {
      const toggle = el("button", "auth-link journal-entry__toggle", "Read more");
      toggle.type = "button";
      let expanded = false;
      toggle.addEventListener("click", function () {
        expanded = !expanded;
        body.textContent = expanded ? entry.text : truncate(entry.text, 220);
        toggle.textContent = expanded ? "Show less" : "Read more";
      });
      card.appendChild(header);
      card.appendChild(body);
      card.appendChild(toggle);
    } else {
      card.appendChild(header);
      card.appendChild(body);
    }

    if (entry.themes && entry.themes.length > 0) {
      const themeRow = el("div", "journal-entry__themes");
      entry.themes.forEach(function (theme) {
        themeRow.appendChild(el("span", "chip chip--secondary", themeLabel(theme)));
      });
      card.appendChild(themeRow);
    }

    if (entry.reflection) {
      const reflectionBox = el(
        "div",
        "journal-reflection",
        '<span class="journal-reflection__icon">' + MindBloomUtils.icon('leaf', 'icon--sm') + '</span>' +
          '<p class="journal-reflection__text">' + entry.reflection + "</p>"
      );
      card.appendChild(reflectionBox);
    }

    return card;
  }

  function renderEntries() {
    const entries = getFilteredEntries();
    els.entriesList.innerHTML = "";

    if (entries.length === 0) {
      els.emptyState.hidden = false;
      return;
    }

    els.emptyState.hidden = true;
    entries.forEach(function (entry, index) {
      els.entriesList.appendChild(buildEntryCard(entry, index));
    });
  }

  /* ----------------------------------------------------------------------
     SAVE FLOW
     ---------------------------------------------------------------------- */
  async function handleSave() {
    const text = els.textarea.value.trim();
    if (!text) return;

    els.saveBtn.disabled = true;
    els.composerStatus.textContent = "Reading your entry…";

    const analysis = await EmotionAnalysis.analyze(text);
    const recentEntries = JournalStorage.getRecent(30);
    const reflection = await Reflection.getReflection(analysis, text, recentEntries);

    JournalStorage.add({
      text: text,
      mood: selectedMood,
      sentimentLabel: analysis.label,
      sentimentEmoji: analysis.emoji,
      themes: analysis.themes,
      reflection: reflection,
    });

    els.textarea.value = "";
    selectedMood = null;
    renderMoodPicker();
    renderEntries();
    await loadNewPrompt();

    els.composerStatus.textContent = "";
    els.saveBtn.disabled = false;
    showToast(analysis.isCrisis ? "Entry saved. Please see the note below it." : "Entry saved");
  }

  /* ----------------------------------------------------------------------
     WIRING
     ---------------------------------------------------------------------- */
  function wireComposer() {
    els.saveBtn.addEventListener("click", handleSave);
    els.refreshPrompt.addEventListener("click", loadNewPrompt);

    els.textarea.addEventListener("input", function () {
      els.saveBtn.disabled = els.textarea.value.trim().length === 0;
    });
  }

  function wireSearch() {
    let debounceTimer = null;
    els.searchInput.addEventListener("input", function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        searchQuery = els.searchInput.value;
        renderEntries();
      }, 200);
    });
  }

  async function init() {
    cacheElements();
    renderMoodPicker();
    renderFilterRow();
    renderEntries();
    wireComposer();
    wireSearch();
    els.saveBtn.disabled = true;
    await loadNewPrompt();
  }

  document.addEventListener("DOMContentLoaded", init);
})(window, document);

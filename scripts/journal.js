/* ==========================================================================
   MindBloom — journal.js
   Journal page controller: the composer (prompt + textarea + optional
   mood tag), the filter/search row, and the entries list. Saving an entry
   runs it through EmotionAnalysis + Reflection for a short "Bloom" note,
   then persists it via JournalStorage -> MindBloomData (core/data-store.js)
   — the same shared record the dashboard reads, so a saved entry (and its
   mood, if one was picked) shows up in Recent Activity and the mood
   history immediately.
   ========================================================================== */

(function (window, document) {
  "use strict";

  function qs(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  const el = MindBloomUtils.el;

  const PROMPTS = [
    "What's taking up the most space in your head right now?",
    "What went better than expected today?",
    "What's one thing you're avoiding, and why?",
    "Who or what made today easier?",
    "If today had a headline, what would it say?",
    "What do you need more of this week?",
    "What's something small you're proud of today?",
    "What would you tell a friend who had the day you just had?",
  ];

  let promptIndex = new Date().getDate() % PROMPTS.length;
  let composerMood = null;
  let moodFilter = "all";
  let searchQuery = "";

  /* ======================================================================
     COMPOSER
     ====================================================================== */
  function renderPrompt() {
    const promptEl = qs("#prompt-text");
    if (promptEl) promptEl.textContent = PROMPTS[promptIndex];
  }

  function wirePromptRefresh() {
    const btn = qs("#refresh-prompt");
    if (!btn) return;
    btn.addEventListener("click", function () {
      let next = Math.floor(Math.random() * PROMPTS.length);
      if (PROMPTS.length > 1) {
        while (next === promptIndex) next = Math.floor(Math.random() * PROMPTS.length);
      }
      promptIndex = next;
      renderPrompt();
    });
  }

  function updateComposerStatus() {
    const statusEl = qs("#composer-status");
    const textarea = qs("#journal-textarea");
    if (!statusEl || !textarea) return;
    const words = textarea.value.trim() ? textarea.value.trim().split(/\s+/).length : 0;
    statusEl.textContent = words ? words + (words === 1 ? " word" : " words") : "";
  }

  function renderComposerMoodPicker() {
    const picker = qs("#composer-mood-picker");
    MindBloomUtils.renderMoodPicker(picker, composerMood, function (mood) {
      composerMood = mood;
    });
  }

  function wireComposer() {
    const textarea = qs("#journal-textarea");
    const saveBtn = qs("#journal-save");

    if (textarea) {
      textarea.addEventListener("input", updateComposerStatus);
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        const text = (textarea.value || "").trim();
        if (!text) {
          MindBloomUtils.showToast("Write something before saving.", "error");
          return;
        }

        const analysis = EmotionAnalysis.analyze(text);
        const reflection = Reflection.generate(text, analysis);
        JournalStorage.add({
          text: text,
          mood: composerMood,
          emotion: analysis.emotion,
          reflection: reflection,
        });

        textarea.value = "";
        composerMood = null;
        renderComposerMoodPicker();
        updateComposerStatus();
        MindBloomUtils.showToast("Entry saved.", "success");
        renderEntries();
      });
    }
  }

  /* ======================================================================
     FILTERS + SEARCH
     ====================================================================== */
  const FILTERS = [{ key: "all", label: "All" }].concat(
    MindBloomData.MOOD_META.map(function (m) {
      return { key: m.key, label: m.label };
    })
  );

  function renderFilters() {
    const row = qs("#filter-row");
    if (!row) return;
    row.innerHTML = "";

    FILTERS.forEach(function (filter) {
      const chip = el("button", "chip chip--selectable", filter.label);
      chip.type = "button";
      chip.setAttribute("aria-pressed", String(filter.key === moodFilter));
      chip.addEventListener("click", function () {
        moodFilter = filter.key;
        row.querySelectorAll(".chip").forEach(function (c) {
          c.setAttribute("aria-pressed", "false");
        });
        chip.setAttribute("aria-pressed", "true");
        renderEntries();
      });
      row.appendChild(chip);
    });
  }

  function wireSearch() {
    const input = qs("#journal-search");
    if (!input) return;
    input.addEventListener("input", function () {
      searchQuery = input.value;
      renderEntries();
    });
  }

  /* ======================================================================
     ENTRIES LIST
     ====================================================================== */
  function truncate(text, max) {
    if (text.length <= max) return { short: text, isLong: false };
    return { short: text.slice(0, max).trim() + "…", isLong: true };
  }

  function renderEntries() {
    const list = qs("#entries-list");
    const emptyState = qs("#entries-empty");
    if (!list) return;
    list.innerHTML = "";

    const all = JournalStorage.getAll();
    const filtered = JournalStorage.search(JournalStorage.filterByMood(all, moodFilter), searchQuery);

    const isEmpty = !filtered.length;
    if (emptyState) {
      emptyState.hidden = !isEmpty;
      const heading = emptyState.querySelector("h3");
      const body = emptyState.querySelector("p");
      if (isEmpty && all.length) {
        if (heading) heading.textContent = "No entries match";
        if (body) body.textContent = "Try a different mood filter or search term.";
      } else if (isEmpty) {
        if (heading) heading.textContent = "No entries yet";
        if (body) body.textContent = "Write your first entry above — Bloom will reflect it back to you.";
      }
    }
    list.hidden = isEmpty;
    if (isEmpty) return;

    filtered.forEach(function (entry, index) {
      const meta = entry.mood ? MindBloomData.moodMeta(entry.mood) : null;
      const truncated = truncate(entry.text, 220);
      const short = truncated.short;
      const isLong = truncated.isLong;

      const li = el(
        "li",
        "journal-entry card card--mood anim-stagger",
        '<div class="journal-entry__header">' +
          '<span class="journal-entry__emoji">' +
          MindBloomUtils.icon(meta ? "mood-" + meta.key : "edit") +
          "</span>" +
          '<span class="journal-entry__date">' +
          MindBloomData.formatRelativeTime(entry.timestamp) +
          "</span>" +
          '<button type="button" class="btn btn--icon journal-entry__delete" aria-label="Delete entry">' +
          MindBloomUtils.icon("trash", "icon--sm") +
          "</button>" +
          "</div>" +
          '<p class="journal-entry__text" data-full="' +
          encodeURIComponent(entry.text) +
          '">' +
          (isLong ? short : entry.text) +
          "</p>" +
          (isLong ? '<button type="button" class="journal-entry__toggle auth-link">Show more</button>' : "") +
          (entry.emotion && entry.emotion !== "neutral"
            ? '<div class="journal-entry__themes"><span class="chip chip--secondary">' +
              entry.emotion.charAt(0).toUpperCase() +
              entry.emotion.slice(1) +
              "</span></div>"
            : "") +
          (entry.reflection
            ? '<div class="journal-reflection">' +
              '<span class="journal-reflection__icon">' +
              MindBloomUtils.icon("sparkle") +
              "</span>" +
              '<p class="journal-reflection__text">' +
              entry.reflection +
              "</p>" +
              "</div>"
            : "")
      );
      li.style.setProperty("--delay", index * 40 + "ms");
      if (meta) li.dataset.mood = meta.key;

      const deleteBtn = li.querySelector(".journal-entry__delete");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", function () {
          JournalStorage.remove(entry.id);
          MindBloomUtils.showToast("Entry deleted.", null);
          renderEntries();
        });
      }

      const toggleBtn = li.querySelector(".journal-entry__toggle");
      if (toggleBtn) {
        toggleBtn.addEventListener("click", function () {
          const textEl = li.querySelector(".journal-entry__text");
          const expanded = toggleBtn.textContent === "Show less";
          if (textEl) textEl.textContent = expanded ? short : entry.text;
          toggleBtn.textContent = expanded ? "Show more" : "Show less";
        });
      }

      list.appendChild(li);
    });
  }

  /* ======================================================================
     INIT
     ====================================================================== */
  function init() {
    renderPrompt();
    wirePromptRefresh();
    renderComposerMoodPicker();
    wireComposer();
    updateComposerStatus();
    renderFilters();
    wireSearch();
    renderEntries();
    MindBloomUtils.initShell("wellbeing");
  }

  window.MindBloomJournal = { init: init };

  document.addEventListener("DOMContentLoaded", init);
})(window, document);

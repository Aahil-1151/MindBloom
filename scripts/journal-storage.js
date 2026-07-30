/* ==========================================================================
   MindBloom — journal-storage.js
   Thin, journal-specific query layer over MindBloomData (core/data-store.js)
   — the actual persistence (localStorage, per-user keying) lives there.
   This module just adds the read helpers journal.js needs: fetch all
   entries, search by text, and filter by mood.
   ========================================================================== */

(function (window) {
  "use strict";

  function getAll() {
    return MindBloomData.load().journalEntries;
  }

  function add(entry) {
    return MindBloomData.addJournalEntry(entry);
  }

  function remove(id) {
    return MindBloomData.deleteJournalEntry(id);
  }

  function filterByMood(entries, moodKey) {
    if (!moodKey || moodKey === "all") return entries;
    return entries.filter(function (e) {
      return e.mood === moodKey;
    });
  }

  function search(entries, query) {
    const normalized = (query || "").trim().toLowerCase();
    if (!normalized) return entries;
    return entries.filter(function (e) {
      return (e.text || "").toLowerCase().indexOf(normalized) !== -1;
    });
  }

  window.JournalStorage = {
    getAll: getAll,
    add: add,
    remove: remove,
    filterByMood: filterByMood,
    search: search,
  };
})(window);

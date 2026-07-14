/* ==========================================================================
   MindBloom — journal-storage.js
   Data layer for the Journal module. Reads/writes entries to localStorage
   today. Method names and return shapes (getAll, add, update, remove) are
   exactly what a future Firestore-backed version would expose
   (users/{uid}/journalEntries/{id}) — swapping the internals later
   requires no changes anywhere else in the Journal module.
   ========================================================================== */

(function (window) {
  "use strict";

  const JOURNAL_KEY = "mindbloom_journal";

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.error("JournalStorage: failed to read " + key, err);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error("JournalStorage: failed to write " + key, err);
      return false;
    }
  }

  function generateId() {
    return (
      "entry_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8)
    );
  }

  const JournalStorage = {
    /**
     * @returns {Array<{
     *   id:string, text:string, mood:string|null,
     *   sentimentLabel:string, sentimentEmoji:string, themes:string[],
     *   reflection:string, createdAt:string, updatedAt:string|null
     * }>}
     */
    getAll() {
      return readJSON(JOURNAL_KEY, []);
    },

    /** @returns {object|null} */
    getById(id) {
      return this.getAll().find(function (entry) {
        return entry.id === id;
      }) || null;
    },

    /**
     * @returns {Array} the n most recently created entries, newest first
     */
    getRecent(n) {
      return this.getAll()
        .slice()
        .sort(function (a, b) {
          return new Date(b.createdAt) - new Date(a.createdAt);
        })
        .slice(0, n);
    },

    /**
     * Persist a new entry. Fills in id/createdAt if not provided.
     * @param {object} entry
     * @returns {object} the stored entry
     */
    add(entry) {
      const stored = {
        id: entry.id || generateId(),
        text: entry.text,
        mood: entry.mood || null,
        sentimentLabel: entry.sentimentLabel || "neutral",
        sentimentEmoji: entry.sentimentEmoji || "mood-okay",
        themes: entry.themes || [],
        reflection: entry.reflection || "",
        createdAt: entry.createdAt || new Date().toISOString(),
        updatedAt: null,
      };

      const all = this.getAll();
      all.push(stored);
      writeJSON(JOURNAL_KEY, all);

      return stored;
    },

    /**
     * @param {string} id
     * @param {object} changes
     * @returns {object|null} the updated entry, or null if not found
     */
    update(id, changes) {
      const all = this.getAll();
      const index = all.findIndex(function (entry) {
        return entry.id === id;
      });
      if (index === -1) return null;

      all[index] = Object.assign({}, all[index], changes, {
        updatedAt: new Date().toISOString(),
      });
      writeJSON(JOURNAL_KEY, all);
      return all[index];
    },

    /** @returns {boolean} whether an entry was actually removed */
    remove(id) {
      const all = this.getAll();
      const filtered = all.filter(function (entry) {
        return entry.id !== id;
      });
      writeJSON(JOURNAL_KEY, filtered);
      return filtered.length !== all.length;
    },

    /** Wipe all journal entries. */
    clear() {
      writeJSON(JOURNAL_KEY, []);
      return true;
    },
  };

  window.JournalStorage = JournalStorage;
})(window);

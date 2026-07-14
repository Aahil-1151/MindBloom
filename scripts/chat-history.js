/* ==========================================================================
   MindBloom — chat-history.js
   Data layer for the AI Chat module. Reads/writes chat messages to
   localStorage today. The public method names and return shapes
   (getAll, add, clear, getLast) are exactly what a future Firestore-backed
   version would expose too — e.g. users/{uid}/chats/{id} — so swapping the
   internals later does not require chat.js, conversation-ui.js, or
   prompt-manager.js to change at all.
   ========================================================================== */

(function (window) {
  "use strict";

  const HISTORY_KEY = "mindbloom_chat_history";

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.error("ChatHistory: failed to read " + key, err);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error("ChatHistory: failed to write " + key, err);
      return false;
    }
  }

  function generateMessageId() {
    return (
      "msg_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8)
    );
  }

  const ChatHistory = {
    /**
     * @returns {Array<{id:string, sender:'user'|'bloom', text:string, timestamp:string}>}
     */
    getAll() {
      return readJSON(HISTORY_KEY, []);
    },

    /**
     * @returns {Array} the last n messages, oldest to newest
     */
    getLast(n) {
      const all = this.getAll();
      return all.slice(Math.max(0, all.length - n));
    },

    /**
     * Persist a new message. Fills in id/timestamp if not provided.
     * @param {{sender:'user'|'bloom', text:string}} message
     * @returns {object} the stored message, including generated fields
     */
    add(message) {
      const stored = {
        id: message.id || generateMessageId(),
        sender: message.sender,
        text: message.text,
        timestamp: message.timestamp || new Date().toISOString(),
      };

      const all = this.getAll();
      all.push(stored);
      writeJSON(HISTORY_KEY, all);

      return stored;
    },

    /** Wipe all chat history for the current user. */
    clear() {
      writeJSON(HISTORY_KEY, []);
      return true;
    },

    /** @returns {boolean} whether any history exists yet */
    hasHistory() {
      return this.getAll().length > 0;
    },
  };

  window.ChatHistory = ChatHistory;
})(window);

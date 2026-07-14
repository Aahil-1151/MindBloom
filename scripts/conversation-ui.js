/* ==========================================================================
   MindBloom — conversation-ui.js
   Pure UI/rendering layer for the chat screen. This module never reads or
   writes localStorage and never decides what a reply should say — it only
   turns data it's given into DOM, and reports user interactions back via
   callbacks. chat.js is the only file that talks to both this module and
   the data/AI layers (chat-history.js, prompt-manager.js).
   ========================================================================== */

(function (window) {
  "use strict";

  const el = window.MindBloomUtils.el;

  function formatTime(isoString) {
    try {
      return new Date(isoString).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch (err) {
      return "";
    }
  }

  const ConversationUI = {
    /**
     * Render a single message bubble and append it to the container.
     * @param {HTMLElement} container - the <ul> message list
     * @param {{sender:'user'|'bloom', text:string, timestamp:string}} message
     */
    renderMessage(container, message) {
      if (!container) return;

      const isUser = message.sender === "user";
      const li = el("li", "chat-row " + (isUser ? "chat-row--user" : "chat-row--bloom") + " anim-fade-up");

      if (!isUser) {
        const avatar = el("div", "chat-avatar", window.MindBloomUtils.icon("leaf", "icon--sm"));
        li.appendChild(avatar);
      }

      const bubbleWrap = el("div", "chat-bubble-wrap");
      const bubble = el(
        "div",
        "chat-bubble " + (isUser ? "chat-bubble--user" : "chat-bubble--bloom"),
        this._escapeHtml(message.text)
      );
      const time = el("span", "chat-bubble__time", formatTime(message.timestamp));

      bubbleWrap.appendChild(bubble);
      bubbleWrap.appendChild(time);
      li.appendChild(bubbleWrap);

      container.appendChild(li);
    },

    /**
     * Render an entire message history at once (used on page load).
     * @param {HTMLElement} container
     * @param {Array} messages
     */
    renderAll(container, messages) {
      if (!container) return;
      container.innerHTML = "";
      const self = this;
      messages.forEach(function (message) {
        self.renderMessage(container, message);
      });
    },

    /** Insert an animated "Bloom is typing…" bubble. Returns the node so it can be removed later. */
    showTyping(container) {
      if (!container) return null;
      const li = el(
        "li",
        "chat-row chat-row--bloom anim-fade-up",
        '<div class="chat-avatar">' + window.MindBloomUtils.icon("leaf", "icon--sm") + "</div>" +
          '<div class="chat-bubble-wrap">' +
          '<div class="chat-bubble chat-bubble--bloom chat-bubble--typing">' +
          '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>' +
          "</div></div>"
      );
      li.id = "typing-indicator";
      container.appendChild(li);
      this.scrollToBottom(container);
      return li;
    },

    /** Remove the typing indicator if present. */
    hideTyping(container) {
      if (!container) return;
      const node = container.querySelector("#typing-indicator");
      if (node) node.remove();
    },

    /**
     * Render suggestion chips. Calls onSelect(text) when one is tapped.
     * @param {HTMLElement} container
     * @param {string[]} suggestions
     * @param {(text:string) => void} onSelect
     */
    renderSuggestions(container, suggestions, onSelect) {
      if (!container) return;
      container.innerHTML = "";

      suggestions.forEach(function (suggestion) {
        const chip = el("button", "chip chip--selectable chat-suggestion", suggestion);
        chip.type = "button";
        chip.addEventListener("click", function () {
          onSelect(suggestion);
        });
        container.appendChild(chip);
      });
    },

    /** Scroll a container to its most recent content. */
    scrollToBottom(container) {
      if (!container) return;
      requestAnimationFrame(function () {
        container.scrollTop = container.scrollHeight;
      });
    },

    /** Grow a <textarea> to fit its content, up to a max height set in CSS. */
    autoResizeTextarea(textarea) {
      if (!textarea) return;
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 140) + "px";
    },

    /** Basic HTML escaping so message text can never inject markup. */
    _escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    },
  };

  window.ConversationUI = ConversationUI;
})(window);

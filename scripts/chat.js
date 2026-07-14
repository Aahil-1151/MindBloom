/* ==========================================================================
   MindBloom — chat.js
   Page controller for chat.html. This is the only file that talks to both
   the data layer (chat-history.js) and the AI layer (prompt-manager.js),
   and hands the results to the UI layer (conversation-ui.js) to render.
   No inline scripts exist in chat.html — this file attaches its own
   DOMContentLoaded listener at the bottom.
   ========================================================================== */

(function (window, document) {
  "use strict";

  let els = {};

  function cacheElements() {
    els = {
      messageList: document.getElementById("chat-messages"),
      suggestions: document.getElementById("chat-suggestions"),
      form: document.getElementById("chat-form"),
      input: document.getElementById("chat-input"),
      sendBtn: document.getElementById("chat-send"),
      clearBtn: document.getElementById("chat-clear"),
      status: document.getElementById("chat-status"),
    };
    MindBloomUtils.initShell("bloom");
  }

  function setStatus(text) {
    if (els.status) els.status.textContent = text;
  }

  function loadOrSeedHistory() {
    if (!ChatHistory.hasHistory()) {
      const welcome = ChatHistory.add({
        sender: "bloom",
        text: PromptManager.getWelcomeMessage(),
      });
      return [welcome];
    }
    return ChatHistory.getAll();
  }

  function renderSuggestions(suggestions) {
    ConversationUI.renderSuggestions(els.suggestions, suggestions, function (text) {
      els.input.value = text;
      handleSend();
    });
  }

  async function handleSend() {
    const text = els.input.value.trim();
    if (!text) return;

    const userMessage = ChatHistory.add({ sender: "user", text: text });
    ConversationUI.renderMessage(els.messageList, userMessage);
    ConversationUI.scrollToBottom(els.messageList);

    els.input.value = "";
    ConversationUI.autoResizeTextarea(els.input);
    els.sendBtn.disabled = true;
    setStatus("Bloom is typing…");

    ConversationUI.showTyping(els.messageList);
    ConversationUI.scrollToBottom(els.messageList);

    const history = ChatHistory.getAll();
    const reply = await PromptManager.generateReply(text, history);

    ConversationUI.hideTyping(els.messageList);

    const bloomMessage = ChatHistory.add({ sender: "bloom", text: reply.text });
    ConversationUI.renderMessage(els.messageList, bloomMessage);
    ConversationUI.scrollToBottom(els.messageList);

    renderSuggestions(reply.suggestions || PromptManager.getStarterSuggestions());

    setStatus("Your wellbeing companion");
    els.sendBtn.disabled = false;
    els.input.focus();
  }

  function wireForm() {
    els.form.addEventListener("submit", function (e) {
      e.preventDefault();
      handleSend();
    });

    els.input.addEventListener("input", function () {
      ConversationUI.autoResizeTextarea(els.input);
    });

    els.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
  }

  function wireClear() {
    if (!els.clearBtn) return;
    els.clearBtn.addEventListener("click", function () {
      ChatHistory.clear();
      els.messageList.innerHTML = "";
      const welcome = ChatHistory.add({
        sender: "bloom",
        text: PromptManager.getWelcomeMessage(),
      });
      ConversationUI.renderMessage(els.messageList, welcome);
      renderSuggestions(PromptManager.getStarterSuggestions());
      MindBloomUtils.showToast("Conversation cleared");
    });
  }

  function init() {
    cacheElements();

    const history = loadOrSeedHistory();
    ConversationUI.renderAll(els.messageList, history);
    ConversationUI.scrollToBottom(els.messageList);

    renderSuggestions(PromptManager.getStarterSuggestions());

    wireForm();
    wireClear();
    els.input.focus();
  }

  document.addEventListener("DOMContentLoaded", init);
})(window, document);

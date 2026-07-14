/* ==========================================================================
   MindBloom — prompt-manager.js
   The AI abstraction layer for chat. Everything the rest of the app calls
   goes through PromptManager.generateReply() and PromptManager.getStarterSuggestions().
   Internally this file picks between three "providers":

     - openaiProvider (ACTIVE) — calls the secure backend at BACKEND_URL
       (api/chat.js), which holds the real OpenAI API key server-side.
       Requires BACKEND_URL below to be set to your deployed endpoint.

     - localProvider  — rule-based, keyword-matched replies, fully
       offline. Used automatically as a fallback if the network request
       to openaiProvider fails (no internet, backend not deployed yet,
       API quota hit, etc.) so the chat never just breaks.

     - geminiProvider (STUBBED, NOT ACTIVE) — kept as a future option if
       you ever want to switch providers; same interface as the others.

   Whichever provider runs, generateReply() always resolves to the same
   shape: {text, suggestions}. Nothing in chat.js, conversation-ui.js, or
   chat-history.js needs to know or care which provider produced it.
   ========================================================================== */

(function (window) {
  "use strict";

  // ---- Provider switch -----------------------------------------------
  const ACTIVE_PROVIDER = "openai";

  // ---- Backend endpoint ------------------------------------------------
  // EDIT THIS after you deploy api/chat.js to Vercel (see the deployment
  // steps in the project notes). It must be the FULL https:// URL, not a
  // relative path — this same file runs both in a browser tab and inside
  // an app wrapper later, and only an absolute URL works in both.
  const BACKEND_URL = "https://mind-bloom-kp7y.vercel.app/api/chat";

  // ---- Crisis safety net -------------------------------------------------
  // Checked BEFORE any provider runs, regardless of which one is active.
  // If matched, we never let a simulated or model-generated reply handle
  // it — we respond directly with a calm, resource-forward message every
  // time. This is a second, independent layer on top of the instructions
  // already given to the model in api/chat.js's system prompt.
  const CRISIS_PATTERNS = [
    /suicid/i,
    /kill myself/i,
    /want to die/i,
    /end my life/i,
    /ending it all/i,
    /self[\s-]?harm/i,
    /hurt myself/i,
    /don'?t want to (be alive|live)/i,
  ];

  function isCrisisMessage(text) {
    return CRISIS_PATTERNS.some(function (pattern) {
      return pattern.test(text);
    });
  }

  function crisisResponse() {
    return {
      text:
        "I'm really glad you told me this, and I want you to have real support right now, not just a chat reply. " +
        "If you're in the US, you can call or text 988 (Suicide & Crisis Lifeline) anytime, or text HOME to 741741 to reach the Crisis Text Line. " +
        "If you're outside the US, please look up your local crisis line, or contact emergency services if you're in immediate danger. " +
        "Would it help to talk about what's making today feel this heavy?",
      suggestions: ["I'm safe right now", "I don't feel safe", "Can you just listen?"],
    };
  }

  // ---- Local rule-based provider (fallback when the network call fails) --
  const RESPONSE_RULES = [
    {
      pattern: /\b(hi|hello|hey|good morning|good evening)\b/i,
      replies: [
        "Hey! Good to see you. How's your day going so far?",
        "Hi there. What's on your mind today?",
      ],
      suggestions: ["I'm feeling stressed", "I need a study tip", "Just checking in"],
    },
    {
      pattern: /\b(stress|stressed|anxious|anxiety|overwhelmed|panic)\b/i,
      replies: [
        "That sounds like a lot to carry. Want to try a 60-second breathing reset together, or talk through what's causing it?",
        "Stress like that is exhausting. Is it mostly school-related, or something else too?",
      ],
      suggestions: ["Let's breathe", "It's mostly school", "It's something else"],
    },
    {
      pattern: /\b(sad|down|low|depress|lonely|empty)\b/i,
      replies: [
        "I hear you — that sounds heavy. You don't have to explain it perfectly, I'm just glad you said something.",
        "Thanks for sharing that with me. Has today felt like this the whole time, or did something in particular happen?",
      ],
      suggestions: ["It's been all day", "Something happened", "I'd rather not say"],
    },
    {
      pattern: /\b(sleep|tired|insomnia|can'?t sleep|exhausted)\b/i,
      replies: [
        "Sleep trouble makes everything else harder. Roughly how many hours did you get last night?",
        "Being tired affects mood and focus more than people realize. Want a couple of wind-down tips for tonight?",
      ],
      suggestions: ["Give me wind-down tips", "I got under 5 hours", "I sleep fine, just tired"],
    },
    {
      pattern: /\b(study|exam|homework|assignment|deadline|test)\b/i,
      replies: [
        "Academic pressure is real. Do you want help breaking the work into smaller chunks, or more of a motivation boost?",
        "Let's tackle it together — what's the actual deadline you're most worried about?",
      ],
      suggestions: ["Help me break it down", "I need motivation", "Deadline is today"],
    },
    {
      pattern: /\b(thank|thanks|thx|appreciate)\b/i,
      replies: ["Anytime — that's what I'm here for.", "Of course! I'm glad that helped."],
      suggestions: ["Log my mood", "Give me another tip", "That's all for now"],
    },
    {
      pattern: /\b(bye|goodbye|see you|talk later)\b/i,
      replies: ["Take care of yourself — I'll be right here when you're back.", "Bye for now. Come back anytime."],
      suggestions: ["I'm feeling stressed", "I need a study tip", "Just checking in"],
    },
  ];

  const FALLBACK_REPLIES = [
    "Tell me a little more about that?",
    "I want to understand — can you say more about what's going on?",
    "Got it. How is that affecting your day so far?",
  ];

  const DEFAULT_SUGGESTIONS = [
    "I'm feeling stressed",
    "Help me relax",
    "I need a study tip",
    "Just checking in",
  ];

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function matchRule(userText) {
    return RESPONSE_RULES.find(function (rule) {
      return rule.pattern.test(userText);
    });
  }

  function simulatedThinkingDelay() {
    const min = 400;
    const max = 900;
    return Math.floor(Math.random() * (max - min)) + min;
  }

  const localProvider = {
    generateReply(userText) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          const rule = matchRule(userText);
          if (rule) {
            resolve({ text: pickRandom(rule.replies), suggestions: rule.suggestions });
            return;
          }
          resolve({ text: pickRandom(FALLBACK_REPLIES), suggestions: DEFAULT_SUGGESTIONS });
        }, simulatedThinkingDelay());
      });
    },
  };

  // ---- OpenAI provider (ACTIVE) -------------------------------------------
  const openaiProvider = {
    /**
     * @param {string} userText
     * @param {Array<{sender:'user'|'bloom', text:string}>} history
     * @returns {Promise<{text:string, suggestions:string[]}>}
     */
    async generateReply(userText, history) {
      if (BACKEND_URL.indexOf("YOUR-PROJECT-NAME") !== -1) {
        // Not deployed/configured yet — fall back locally instead of
        // throwing, so the chat still works during setup.
        console.warn("PromptManager: BACKEND_URL is still a placeholder. Falling back to localProvider. See prompt-manager.js.");
        return localProvider.generateReply(userText, history);
      }

      const messages = (history || [])
        .slice(-12) // keep the request small; recent context is what matters most
        .map(function (message) {
          return {
            role: message.sender === "user" ? "user" : "assistant",
            content: message.text,
          };
        });

      messages.push({ role: "user", content: userText });

      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messages }),
      });

      if (!response.ok) {
        throw new Error("Backend responded with status " + response.status);
      }

      const data = await response.json();
      return {
        text: data.text || "I'm here — could you say that again?",
        suggestions: Array.isArray(data.suggestions) && data.suggestions.length > 0
          ? data.suggestions
          : DEFAULT_SUGGESTIONS,
      };
    },
  };

  // ---- Gemini provider (STUBBED — kept as a future option) ----------------
  const geminiProvider = {
    generateReply() {
      return Promise.reject(
        new Error("geminiProvider is not implemented — set ACTIVE_PROVIDER to \"openai\" or \"local\".")
      );
    },
  };

  const providers = { openai: openaiProvider, local: localProvider, gemini: geminiProvider };

  const PromptManager = {
    /**
     * @param {string} userText
     * @param {Array} history
     * @returns {Promise<{text:string, suggestions:string[]}>}
     */
    async generateReply(userText, history) {
      if (isCrisisMessage(userText)) {
        return crisisResponse();
      }

      const provider = providers[ACTIVE_PROVIDER] || localProvider;

      try {
        return await provider.generateReply(userText, history || []);
      } catch (err) {
        // Network hiccup, backend down, quota hit, etc. — degrade to the
        // offline provider rather than leaving the user with a dead chat.
        console.error("PromptManager: active provider failed, falling back to localProvider.", err);
        return localProvider.generateReply(userText, history || []);
      }
    },

    /** Suggestion chips shown before the user has typed anything. */
    getStarterSuggestions() {
      return DEFAULT_SUGGESTIONS.slice();
    },

    /** Text of Bloom's very first message in a brand-new conversation. */
    getWelcomeMessage() {
      return "Hi, I'm Bloom. I'm here for check-ins, study stress, sleep, mood — whatever's on your mind. What's going on today?";
    },
  };

  window.PromptManager = PromptManager;
})(window);

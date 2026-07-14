/* ==========================================================================
   MindBloom — reflection.js
   Generates the writing prompt shown before a new entry, and a short
   reflective comment shown after one is saved. Same swap-ready pattern as
   emotion-analysis.js and the chat module's prompt-manager.js:

     - localReflector  (ACTIVE TODAY) — curated prompt bank + rule-based
       comment templates keyed off the result of EmotionAnalysis.analyze().

     - geminiReflector (STUBBED, NOT ACTIVE) — same interface
       (getPrompt() / getReflection(analysis, entryText, recentEntries) ->
       Promise<string>). Flip ACTIVE_REFLECTOR to "gemini" once
       implemented; journal.js does not need to change.

   Design note: comments reflect back what was detected rather than
   inventing a cause ("that sounds heavy" not "this is because of your
   exams") — journal.js only passes in the analysis object and entry text,
   nothing is guessed beyond that.
   ========================================================================== */

(function (window) {
  "use strict";

  // ---- Reflector switch --------------------------------------------------
  const ACTIVE_REFLECTOR = "local";

  const PROMPT_BANK = [
    "What's one thing that went well today?",
    "What's weighing on you most right now?",
    "Describe a moment today you'd like to remember.",
    "What's something you're looking forward to?",
    "What drained your energy today, and what gave you energy?",
    "If today had a title, what would it be?",
    "What's one thing you'd tell a friend who had your day?",
    "What's a small win you almost didn't notice?",
    "How does your body feel right now?",
    "What do you need more of this week?",
  ];

  let lastPromptIndex = -1;

  function pickPromptIndex() {
    if (PROMPT_BANK.length === 1) return 0;
    let index = Math.floor(Math.random() * PROMPT_BANK.length);
    while (index === lastPromptIndex) {
      index = Math.floor(Math.random() * PROMPT_BANK.length);
    }
    return index;
  }

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // ---- Comment templates, keyed to the labels EmotionAnalysis.analyze()
  // actually returns (joy, gratitude, calm, neutral, sadness, stress,
  // anger, fear). "crisis" is handled separately, never through here.
  const COMMENT_TEMPLATES = {
    joy: [
      "This energy is great to read. What do you think contributed to it?",
      "Worth remembering what made today feel this way.",
    ],
    gratitude: [
      "Noticing what you're grateful for is its own kind of rest. Nice entry.",
      "That's a good thing to hold onto — thanks for writing it down.",
    ],
    calm: [
      "There's a steadiness in what you wrote — that's worth noticing.",
      "Sounds like a grounded moment today. What helped get you there?",
    ],
    sadness: [
      "That sounds heavy. Thank you for putting it into words instead of carrying it silently.",
      "It's okay for today to have felt like this. Be gentle with yourself tonight.",
    ],
    stress: [
      "Sounds like a lot is on your plate right now. Writing it down is already a step toward carrying it lighter.",
      "That pressure sounds real. Is there one piece of it you could set down today, even briefly?",
    ],
    anger: [
      "That frustration comes through clearly — it makes sense to feel that way.",
      "Sounds like something didn't go the way you needed it to. That's worth naming.",
    ],
    fear: [
      "That uncertainty sounds uncomfortable to sit with. Naming it is a real first step.",
      "It makes sense to feel unsettled by that. You don't have to have it figured out yet.",
    ],
    neutral: [
      "Thanks for checking in today — even a short note is a habit worth keeping.",
      "Noted. Some days are just days, and that's fine too.",
    ],
  };

  // Extra line appended when the same theme has shown up repeatedly this week —
  // purely pattern-reflecting, never a diagnosis or invented cause.
  function themeFrequencyNote(themes, recentEntries) {
    if (!themes || themes.length === 0 || !recentEntries || recentEntries.length === 0) {
      return "";
    }
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentThemed = recentEntries.filter(function (entry) {
      return new Date(entry.createdAt).getTime() >= oneWeekAgo;
    });

    for (let i = 0; i < themes.length; i++) {
      const theme = themes[i];
      const count = recentThemed.filter(function (entry) {
        return (entry.themes || []).indexOf(theme) !== -1;
      }).length;

      if (count >= 3) {
        return " This is the " + (count + 1) + "th time " + theme + " has come up this week — it might be worth sitting with that.";
      }
    }
    return "";
  }

  const CRISIS_REFLECTION =
    "Thank you for writing this down. What you're describing matters, and I want you to have real support, not just this journal. " +
    "If you're in the US, you can call or text 988 (Suicide & Crisis Lifeline) anytime, or text HOME to 741741. " +
    "If you're elsewhere, please look up your local crisis line, or reach out to someone you trust today.";

  const localReflector = {
    /** @returns {Promise<string>} */
    getPrompt() {
      return new Promise(function (resolve) {
        const index = pickPromptIndex();
        lastPromptIndex = index;
        resolve(PROMPT_BANK[index]);
      });
    },

    /**
     * @param {{label:string, themes:string[], isCrisis:boolean}} analysis
     * @param {string} entryText
     * @param {Array} recentEntries - prior entries, for light pattern-noticing
     * @returns {Promise<string>}
     */
    getReflection(analysis, entryText, recentEntries) {
      return new Promise(function (resolve) {
        if (analysis && analysis.isCrisis) {
          resolve(CRISIS_REFLECTION);
          return;
        }

        const label = (analysis && analysis.label) || "neutral";
        const templates = COMMENT_TEMPLATES[label] || COMMENT_TEMPLATES.neutral;
        const base = pickRandom(templates);
        const note = themeFrequencyNote(analysis && analysis.themes, recentEntries);
        resolve(base + note);
      });
    },
  };

  // ---- Gemini reflector (STUBBED — not called while ACTIVE_REFLECTOR is "local") ----
  const geminiReflector = {
    /**
     * Future implementation sketch (left unimplemented on purpose):
     *
     *   async getPrompt(recentEntries) {
     *     const response = await fetch(GEMINI_ENDPOINT, {
     *       method: "POST",
     *       body: JSON.stringify({ prompt: buildPersonalizedPromptRequest(recentEntries) }),
     *     });
     *     const data = await response.json();
     *     return data.prompt;
     *   }
     *
     *   async getReflection(analysis, entryText, recentEntries) {
     *     const response = await fetch(GEMINI_ENDPOINT, {
     *       method: "POST",
     *       body: JSON.stringify({ prompt: buildReflectionRequest(analysis, entryText, recentEntries) }),
     *     });
     *     const data = await response.json();
     *     return data.reflection;
     *   }
     *
     * Both methods must keep resolving to a plain string so journal.js
     * doesn't need to change when this becomes active.
     */
    getPrompt() {
      return Promise.reject(
        new Error("geminiReflector is not implemented yet — set ACTIVE_REFLECTOR to \"local\".")
      );
    },
    getReflection() {
      return Promise.reject(
        new Error("geminiReflector is not implemented yet — set ACTIVE_REFLECTOR to \"local\".")
      );
    },
  };

  const reflectors = { local: localReflector, gemini: geminiReflector };

  const Reflection = {
    /** @returns {Promise<string>} a writing prompt */
    getPrompt() {
      const reflector = reflectors[ACTIVE_REFLECTOR] || localReflector;
      return reflector.getPrompt();
    },

    /**
     * @param {object} analysis - result from EmotionAnalysis.analyze
     * @param {string} entryText
     * @param {Array} recentEntries
     * @returns {Promise<string>} a short supportive reflection
     */
    getReflection(analysis, entryText, recentEntries) {
      const reflector = reflectors[ACTIVE_REFLECTOR] || localReflector;
      return reflector.getReflection(analysis, entryText, recentEntries || []);
    },
  };

  window.Reflection = Reflection;
})(window);

/* ==========================================================================
   MindBloom — emotion-analysis.js
   The AI abstraction layer for understanding journal text. Everything
   else calls EmotionAnalysis.analyze(text) and gets back a consistent
   shape regardless of which provider is doing the work underneath.

     - localAnalyzer  (ACTIVE TODAY) — keyword/theme matching, no network.
     - geminiAnalyzer (STUBBED)      — same interface, for richer sentiment
       and theme extraction once the Gemini API is connected. Flip
       ACTIVE_ANALYZER below when that implementation is filled in.
   ========================================================================== */

(function (window) {
  "use strict";

  // ---- Provider switch --------------------------------------------------
  const ACTIVE_ANALYZER = "local";

  // ---- Safety net: never let sentiment scoring alone handle crisis text.
  // If matched, analyze() short-circuits to a flagged result that
  // reflection.js checks for before generating any commentary.
  const CRISIS_PATTERNS = [
    /suicid/i,
    /kill myself/i,
    /want to die/i,
    /end my life/i,
    /self[\s-]?harm/i,
    /hurt myself/i,
  ];

  function isCrisisText(text) {
    return CRISIS_PATTERNS.some(function (pattern) {
      return pattern.test(text);
    });
  }

  // ---- Emotion keyword banks ---------------------------------------------
  const EMOTION_KEYWORDS = {
    joy: {
      words: ["happy", "excited", "great", "awesome", "wonderful", "glad", "fun", "proud", "amazing", "love"],
      emoji: "mood-great",
    },
    gratitude: {
      words: ["grateful", "thankful", "appreciate", "blessed", "lucky"],
      emoji: "mood-great",
    },
    calm: {
      words: ["calm", "peaceful", "relaxed", "content", "okay", "fine", "steady"],
      emoji: "mood-good",
    },
    sadness: {
      words: ["sad", "down", "lonely", "empty", "hurt", "cry", "crying", "upset", "hopeless", "disappointed"],
      emoji: "mood-low",
    },
    stress: {
      words: ["stressed", "overwhelmed", "anxious", "anxiety", "pressure", "panic", "worried", "exhausted", "burnout"],
      emoji: "mood-low",
    },
    anger: {
      words: ["angry", "mad", "furious", "annoyed", "frustrated", "irritated"],
      emoji: "mood-rough",
    },
    fear: {
      words: ["scared", "afraid", "nervous", "terrified", "fear", "uneasy"],
      emoji: "mood-rough",
    },
  };

  // ---- Theme keyword banks (used for tagging + reflection.js patterns) --
  const THEME_KEYWORDS = {
    academic: ["exam", "test", "homework", "assignment", "class", "school", "grade", "study", "studying", "deadline", "project"],
    friends: ["friend", "friends", "hangout", "party", "social"],
    family: ["family", "mom", "dad", "parents", "sibling", "brother", "sister"],
    sleep: ["sleep", "tired", "insomnia", "nap", "rest"],
    health: ["sick", "pain", "headache", "doctor", "health", "energy"],
    relationship: ["boyfriend", "girlfriend", "partner", "relationship", "breakup", "dating"],
    future: ["future", "college", "career", "uncertain", "worried about"],
  };

  function countMatches(text, words) {
    const lower = text.toLowerCase();
    return words.reduce(function (count, word) {
      const pattern = new RegExp("\\b" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
      return pattern.test(lower) ? count + 1 : count;
    }, 0);
  }

  function detectThemes(text) {
    const themes = [];
    Object.keys(THEME_KEYWORDS).forEach(function (theme) {
      if (countMatches(text, THEME_KEYWORDS[theme]) > 0) {
        themes.push(theme);
      }
    });
    return themes;
  }

  function detectEmotion(text) {
    let bestLabel = "neutral";
    let bestEmoji = "mood-okay";
    let bestCount = 0;

    Object.keys(EMOTION_KEYWORDS).forEach(function (label) {
      const count = countMatches(text, EMOTION_KEYWORDS[label].words);
      if (count > bestCount) {
        bestCount = count;
        bestLabel = label;
        bestEmoji = EMOTION_KEYWORDS[label].emoji;
      }
    });

    const score = bestCount === 0 ? 0.4 : Math.min(1, 0.5 + bestCount * 0.15);

    return { label: bestLabel, emoji: bestEmoji, score: score };
  }

  // ---- Local provider (ACTIVE) ------------------------------------------
  const localAnalyzer = {
    analyze(text) {
      return new Promise(function (resolve) {
        if (isCrisisText(text)) {
          resolve({
            label: "crisis",
            emoji: "heart",
            score: 1,
            themes: detectThemes(text),
            isCrisis: true,
          });
          return;
        }

        const emotion = detectEmotion(text);
        resolve({
          label: emotion.label,
          emoji: emotion.emoji,
          score: emotion.score,
          themes: detectThemes(text),
          isCrisis: false,
        });
      });
    },
  };

  // ---- Gemini provider (STUBBED — not called while ACTIVE_ANALYZER is "local") ----
  const geminiAnalyzer = {
    /**
     * Future implementation sketch (left unimplemented on purpose):
     *
     *   async analyze(text) {
     *     const response = await fetch(GEMINI_ENDPOINT, {
     *       method: "POST",
     *       body: JSON.stringify({ contents: buildSentimentPrompt(text) }),
     *     });
     *     const data = await response.json();
     *     return parseSentimentResponse(data); // must return the same
     *                                           // {label, emoji, score, themes, isCrisis} shape
     *   }
     */
    analyze() {
      return Promise.reject(
        new Error("geminiAnalyzer is not implemented yet — set ACTIVE_ANALYZER to \"local\".")
      );
    },
  };

  const analyzers = { local: localAnalyzer, gemini: geminiAnalyzer };

  const EmotionAnalysis = {
    /**
     * @param {string} text
     * @returns {Promise<{label:string, emoji:string, score:number, themes:string[], isCrisis:boolean}>}
     */
    analyze(text) {
      const analyzer = analyzers[ACTIVE_ANALYZER] || localAnalyzer;
      return analyzer.analyze(text || "");
    },

    /** Maps a sentiment label onto MindBloom's 5-point mood color scale. */
    mapToMoodBucket(label) {
      const map = {
        joy: "great",
        gratitude: "great",
        calm: "good",
        neutral: "okay",
        sadness: "low",
        stress: "low",
        anger: "rough",
        fear: "rough",
        crisis: "rough",
      };
      return map[label] || "okay";
    },
  };

  window.EmotionAnalysis = EmotionAnalysis;
})(window);

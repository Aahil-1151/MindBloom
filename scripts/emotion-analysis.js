/* ==========================================================================
   MindBloom — emotion-analysis.js
   A small, local, keyword-based emotion detector for journal text. Not a
   real NLP model — a lightweight signal Reflection (reflection.js) and
   the journal entry card use to pick a relevant response and tag, with
   zero network calls and nothing leaving the browser.
   ========================================================================== */

(function (window) {
  "use strict";

  const EMOTION_KEYWORDS = {
    stressed: [
      "stress", "stressed", "stressful", "overwhelmed", "overwhelming", "anxious",
      "anxiety", "panic", "pressure", "deadline", "deadlines", "can't keep up",
      "too much",
    ],
    sad: [
      "sad", "down", "depressed", "upset", "cry", "crying", "lonely", "hopeless",
      "empty", "miss", "hurt", "heartbroken",
    ],
    angry: ["angry", "mad", "frustrated", "annoyed", "furious", "irritated", "pissed"],
    tired: [
      "tired", "exhausted", "drained", "sleepy", "burnt out", "burned out",
      "no energy", "can't focus",
    ],
    happy: [
      "happy", "great", "excited", "proud", "grateful", "accomplished", "amazing",
      "wonderful", "good day", "relieved",
    ],
    calm: ["calm", "relaxed", "peaceful", "content", "fine", "steady", "okay day"],
  };

  /**
   * @param {string} text
   * @returns {{emotion:string, confidence:number}} confidence is just the
   *   raw keyword hit count for the winning emotion — a rough signal, not
   *   a calibrated probability.
   */
  function analyze(text) {
    const lower = (text || "").toLowerCase();
    let best = "neutral";
    let bestScore = 0;

    Object.keys(EMOTION_KEYWORDS).forEach(function (emotion) {
      const score = EMOTION_KEYWORDS[emotion].reduce(function (count, phrase) {
        return count + (lower.indexOf(phrase) !== -1 ? 1 : 0);
      }, 0);
      if (score > bestScore) {
        best = emotion;
        bestScore = score;
      }
    });

    return { emotion: best, confidence: bestScore };
  }

  window.EmotionAnalysis = { analyze: analyze, EMOTION_KEYWORDS: EMOTION_KEYWORDS };
})(window);

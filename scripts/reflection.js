/* ==========================================================================
   MindBloom — reflection.js
   Generates the short "Bloom" reflection line shown under a saved journal
   entry (see .journal-reflection in journal.css). Picks from a small
   supportive-response bank keyed by the emotion emotion-analysis.js
   detected in the entry text — canned copy, not a live model, but tuned
   to feel specific rather than generic.
   ========================================================================== */

(function (window) {
  "use strict";

  const REFLECTIONS = {
    stressed: [
      "That sounds like a lot to carry right now. What's one thing you could set down today, even briefly?",
      "Deadlines have a way of piling up in your head more than on paper — try listing them out and picking just the next one.",
      "It's okay to not have it all handled. A short break before you go back in might help more than pushing through.",
    ],
    sad: [
      "Thank you for putting this into words — that takes something. Be gentle with yourself today.",
      "Some days are just heavier, and that's allowed. You don't have to fix it right now, just notice it.",
      "If this feeling sticks around, it might help to talk it through with someone you trust.",
    ],
    angry: [
      "That frustration makes sense given what you described. Naming it here is a good first step.",
      "Strong feelings like this usually pass faster once they're actually acknowledged instead of pushed down.",
    ],
    tired: [
      "Running on empty affects everything else — mood, focus, patience. What would actual rest look like tonight?",
      "Exhaustion is information, not weakness. Worth checking your sleep log to see if a pattern is forming.",
    ],
    happy: [
      "This is a nice one to look back on later — glad today had this in it.",
      "Worth noticing what led to this feeling, so you can point yourself back toward it on harder days.",
    ],
    calm: [
      "Steady days like this are worth just as much as the big ones. Good to have it on record.",
      "Nothing to fix here — just a good moment to have written down.",
    ],
    neutral: [
      "Thanks for taking a moment to check in with yourself today.",
      "Noted — small entries like this add up to a clearer picture over time.",
      "Every entry helps build a more honest picture of how you're actually doing.",
    ],
  };

  /**
   * @param {string} text - the raw entry (unused directly today, kept in
   *   the signature so a future, smarter version can consider it)
   * @param {{emotion:string}} analysis - result of EmotionAnalysis.analyze()
   * @returns {string}
   */
  function generate(text, analysis) {
    const key = analysis && REFLECTIONS[analysis.emotion] ? analysis.emotion : "neutral";
    const options = REFLECTIONS[key];
    return options[Math.floor(Math.random() * options.length)];
  }

  window.Reflection = { generate: generate };
})(window);

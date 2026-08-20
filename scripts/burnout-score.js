/* ==========================================================================
   MindBloom — burnout-score.js
   Computes a 0-100 burnout risk score from cross-pillar signals. Same
   swap-ready pattern used across the app's AI-adjacent modules:

     - localEngine  (ACTIVE TODAY) — deterministic weighted formula.
     - geminiEngine (STUBBED)      — same interface, for a model that can
       reason over the raw history instead of pre-aggregated averages
       (e.g. noticing a sharp decline rather than just a low average).
       Flip ACTIVE_ENGINE to "gemini" once implemented; analytics.js does
       not need to change.
   ========================================================================== */

(function (window) {
  "use strict";

  // ---- Provider switch ----------------------------------------------------
  const ACTIVE_ENGINE = "local";

  /**
   * @typedef {object} BurnoutSignals
   * @property {number} avgWorkloadMinutesPerDay
   * @property {number} avgMoodScore        - 1 (rough) to 5 (great)
   * @property {number} avgSleepHours
   * @property {number} negativeEntryRatio  - 0 to 1, share of journal/mood entries that were stress/sad/anger/fear
   * @property {number} overdueTaskCount
   */

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function riskLevel(score) {
    if (score >= 70) return "high";
    if (score >= 40) return "moderate";
    return "low";
  }

  function riskMessage(level) {
    if (level === "high") {
      return "Several signals are stacking up. This is a good week to lighten the load where you can.";
    }
    if (level === "moderate") {
      return "Some pressure is building. Keeping an eye on rest and workload now can prevent it from growing.";
    }
    return "Things look manageable right now. Keep doing what's working.";
  }

  // ---- Local engine (ACTIVE) ----------------------------------------------
  const localEngine = {
    /**
     * @param {BurnoutSignals} signals
     * @returns {{score:number, level:string, message:string, factors:string[]}}
     */
    computeScore(signals) {
      const factors = [];
      let score = 0;

      // Workload: >180 min/day sustained load contributes heavily
      const workloadPoints = clamp(((signals.avgWorkloadMinutesPerDay || 0) - 60) / 3, 0, 30);
      score += workloadPoints;
      if (workloadPoints > 15) factors.push("Heavier-than-usual academic workload");

      // Mood: lower average mood contributes
      const moodDeficit = clamp(5 - (signals.avgMoodScore || 3.5), 0, 4);
      const moodPoints = moodDeficit * 7.5; // max 30
      score += moodPoints;
      if (moodPoints > 15) factors.push("Mood has been trending lower");

      // Sleep: under 7 hours contributes
      const sleepDeficit = clamp(7 - (signals.avgSleepHours || 7), 0, 4);
      const sleepPoints = sleepDeficit * 5; // max 20
      score += sleepPoints;
      if (sleepPoints > 10) factors.push("Sleep has been below target");

      // Negative journal/mood ratio
      const negativePoints = clamp((signals.negativeEntryRatio || 0) * 15, 0, 15);
      score += negativePoints;
      if (negativePoints > 8) factors.push("Frequent stress or low-mood entries");

      // Overdue tasks
      const overduePoints = clamp((signals.overdueTaskCount || 0) * 2.5, 0, 5);
      score += overduePoints;
      if (overduePoints >= 5) factors.push("Overdue tasks piling up");

      const finalScore = Math.round(clamp(score, 0, 100));
      const level = riskLevel(finalScore);

      return {
        score: finalScore,
        level: level,
        message: riskMessage(level),
        factors: factors.length > 0 ? factors : ["No major risk factors detected"],
      };
    },
  };

  // ---- Gemini engine (STUBBED — not called while ACTIVE_ENGINE is "local") ----
  const geminiEngine = {
    /**
     * Future implementation sketch (left unimplemented on purpose):
     *
     *   async computeScore(rawHistory) {
     *     // rawHistory could be the full unaggregated mood/sleep/task
     *     // history instead of pre-computed averages, letting the model
     *     // notice trajectory (declining vs. stable-but-low) rather than
     *     // just a flat average.
     *     const response = await fetch(GEMINI_ENDPOINT, {
     *       method: "POST",
     *       body: JSON.stringify({ history: rawHistory }),
     *     });
     *     const data = await response.json();
     *     return { score: data.score, level: data.level, message: data.message, factors: data.factors };
     *   }
     */
    computeScore() {
      throw new Error("geminiEngine is not implemented yet — set ACTIVE_ENGINE to \"local\".");
    },
  };

  const engines = { local: localEngine, gemini: geminiEngine };

  const BurnoutScore = {
    /**
     * @param {BurnoutSignals} signals
     * @returns {{score:number, level:string, message:string, factors:string[]}}
     */
    computeScore(signals) {
      const engine = engines[ACTIVE_ENGINE] || localEngine;
      return engine.computeScore(signals);
    },

    /** Color token name matching MindBloom's design system for a given level. */
    getLevelColorVar(level) {
      if (level === "high") return "--color-coral-500";
      if (level === "moderate") return "--color-gold-500";
      return "--color-bloom-500";
    },

    /**
     * Direction-over-time on top of computeScore's snapshot: given a
     * series of past scores (oldest first, same engine/signals each
     * time), describes whether risk is climbing, easing, or holding
     * steady. Pure function — no storage or DOM access, same as
     * computeScore, so any caller (analytics.js's weekly trend,
     * dashboard.js's chip) can feed it whatever window of scores it computed.
     * @param {number[]} scores - oldest to newest
     * @returns {{direction:"up"|"down"|"flat", delta:number, message:string}}
     */
    describeTrend(scores) {
      if (!scores || scores.length < 2) {
        return { direction: "flat", delta: 0, message: "Not enough history yet to show a trend." };
      }

      const first = scores[0];
      const last = scores[scores.length - 1];
      const delta = last - first;
      const periods = scores.length - 1;
      const periodLabel = periods === 1 ? "week" : periods + " weeks";

      if (Math.abs(delta) < 5) {
        return {
          direction: "flat",
          delta: delta,
          message: "Burnout risk has held steady over the last " + periodLabel + ".",
        };
      }

      if (delta > 0) {
        return {
          direction: "up",
          delta: delta,
          message: "Risk has climbed " + Math.round(delta) + " pts over the last " + periodLabel + " — worth keeping an eye on.",
        };
      }

      return {
        direction: "down",
        delta: delta,
        message: "Risk has eased " + Math.round(Math.abs(delta)) + " pts over the last " + periodLabel + " — whatever you're doing is working.",
      };
    },
  };

  window.BurnoutScore = BurnoutScore;
})(window);

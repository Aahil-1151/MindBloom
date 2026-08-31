/* ==========================================================================
   MindBloom — burnout-score.js
   Computes a 0-100 burnout risk score from cross-pillar signals. Same
   swap-ready pattern used across the app's AI-adjacent modules:

     - localEngine  — deterministic weighted formula. Instant, no network,
       always available. computeScore() (sync) always uses this one —
       callers that just need a fast, free number (e.g. the 4-week trend
       history, which would otherwise mean 4 separate AI calls) call it
       directly and are unaffected by anything below.

     - geminiEngine — calls api/analyze.js (real OpenAI reasoning over the
       student's raw day-by-day history, not just averages, so it can
       notice e.g. a sleep decline landing the same week as a workload
       spike). computeScoreAsync() below tries this first when a caller
       hands it rawHistory, and falls back to localEngine silently — same
       score/level/message/factors shape either way — on any failure
       (network, missing key, bad response), so a flaky or undeployed
       endpoint never surfaces an error to the student.
   ========================================================================== */

(function (window) {
  "use strict";

  // ---- Provider switch (computeScoreAsync only — see above) ---------------
  const ACTIVE_ENGINE = "gemini";

  // Must be a full https:// URL, not a relative path — same reasoning as
  // prompt-manager.js's BACKEND_URL: this file runs both in a browser tab
  // and (later) inside an app wrapper with no fixed origin.
  const ANALYZE_ENDPOINT = "https://mind-bloom-kp7y.vercel.app/api/analyze";

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

  // ---- Gemini engine (api/analyze.js) -------------------------------------
  const geminiEngine = {
    /**
     * @param {object} rawHistory - day-by-day mood/sleep/stress/task data
     *   plus recent journal text; shape is caller-defined (analytics.js and
     *   dashboard.js each build their own from the data they already have)
     *   and passed straight through as the request payload.
     * @returns {Promise<{score:number, level:string, message:string, factors:string[]}>}
     */
    async computeScore(rawHistory) {
      const response = await fetch(ANALYZE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "burnout", payload: rawHistory }),
      });

      if (!response.ok) {
        throw new Error("api/analyze.js responded with status " + response.status);
      }

      const data = await response.json();
      const score = Number.isFinite(data.score) ? clamp(Math.round(data.score), 0, 100) : 0;
      const level = ["low", "moderate", "high"].indexOf(data.level) !== -1 ? data.level : riskLevel(score);

      return {
        score: score,
        level: level,
        message: data.reasoning || riskMessage(level),
        factors: data.suggestedAction ? [data.suggestedAction] : ["No major risk factors detected"],
      };
    },
  };

  const engines = { local: localEngine, gemini: geminiEngine };

  const BurnoutScore = {
    /**
     * Fast, free, network-free — always the deterministic formula. Use
     * this when you need an instant result or would otherwise trigger
     * several calls back-to-back (see the trend history above).
     * @param {BurnoutSignals} signals
     * @returns {{score:number, level:string, message:string, factors:string[]}}
     */
    computeScore(signals) {
      return localEngine.computeScore(signals);
    },

    /**
     * The upgraded path: real AI reasoning over rawHistory when it's
     * provided, silently falling back to the same local formula
     * computeScore() uses on any failure — network down, endpoint not
     * deployed, bad response — so the caller never has to handle an
     * error case differently from a slow-but-successful one.
     * @param {BurnoutSignals} signals - always required, used for the fallback
     * @param {object} [rawHistory] - omit to skip straight to local (e.g. no real history yet)
     * @returns {Promise<{score:number, level:string, message:string, factors:string[]}>}
     */
    async computeScoreAsync(signals, rawHistory) {
      const engine = engines[ACTIVE_ENGINE] || localEngine;
      if (engine === localEngine || !rawHistory) {
        return localEngine.computeScore(signals);
      }
      try {
        return await engine.computeScore(rawHistory);
      } catch (err) {
        console.error("BurnoutScore: " + ACTIVE_ENGINE + " engine failed, falling back to local.", err);
        return localEngine.computeScore(signals);
      }
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

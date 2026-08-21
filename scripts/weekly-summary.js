/* ==========================================================================
   MindBloom — weekly-summary.js
   Turns a week of analytics data into a short natural-language summary.
   Same swap-ready pattern as prompt-manager.js / reflection.js:

     - localSummarizer  — template-based, filled in from computed trends.
       No network call, resolves via Promise for interface parity with
       the AI provider. generate() below falls back to this on any
       failure, so an undeployed or flaky api/analyze.js never surfaces
       an error — the summary card just quietly stays template-based.

     - geminiSummarizer — calls api/analyze.js with the week's raw
       journal entries and day-by-day logs (not just the pre-computed
       averages localSummarizer works from), so the write-up can
       reference actual specifics from what the student wrote.
   ========================================================================== */

(function (window) {
  "use strict";

  // ---- Provider switch (generate() falls back to local on failure) -------
  const ACTIVE_SUMMARIZER = "gemini";

  // Full https:// URL for the same reason as burnout-score.js's
  // ANALYZE_ENDPOINT / prompt-manager.js's BACKEND_URL.
  const ANALYZE_ENDPOINT = "https://mind-bloom-kp7y.vercel.app/api/analyze";

  function describeMoodTrend(first, last) {
    const diff = last - first;
    if (diff >= 0.5) return "trending upward";
    if (diff <= -0.5) return "trending a bit lower";
    return "holding fairly steady";
  }

  function describeSleep(avgHours) {
    if (avgHours >= 7.5) return "You've been getting solid sleep";
    if (avgHours >= 6.5) return "Sleep has been a little under target";
    return "Sleep has been noticeably short";
  }

  function describeTasks(completionRate) {
    if (completionRate >= 0.8) return "you're on top of your workload";
    if (completionRate >= 0.5) return "you're keeping pace with most of it";
    return "quite a few tasks are still open";
  }

  function describeBurnout(level) {
    if (level === "high") return "a few signals suggest you're running low right now";
    if (level === "moderate") return "some pressure is building, worth watching";
    return "your overall balance looks healthy";
  }

  // ---- Local provider (ACTIVE) -------------------------------------------
  const localSummarizer = {
    /**
     * @param {{
     *   periodLabel:string, moodFirst:number, moodLast:number,
     *   avgSleepHours:number, taskCompletionRate:number,
     *   burnoutLevel:string, consistencyPercent:number, topTheme:string|null
     * }} bundle
     * @returns {Promise<string>}
     */
    generate(bundle) {
      return new Promise(function (resolve) {
        const moodTrend = describeMoodTrend(bundle.moodFirst, bundle.moodLast);
        const sleepLine = describeSleep(bundle.avgSleepHours);
        const taskLine = describeTasks(bundle.taskCompletionRate);
        const burnoutLine = describeBurnout(bundle.burnoutLevel);

        let summary =
          "Over the last " + bundle.periodLabel + ", your mood has been " + moodTrend + ". " +
          sleepLine + ", and " + taskLine + ". Overall, " + burnoutLine + ".";

        if (bundle.consistencyPercent >= 70) {
          summary += " You've also been checking in consistently — that habit is doing real work.";
        } else if (bundle.consistencyPercent <= 30) {
          summary += " You haven't been checking in as often lately — even a quick daily note helps spot patterns sooner.";
        }

        if (bundle.topTheme) {
          summary += " " + capitalize(bundle.topTheme) + " has come up as a recurring theme in your entries.";
        }

        resolve(summary);
      });
    },
  };

  function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  // ---- Gemini provider (api/analyze.js) -----------------------------------
  const geminiSummarizer = {
    /**
     * @param {object} bundle - localSummarizer's fields (for reference) plus
     *   bundle.rawHistory: { days: [...], journalEntries: [...] } — the
     *   caller's own raw week of data, same idea as burnout-score.js's
     *   rawHistory but for the AI is asked to write a summary, not score.
     * @returns {Promise<string>}
     */
    async generate(bundle) {
      const response = await fetch(ANALYZE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "summary",
          payload: {
            periodLabel: bundle.periodLabel,
            avgSleepHours: bundle.avgSleepHours,
            taskCompletionRate: bundle.taskCompletionRate,
            burnoutLevel: bundle.burnoutLevel,
            consistencyPercent: bundle.consistencyPercent,
            rawHistory: bundle.rawHistory,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("api/analyze.js responded with status " + response.status);
      }

      const data = await response.json();
      if (!data.summary) {
        throw new Error("api/analyze.js returned no summary text");
      }
      return data.summary;
    },
  };

  const summarizers = { local: localSummarizer, gemini: geminiSummarizer };

  const WeeklySummary = {
    /**
     * Tries the active summarizer (real AI reasoning when rawHistory is
     * provided) and falls back to the local template on any failure —
     * network down, endpoint not deployed, bad response — so the summary
     * card never shows an error, just quietly degrades to template text.
     * @param {object} bundle - see localSummarizer.generate for the required
     *   fields; include bundle.rawHistory to allow the AI path to run.
     * @returns {Promise<string>}
     */
    async generate(bundle) {
      if (ACTIVE_SUMMARIZER === "gemini" && bundle.rawHistory) {
        try {
          return await geminiSummarizer.generate(bundle);
        } catch (err) {
          console.error("WeeklySummary: gemini summarizer failed, falling back to local.", err);
          return localSummarizer.generate(bundle);
        }
      }
      return localSummarizer.generate(bundle);
    },
  };

  window.WeeklySummary = WeeklySummary;
})(window);

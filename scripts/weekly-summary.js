/* ==========================================================================
   MindBloom — weekly-summary.js
   Turns aggregated analytics data into a short natural-language summary.
   Same swap-ready pattern as prompt-manager.js / reflection.js:

     - localSummarizer  (ACTIVE TODAY) — template-based, filled in from
       computed trends. No network call, resolves via Promise for
       interface parity with the future provider.

     - geminiSummarizer (STUBBED)      — same interface, for genuinely
       generated prose once connected. Flip ACTIVE_SUMMARIZER to "gemini"
       when implemented; analytics.js does not need to change.
   ========================================================================== */

(function (window) {
  "use strict";

  const ACTIVE_SUMMARIZER = "local";

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

  // ---- Gemini provider (STUBBED — not called while ACTIVE_SUMMARIZER is "local") ----
  const geminiSummarizer = {
    /**
     * Future implementation sketch (left unimplemented on purpose):
     *
     *   async generate(bundle) {
     *     const response = await fetch(GEMINI_ENDPOINT, {
     *       method: "POST",
     *       body: JSON.stringify({ prompt: buildWeeklySummaryPrompt(bundle) }),
     *     });
     *     const data = await response.json();
     *     return data.summary; // must resolve to a plain string, same as localSummarizer
     *   }
     */
    generate() {
      return Promise.reject(
        new Error("geminiSummarizer is not implemented yet — set ACTIVE_SUMMARIZER to \"local\".")
      );
    },
  };

  const summarizers = { local: localSummarizer, gemini: geminiSummarizer };

  const WeeklySummary = {
    /**
     * @param {object} bundle - see localSummarizer.generate for shape
     * @returns {Promise<string>}
     */
    generate(bundle) {
      const summarizer = summarizers[ACTIVE_SUMMARIZER] || localSummarizer;
      return summarizer.generate(bundle);
    },
  };

  window.WeeklySummary = WeeklySummary;
})(window);

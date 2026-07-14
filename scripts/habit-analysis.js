/* ==========================================================================
   MindBloom — habit-analysis.js
   Pure statistics module: turns a list of "activity happened on this date"
   entries into streaks, consistency percentage, and a day-of-week
   breakdown. No storage access, no DOM access — takes dates in, returns
   numbers out, so it's easy to feed from any data source (journal entries,
   mood logs, task completions) and easy to unit test.
   ========================================================================== */

(function (window) {
  "use strict";

  const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const toDateKey = window.MindBloomUtils.toDateKey;

  function uniqueSortedDates(dateStrings) {
    const unique = Array.from(new Set(dateStrings.map(toDateKey)));
    return unique.sort(function (a, b) {
      return new Date(a) - new Date(b);
    });
  }

  function dayDiff(a, b) {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.round((new Date(b) - new Date(a)) / msPerDay);
  }

  const HabitAnalysis = {
    /**
     * @param {Array<string|Date>} activityDates - one entry per day something was logged
     * @returns {number} the current consecutive-day streak, counting back from today
     */
    getCurrentStreak(activityDates) {
      const dates = uniqueSortedDates(activityDates);
      if (dates.length === 0) return 0;

      const todayKey = toDateKey(new Date());
      const dateSet = new Set(dates);

      let streak = 0;
      let cursor = new Date(todayKey + "T00:00:00");

      // Today doesn't have to be logged yet for the streak to still count
      // up through yesterday — but if today IS logged, include it.
      if (!dateSet.has(toDateKey(cursor))) {
        cursor.setDate(cursor.getDate() - 1);
      }

      while (dateSet.has(toDateKey(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }

      return streak;
    },

    /**
     * @param {Array<string|Date>} activityDates
     * @returns {number} the longest consecutive-day streak in the dataset
     */
    getLongestStreak(activityDates) {
      const dates = uniqueSortedDates(activityDates);
      if (dates.length === 0) return 0;

      let longest = 1;
      let current = 1;

      for (let i = 1; i < dates.length; i++) {
        if (dayDiff(dates[i - 1], dates[i]) === 1) {
          current++;
          longest = Math.max(longest, current);
        } else {
          current = 1;
        }
      }

      return longest;
    },

    /**
     * @param {Array<string|Date>} activityDates
     * @param {number} periodDays - the window size to measure against (7/30/90)
     * @returns {number} percentage (0-100) of days in the period that had activity
     */
    getConsistencyPercent(activityDates, periodDays) {
      const dates = uniqueSortedDates(activityDates);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - periodDays);

      const inWindow = dates.filter(function (d) {
        return new Date(d) >= cutoff;
      });

      return Math.round((inWindow.length / periodDays) * 100);
    },

    /**
     * @param {Array<string|Date>} activityDates
     * @returns {{labels:string[], counts:number[]}} activity count per weekday (Sun-Sat)
     */
    getByWeekday(activityDates) {
      const counts = [0, 0, 0, 0, 0, 0, 0];
      activityDates.forEach(function (value) {
        const date = value instanceof Date ? value : new Date(value);
        counts[date.getDay()]++;
      });
      return { labels: WEEKDAY_LABELS.slice(), counts: counts };
    },

    /**
     * Convenience bundle combining all of the above for a given period.
     * @param {Array<string|Date>} activityDates
     * @param {number} periodDays
     */
    analyze(activityDates, periodDays) {
      return {
        currentStreak: this.getCurrentStreak(activityDates),
        longestStreak: this.getLongestStreak(activityDates),
        consistencyPercent: this.getConsistencyPercent(activityDates, periodDays),
        weekday: this.getByWeekday(activityDates),
      };
    },
  };

  window.HabitAnalysis = HabitAnalysis;
})(window);

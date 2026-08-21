/* ==========================================================================
   MindBloom — milestones.js
   Unlockable milestones tied to real logged behavior, not app-usage
   grinding — each one's check() reads only MindBloomData.load()'s record
   (plus XPEngine.computeLevel for the one level-based milestone), the
   same "pure function over the record" shape as burnout-score.js/
   priority-engine.js/habit-analysis.js.

   A milestone's check() is a live snapshot and can go false again later
   (e.g. overdue tasks pile back up) — once earned, it stays earned.
   core/data-store.js's KEYS.unlockedMilestones is the permanent record
   of that; evaluate() below treats "already unlocked" and "currently
   true" as equally earned so a milestone never quietly un-unlocks.
   Tone throughout is encouraging: locked entries show what to do next,
   never a countdown or "you're behind" framing.
   ========================================================================== */

(function (window) {
  "use strict";

  function daysBetween(a, b) {
    return Math.abs(a - b) / 86400000;
  }

  /**
   * @typedef {object} MilestoneDef
   * @property {string} id
   * @property {string} title
   * @property {string} description - shown once earned
   * @property {string} hint - shown while locked; what to do next
   * @property {(record: object) => boolean} check
   */

  /** @type {MilestoneDef[]} */
  const MILESTONES = [
    {
      id: "sleep-week",
      title: "Sleep, Tracked",
      description: "Logged sleep seven days in a row.",
      hint: "Log your sleep 7 days in a row to unlock this.",
      check(record) {
        const sleepDates = record.physicalLogs
          .filter(function (p) { return typeof p.sleepHours === "number"; })
          .map(function (p) { return p.timestamp; });
        return HabitAnalysis.getCurrentStreak(sleepDates) >= 7;
      },
    },
    {
      id: "journal-five",
      title: "Five Entries In",
      description: "Wrote five journal entries.",
      hint: "Write 5 journal entries to unlock this.",
      check(record) {
        return record.journalEntries.length >= 5;
      },
    },
    {
      id: "showed-up-anyway",
      title: "Showed Up Anyway",
      description: "Journaled through a hard moment instead of skipping it.",
      hint: "Bloom's here for the hard days too — journal on one of them.",
      check(record) {
        const hardEmotions = ["stressed", "sad", "angry", "tired"];
        return record.journalEntries.some(function (e) {
          return hardEmotions.indexOf(e.emotion) !== -1;
        });
      },
    },
    {
      id: "weathered-the-storm",
      title: "Weathered the Storm",
      description: "Kept checking in through a genuinely stressful week.",
      hint: "Keep logging your stress level, even on the rough days.",
      check(record) {
        const highStress = record.stressLogs
          .filter(function (s) { return s.level >= 4; })
          .map(function (s) { return new Date(s.timestamp).getTime(); })
          .sort(function (a, b) { return a - b; });
        if (highStress.length < 3) return false;
        for (let i = 0; i <= highStress.length - 3; i++) {
          if (daysBetween(highStress[i], highStress[i + 2]) <= 7) return true;
        }
        return false;
      },
    },
    {
      id: "on-top-of-it",
      title: "On Top of Things",
      description: "Cleared every overdue task on your list.",
      hint: "Clear your overdue tasks in Planner to unlock this.",
      check(record) {
        const todayKey = new Date().toISOString().slice(0, 10);
        const overdue = record.upcomingTasks.filter(function (t) {
          return !t.done && t.due && t.due < todayKey;
        }).length;
        return record.upcomingTasks.length >= 5 && overdue === 0;
      },
    },
    {
      id: "safety-net",
      title: "Built a Safety Net",
      description: "Added a trusted contact for when things get hard.",
      hint: "Add a trusted contact on the Emergency page.",
      check(record) {
        return record.trustedContacts.length >= 1;
      },
    },
    {
      id: "hour-of-focus",
      title: "An Hour of Focus",
      description: "Logged a full hour of focus sessions.",
      hint: "Complete focus sessions in Planner totaling an hour.",
      check(record) {
        const totalMinutes = record.focusSessions.reduce(function (sum, s) {
          return sum + (s.durationMinutes || 0);
        }, 0);
        return totalMinutes >= 60;
      },
    },
    {
      id: "level-three",
      title: "Leveling Up",
      description: "Reached Level 3 from consistent real check-ins.",
      hint: "Keep logging — reach Level 3 to unlock this.",
      check(record) {
        const totalXp = record.xpLog.reduce(function (sum, e) { return sum + (e.amount || 0); }, 0);
        return XPEngine.computeLevel(totalXp).level >= 3;
      },
    },
  ];

  function isAlreadyUnlocked(record, id) {
    return record.unlockedMilestones.indexOf(id) !== -1;
  }

  const Milestones = {
    /**
     * Full list for display (e.g. analytics.html), earned and locked
     * alike — earned() is permanent (already-unlocked OR live check),
     * so a milestone never quietly disappears again.
     * @param {object} record
     * @returns {Array<MilestoneDef & {earned:boolean}>}
     */
    evaluate(record) {
      return MILESTONES.map(function (m) {
        return {
          id: m.id,
          title: m.title,
          description: m.description,
          hint: m.hint,
          earned: isAlreadyUnlocked(record, m.id) || m.check(record),
        };
      });
    },

    /**
     * Milestones that are newly true this check and not yet recorded in
     * record.unlockedMilestones — what the caller should toast, then
     * persist via MindBloomData.markMilestoneUnlocked(id).
     * @param {object} record
     * @returns {MilestoneDef[]}
     */
    getNewlyUnlocked(record) {
      return MILESTONES.filter(function (m) {
        return !isAlreadyUnlocked(record, m.id) && m.check(record);
      });
    },
  };

  window.Milestones = Milestones;
})(window);

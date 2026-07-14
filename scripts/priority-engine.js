/* ==========================================================================
   MindBloom — priority-engine.js
   The "intelligence" layer of the Smart Planner. Everything else calls
   PriorityEngine's public methods and gets a consistent result regardless
   of which provider computed it underneath.

     - localEngine  (ACTIVE TODAY) — deterministic scoring from due-date
       proximity, declared priority, and estimated effort. No network.

     - geminiEngine (STUBBED, NOT ACTIVE) — same interface, for smarter
       prioritization later (e.g. cross-referencing wellbeing data — "you
       had 3 rough mood days this week, maybe push the optional task").
       Flip ACTIVE_ENGINE to "gemini" once implemented; planner.js and
       calendar.js do not need to change.
   ========================================================================== */

(function (window) {
  "use strict";

  // ---- Provider switch ----------------------------------------------------
  const ACTIVE_ENGINE = "local";

  const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

  function daysUntil(dateKey) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateKey + "T00:00:00");
    const diffMs = due.getTime() - today.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Urgency score, higher = more urgent. Combines:
   *  - closeness of due date (overdue/today scores highest)
   *  - declared priority weight
   *  - a small bump for larger estimated effort (bigger tasks need an earlier start)
   */
  function computeScore(task) {
    if (task.status === "done") return -1;

    const days = daysUntil(task.dueDate);
    let dueScore;
    if (days < 0) dueScore = 100; // overdue
    else if (days === 0) dueScore = 90; // due today
    else if (days === 1) dueScore = 75; // due tomorrow
    else if (days <= 3) dueScore = 55;
    else if (days <= 7) dueScore = 35;
    else dueScore = 15;

    const priorityScore = (PRIORITY_WEIGHT[task.priority] || 2) * 10;
    const effortScore = Math.min(20, Math.round((task.estimatedMinutes || 30) / 15));

    return dueScore + priorityScore + effortScore;
  }

  function scoreLabel(task) {
    const days = daysUntil(task.dueDate);
    if (task.status === "done") return "Done";
    if (days < 0) return "Overdue";
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    if (days <= 7) return "Due in " + days + " days";
    return "Due " + task.dueDate;
  }

  function workloadLevel(totalMinutes) {
    if (totalMinutes === 0) return { level: "free", message: "Nothing due — good day to get ahead." };
    if (totalMinutes <= 60) return { level: "light", message: "Light day. Should be very manageable." };
    if (totalMinutes <= 150) return { level: "moderate", message: "Moderate load — plan a couple of focused blocks." };
    return { level: "heavy", message: "Heavy day. Consider starting early or moving something flexible." };
  }

  // ---- Local engine (ACTIVE) ----------------------------------------------
  const localEngine = {
    scoreTask(task) {
      return computeScore(task);
    },

    rankTasks(tasks) {
      return tasks
        .slice()
        .sort(function (a, b) {
          return computeScore(b) - computeScore(a);
        });
    },

    getDailyWorkload(tasksForDay) {
      const pending = tasksForDay.filter(function (t) {
        return t.status !== "done";
      });
      const totalMinutes = pending.reduce(function (sum, t) {
        return sum + (t.estimatedMinutes || 30);
      }, 0);
      const level = workloadLevel(totalMinutes);
      return {
        totalMinutes: totalMinutes,
        taskCount: pending.length,
        level: level.level,
        message: level.message,
      };
    },

    suggestFocusTask(tasks) {
      const pending = tasks.filter(function (t) {
        return t.status !== "done";
      });
      if (pending.length === 0) {
        return { task: null, rationale: "Nothing pending — you're all caught up!" };
      }

      const ranked = this.rankTasks(pending);
      const top = ranked[0];
      const days = daysUntil(top.dueDate);

      let rationale;
      if (days < 0) rationale = "This is overdue — tackling it first clears the most pressure.";
      else if (days === 0) rationale = "Due today, so this is the safest place to start.";
      else if (top.priority === "high") rationale = "Marked high priority and coming up soon.";
      else rationale = "This has the closest deadline among your pending tasks.";

      return { task: top, rationale: rationale };
    },

    getScoreLabel(task) {
      return scoreLabel(task);
    },
  };

  // ---- Gemini engine (STUBBED — not called while ACTIVE_ENGINE is "local") ----
  const geminiEngine = {
    /**
     * Future implementation sketch (left unimplemented on purpose):
     *
     *   async rankTasks(tasks, context) {
     *     // context could include recent mood/sleep data from
     *     // insightsService, letting the model suggest lighter task
     *     // ordering on rough wellbeing days.
     *     const response = await fetch(GEMINI_ENDPOINT, {
     *       method: "POST",
     *       body: JSON.stringify({ tasks, context }),
     *     });
     *     const data = await response.json();
     *     return data.orderedTaskIds.map(id => tasks.find(t => t.id === id));
     *   }
     *
     * Every method below must resolve/return the same shapes as
     * localEngine's — planner.js should never need to branch on which
     * engine is active.
     */
    scoreTask() {
      throw new Error("geminiEngine is not implemented yet — set ACTIVE_ENGINE to \"local\".");
    },
    rankTasks() {
      throw new Error("geminiEngine is not implemented yet — set ACTIVE_ENGINE to \"local\".");
    },
    getDailyWorkload() {
      throw new Error("geminiEngine is not implemented yet — set ACTIVE_ENGINE to \"local\".");
    },
    suggestFocusTask() {
      throw new Error("geminiEngine is not implemented yet — set ACTIVE_ENGINE to \"local\".");
    },
    getScoreLabel() {
      throw new Error("geminiEngine is not implemented yet — set ACTIVE_ENGINE to \"local\".");
    },
  };

  const engines = { local: localEngine, gemini: geminiEngine };

  function getEngine() {
    return engines[ACTIVE_ENGINE] || localEngine;
  }

  const PriorityEngine = {
    /** @returns {number} urgency score, higher = more urgent */
    scoreTask(task) {
      return getEngine().scoreTask(task);
    },

    /** @returns {Array} tasks sorted most-urgent first */
    rankTasks(tasks) {
      return getEngine().rankTasks(tasks);
    },

    /** @returns {{totalMinutes:number, taskCount:number, level:string, message:string}} */
    getDailyWorkload(tasksForDay) {
      return getEngine().getDailyWorkload(tasksForDay);
    },

    /** @returns {{task:object|null, rationale:string}} */
    suggestFocusTask(tasks) {
      return getEngine().suggestFocusTask(tasks);
    },

    /** @returns {string} human label like "Due tomorrow" */
    getScoreLabel(task) {
      return getEngine().getScoreLabel(task);
    },

    /** Exposed so calendar.js/planner.js can label days consistently. */
    daysUntil: daysUntil,
  };

  window.PriorityEngine = PriorityEngine;
})(window);

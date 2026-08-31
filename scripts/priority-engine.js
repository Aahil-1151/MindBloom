/* ==========================================================================
   MindBloom — priority-engine.js
   Two small heuristics for the planner's Focus Card and Workload Meter:
   which open task is most worth doing next, and how much is on someone's
   plate over the next few days. Pure functions over the task list from
   MindBloomData — no storage of its own.
   ========================================================================== */

(function (window) {
  "use strict";

  const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

  /** Days from today to a "YYYY-MM-DD" due date (negative = overdue, Infinity = undated). */
  function daysUntil(dueDateStr) {
    if (!dueDateStr) return Infinity;
    const parts = dueDateStr.split("-").map(Number);
    const due = new Date(parts[0], parts[1] - 1, parts[2]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((due - today) / (24 * 60 * 60 * 1000));
  }

  /**
   * Picks the single open task most worth doing next: overdue tasks rank
   * highest (the more overdue, the higher), then soonest-due, tie-broken
   * by priority. Returns null when there's nothing open to suggest.
   * @returns {{task:object, rationale:string}|null}
   */
  function suggestFocusTask(tasks) {
    const open = tasks.filter(function (t) {
      return !t.done;
    });
    if (!open.length) return null;

    const scored = open.map(function (t) {
      const days = daysUntil(t.due);
      const urgency = days === Infinity ? 0 : days < 0 ? 1000 - days * 10 : 100 - days;
      return { task: t, score: urgency + (PRIORITY_WEIGHT[t.priority] || 2) * 5 };
    });
    scored.sort(function (a, b) {
      return b.score - a.score;
    });
    const winner = scored[0].task;
    const days = daysUntil(winner.due);

    let rationale;
    if (days === Infinity) {
      rationale =
        (winner.priority === "high" ? "High priority, no due date yet" : "No due date set") +
        " — a good one to knock out.";
    } else if (days < 0) {
      rationale = Math.abs(days) + (Math.abs(days) === 1 ? " day overdue" : " days overdue") + " — worth tackling first.";
    } else if (days === 0) {
      rationale = "Due today" + (winner.priority === "high" ? ", and high priority." : ".");
    } else if (days === 1) {
      rationale = "Due tomorrow — get ahead of it today.";
    } else {
      rationale = "Due in " + days + " days, " + winner.priority + " priority.";
    }

    return { task: winner, rationale: rationale };
  }

  /**
   * Classifies how much is on someone's plate over the next 3 days
   * (including anything already overdue).
   * @returns {{level:"light"|"moderate"|"heavy", label:string, message:string, count:number}}
   */
  function computeWorkload(tasks) {
    const open = tasks.filter(function (t) {
      return !t.done;
    });
    const nearTerm = open.filter(function (t) {
      const days = daysUntil(t.due);
      return days !== Infinity && days <= 3;
    });

    const count = nearTerm.length;
    let level, label, message;

    if (count === 0) {
      level = "light";
      label = "Clear";
      message = open.length
        ? "Nothing due in the next few days — a good time to get ahead."
        : "Nothing on your plate right now.";
    } else if (count <= 2) {
      level = "light";
      label = "Light";
      message = count + (count === 1 ? " task" : " tasks") + " due in the next 3 days — manageable.";
    } else if (count <= 5) {
      level = "moderate";
      label = "Moderate";
      message = count + " tasks due in the next 3 days — worth planning your time.";
    } else {
      level = "heavy";
      label = "Heavy";
      message = count + " tasks due in the next 3 days — consider tackling the smallest ones first.";
    }

    return { level: level, label: label, message: message, count: count };
  }

  window.PriorityEngine = {
    daysUntil: daysUntil,
    suggestFocusTask: suggestFocusTask,
    computeWorkload: computeWorkload,
  };
})(window);

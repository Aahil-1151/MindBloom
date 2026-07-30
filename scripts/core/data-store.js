/* ==========================================================================
   MindBloom — core/data-store.js
   The single, shared, per-user wellbeing record. Every page that logs
   something real — mood (physical.html + journal.html), sleep/water/
   activity (physical.html), stress (physical.html), journal entries
   (journal.html) — reads and writes through this module, so a mood
   logged on one page is reflected immediately everywhere else that
   reads the same record (dashboard's Today's Summary, Recent Activity,
   wellbeing pillars, and the Tips card).

   Persisted to localStorage under mindbloom_data_<userId> — keyed by the
   signed-in account's id (see auth.js), so every user's history is their
   own and nothing is pre-seeded: every array starts empty at signup and
   only grows from real log*()/add*() calls the person makes.

   Storage holds only the raw logs (moodLogs, physicalLogs, stressLogs,
   journalEntries, upcomingTasks) — today's summary, the wellbeing
   pillars, the recent-activity feed, and tips are all *derived* from
   those logs on read (compute*() below), so there's nothing to keep in
   sync by hand.
   ========================================================================== */
(function (window) {
  "use strict";

  const MOOD_META = [
    { key: "rough", label: "Rough", value: 1 },
    { key: "low", label: "Low", value: 2 },
    { key: "okay", label: "Okay", value: 3 },
    { key: "good", label: "Good", value: 4 },
    { key: "great", label: "Great", value: 5 },
  ];

  function moodMeta(key) {
    return (
      MOOD_META.find(function (m) {
        return m.key === key;
      }) || null
    );
  }

  /* ---------------------------------------------------------------------
     STORAGE — keyed per signed-in user
     --------------------------------------------------------------------- */
  function getUserId() {
    if (window.AuthService && typeof window.AuthService.getSession === "function") {
      // AuthService._createSession() stores the account id under `userId`.
      const session = window.AuthService.getSession();
      if (session && session.userId) return session.userId;
    }
    return "guest";
  }

  function storageKey() {
    return "mindbloom_data_" + getUserId();
  }

  function emptyData() {
    return {
      moodLogs: [],
      physicalLogs: [],
      stressLogs: [],
      journalEntries: [],
      upcomingTasks: [],
    };
  }

  function normalize(parsed) {
    return {
      moodLogs: Array.isArray(parsed.moodLogs) ? parsed.moodLogs : [],
      physicalLogs: Array.isArray(parsed.physicalLogs) ? parsed.physicalLogs : [],
      stressLogs: Array.isArray(parsed.stressLogs) ? parsed.stressLogs : [],
      journalEntries: Array.isArray(parsed.journalEntries) ? parsed.journalEntries : [],
      upcomingTasks: Array.isArray(parsed.upcomingTasks) ? parsed.upcomingTasks : [],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw) return emptyData();
      return normalize(JSON.parse(raw));
    } catch (e) {
      return emptyData();
    }
  }

  function save(data) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(data));
    } catch (e) {
      /* localStorage unavailable — fail quietly, the page still works for
         this load. */
    }
  }

  function genId() {
    return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  /* ---------------------------------------------------------------------
     TIME HELPERS
     --------------------------------------------------------------------- */
  function isToday(timestamp) {
    const d = new Date(timestamp);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  function withinDays(timestamp, days) {
    const then = new Date(timestamp).getTime();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return then >= cutoff;
  }

  function average(values) {
    if (!values.length) return null;
    return (
      values.reduce(function (sum, v) {
        return sum + v;
      }, 0) / values.length
    );
  }

  /**
   * Formats a task's `due` field (a plain "YYYY-MM-DD" string from a
   * date input) into short, human copy — "Today", "Tomorrow", a weekday
   * name within the next week, "N days overdue", or "Mon D" further out.
   * Shared by the planner's task list and the dashboard's Upcoming Tasks
   * card so the two never say different things about the same task.
   */
  function formatTaskDue(dueDateStr) {
    if (!dueDateStr) return "No due date";
    const parts = dueDateStr.split("-").map(Number);
    const due = new Date(parts[0], parts[1] - 1, parts[2]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due - today) / (24 * 60 * 60 * 1000));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays < 0) return Math.abs(diffDays) + " days overdue";
    if (diffDays < 7) return due.toLocaleDateString(undefined, { weekday: "long" });
    return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  /**
   * Open tasks first (soonest due date first, undated tasks last), then
   * completed tasks (most recently completed first). Shared by the
   * dashboard's Upcoming Tasks card and the planner's "All upcoming" view
   * so both agree on what "upcoming" means.
   */
  function sortTasksForDisplay(tasks) {
    const open = tasks.filter(function (t) {
      return !t.done;
    });
    const done = tasks.filter(function (t) {
      return t.done;
    });

    open.sort(function (a, b) {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
    });
    done.sort(function (a, b) {
      return new Date(b.completedAt || 0) - new Date(a.completedAt || 0);
    });

    return open.concat(done);
  }

  function formatRelativeTime(timestamp) {
    const then = new Date(timestamp).getTime();
    const diffMs = Date.now() - then;
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return minutes + "m ago";
    const hours = Math.round(minutes / 60);
    if (hours < 24) return hours + "h ago";
    const days = Math.round(hours / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return days + "d ago";
    return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  /* ---------------------------------------------------------------------
     LOGGING ACTIONS — mutate + persist + return the fresh record
     --------------------------------------------------------------------- */
  function logMood(mood, opts) {
    const meta = moodMeta(mood);
    if (!meta) return load();
    const data = load();
    data.moodLogs.unshift({
      id: genId(),
      mood: mood,
      timestamp: new Date().toISOString(),
      viaJournal: !!(opts && opts.viaJournal),
    });
    data.moodLogs = data.moodLogs.slice(0, 500);
    save(data);
    return data;
  }

  function logPhysical(entry) {
    const data = load();
    data.physicalLogs.unshift({
      id: genId(),
      sleepHours: typeof entry.sleepHours === "number" ? entry.sleepHours : null,
      waterCups: typeof entry.waterCups === "number" ? entry.waterCups : 0,
      activityMinutes: typeof entry.activityMinutes === "number" ? entry.activityMinutes : 0,
      timestamp: new Date().toISOString(),
    });
    data.physicalLogs = data.physicalLogs.slice(0, 500);
    save(data);
    return data;
  }

  function logStress(level) {
    const data = load();
    data.stressLogs.unshift({ id: genId(), level: level, timestamp: new Date().toISOString() });
    data.stressLogs = data.stressLogs.slice(0, 500);
    save(data);
    return data;
  }

  function addJournalEntry(entry) {
    const data = load();
    const record = {
      id: genId(),
      text: entry.text,
      mood: entry.mood || null,
      emotion: entry.emotion || null,
      reflection: entry.reflection || "",
      timestamp: new Date().toISOString(),
    };
    data.journalEntries.unshift(record);
    // A journal entry with a mood attached also counts as that day's mood
    // check-in, so it shows up in the mood history / emotional pillar too.
    if (entry.mood) {
      data.moodLogs.unshift({
        id: genId(),
        mood: entry.mood,
        timestamp: record.timestamp,
        viaJournal: true,
      });
    }
    save(data);
    return { data: data, entry: record };
  }

  function deleteJournalEntry(id) {
    const data = load();
    data.journalEntries = data.journalEntries.filter(function (e) {
      return e.id !== id;
    });
    save(data);
    return data;
  }

  function addTask(task) {
    const data = load();
    data.upcomingTasks.unshift({
      id: genId(),
      title: task.title,
      subject: task.subject || "",
      due: task.due || "",
      priority: task.priority || "medium",
      estimatedMinutes: typeof task.estimatedMinutes === "number" ? task.estimatedMinutes : null,
      notes: task.notes || "",
      done: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
    });
    save(data);
    return data;
  }

  function updateTask(id, patch) {
    const data = load();
    const task = data.upcomingTasks.find(function (t) {
      return t.id === id;
    });
    if (task) {
      ["title", "subject", "due", "priority", "estimatedMinutes", "notes"].forEach(function (key) {
        if (patch[key] !== undefined) task[key] = patch[key];
      });
    }
    save(data);
    return data;
  }

  function deleteTask(id) {
    const data = load();
    data.upcomingTasks = data.upcomingTasks.filter(function (t) {
      return t.id !== id;
    });
    save(data);
    return data;
  }

  function toggleTask(id) {
    const data = load();
    const task = data.upcomingTasks.find(function (t) {
      return t.id === id;
    });
    if (task) {
      task.done = !task.done;
      task.completedAt = task.done ? new Date().toISOString() : null;
    }
    save(data);
    return data;
  }

  /* ---------------------------------------------------------------------
     DERIVED VIEWS — computed fresh from the raw logs, never stored
     --------------------------------------------------------------------- */
  function computeTodaySummary(data) {
    const todaysPhysical =
      data.physicalLogs.find(function (p) {
        return isToday(p.timestamp);
      }) || null;
    const todaysMood =
      data.moodLogs.find(function (m) {
        return isToday(m.timestamp);
      }) || null;
    const doneTasks = data.upcomingTasks.filter(function (t) {
      return t.done;
    }).length;

    return {
      mood: todaysMood ? moodMeta(todaysMood.mood).label : null,
      sleepHours: todaysPhysical ? todaysPhysical.sleepHours : null,
      sleepGoal: 8,
      waterCups: todaysPhysical ? todaysPhysical.waterCups : 0,
      waterGoal: 8,
      tasksDone: doneTasks,
      tasksTotal: data.upcomingTasks.length,
    };
  }

  function computePillars(data) {
    const recentPhysical = data.physicalLogs.filter(function (p) {
      return withinDays(p.timestamp, 7);
    });
    const recentStress = data.stressLogs.filter(function (s) {
      return withinDays(s.timestamp, 7);
    });
    const recentMood = data.moodLogs.filter(function (m) {
      return withinDays(m.timestamp, 7);
    });
    const totalTasks = data.upcomingTasks.length;
    const doneTasks = data.upcomingTasks.filter(function (t) {
      return t.done;
    }).length;

    let physical = null;
    if (recentPhysical.length) {
      const avgSleep = average(
        recentPhysical.map(function (p) {
          return p.sleepHours || 0;
        })
      );
      const avgWater = average(
        recentPhysical.map(function (p) {
          return p.waterCups || 0;
        })
      );
      const avgActivity = average(
        recentPhysical.map(function (p) {
          return p.activityMinutes || 0;
        })
      );
      physical = Math.round(
        Math.min(100, (avgSleep / 8) * 100) * 0.5 +
          Math.min(100, (avgWater / 8) * 100) * 0.3 +
          Math.min(100, (avgActivity / 30) * 100) * 0.2
      );
    }

    let mental = null;
    if (recentStress.length) {
      const avgStress = average(
        recentStress.map(function (s) {
          return s.level;
        })
      );
      mental = Math.round(((5 - avgStress) / 4) * 100);
    }

    let emotional = null;
    if (recentMood.length) {
      const avgMood = average(
        recentMood.map(function (m) {
          return moodMeta(m.mood).value;
        })
      );
      emotional = Math.round(((avgMood - 1) / 4) * 100);
    }

    const academic = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : null;

    return { physical: physical, mental: mental, emotional: emotional, academic: academic };
  }

  function computeRecentActivity(data, limit) {
    limit = limit || 6;
    const events = [];

    data.moodLogs.forEach(function (m) {
      if (m.viaJournal) return; // already represented by the journal entry itself
      events.push({
        icon: "mood-" + m.mood,
        text: "Logged mood as " + moodMeta(m.mood).label,
        timestamp: m.timestamp,
      });
    });
    data.physicalLogs.forEach(function (p) {
      const parts = [];
      if (p.sleepHours) parts.push(p.sleepHours + "h sleep");
      if (p.waterCups) parts.push(p.waterCups + " cups of water");
      if (p.activityMinutes) parts.push(p.activityMinutes + " active min");
      events.push({
        icon: "activity",
        text: "Logged " + (parts.join(", ") || "a physical check-in"),
        timestamp: p.timestamp,
      });
    });
    data.stressLogs.forEach(function (s) {
      events.push({ icon: "wind", text: "Stress check-in: " + s.level + " / 5", timestamp: s.timestamp });
    });
    data.journalEntries.forEach(function (j) {
      events.push({
        icon: "edit",
        text: "Wrote a journal entry" + (j.mood ? " (feeling " + moodMeta(j.mood).label.toLowerCase() + ")" : ""),
        timestamp: j.timestamp,
      });
    });
    data.upcomingTasks.forEach(function (t) {
      if (t.done && t.completedAt) {
        events.push({ icon: "check", text: 'Completed "' + t.title + '"', timestamp: t.completedAt });
      }
    });

    events.sort(function (a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    return events.slice(0, limit).map(function (e) {
      return { icon: e.icon, text: e.text, time: formatRelativeTime(e.timestamp) };
    });
  }

  /**
   * Short, data-driven nudges based on the last 7 days of logs — the more
   * a person has actually logged, the more specific these get. Returns []
   * until there's enough real history to say anything meaningful.
   */
  function computeTips(data) {
    const tips = [];
    const recentPhysical = data.physicalLogs.filter(function (p) {
      return withinDays(p.timestamp, 7);
    });
    const recentStress = data.stressLogs.filter(function (s) {
      return withinDays(s.timestamp, 7);
    });
    const recentMood = data.moodLogs.filter(function (m) {
      return withinDays(m.timestamp, 7);
    });
    const recentJournal = data.journalEntries.filter(function (j) {
      return withinDays(j.timestamp, 7);
    });

    if (recentPhysical.length) {
      const avgSleep = average(
        recentPhysical.map(function (p) {
          return p.sleepHours || 0;
        })
      );
      if (avgSleep < 6) {
        tips.push({
          id: "sleep-low",
          icon: "moon",
          level: "warning",
          title: "You're running low on sleep",
          message:
            "You've averaged " +
            avgSleep.toFixed(1) +
            "h a night over the last week — try winding down 30 minutes earlier tonight.",
        });
      } else if (avgSleep >= 8) {
        tips.push({
          id: "sleep-good",
          icon: "moon",
          level: "positive",
          title: "Solid sleep streak",
          message: "You've averaged " + avgSleep.toFixed(1) + "h a night this week. Keep the rhythm going.",
        });
      }

      const avgWater = average(
        recentPhysical.map(function (p) {
          return p.waterCups || 0;
        })
      );
      if (avgWater < 4) {
        tips.push({
          id: "water-low",
          icon: "droplet",
          level: "info",
          title: "Hydration's been light",
          message:
            "Averaging " + avgWater.toFixed(1) + " cups a day this week — keep a bottle nearby between classes.",
        });
      }
    }

    if (recentStress.length) {
      const avgStress = average(
        recentStress.map(function (s) {
          return s.level;
        })
      );
      if (avgStress >= 3.5) {
        tips.push({
          id: "stress-high",
          icon: "wind",
          level: "warning",
          title: "Stress has been running high",
          message:
            "Your check-ins average " +
            avgStress.toFixed(1) +
            "/5 this week — a 5-minute breathing session on the Wellbeing page can help reset.",
        });
      }
    }

    if (recentMood.length) {
      const avgMood = average(
        recentMood.map(function (m) {
          return moodMeta(m.mood).value;
        })
      );
      if (avgMood <= 2.4) {
        tips.push({
          id: "mood-low",
          icon: "heart",
          level: "warning",
          title: "Your mood's been on the lower side",
          message:
            "A few rough days in a row — consider writing about it in your journal, or reaching out to someone you trust.",
        });
      }
    }

    if (!recentJournal.length && (data.moodLogs.length || data.physicalLogs.length || data.stressLogs.length)) {
      tips.push({
        id: "journal-nudge",
        icon: "edit",
        level: "info",
        title: "Haven't journaled this week",
        message: "Even two or three sentences can help you spot patterns over time.",
      });
    }

    const overdueTasks = data.upcomingTasks.filter(function (t) {
      return !t.done;
    }).length;
    if (overdueTasks >= 4) {
      tips.push({
        id: "tasks-heavy",
        icon: "check",
        level: "info",
        title: "Your task list is stacking up",
        message: overdueTasks + " open tasks right now — tackling the smallest one first can build momentum.",
      });
    }

    return tips;
  }

  window.MindBloomData = {
    MOOD_META: MOOD_META,
    moodMeta: moodMeta,
    load: load,
    save: save,
    logMood: logMood,
    logPhysical: logPhysical,
    logStress: logStress,
    addJournalEntry: addJournalEntry,
    deleteJournalEntry: deleteJournalEntry,
    addTask: addTask,
    updateTask: updateTask,
    deleteTask: deleteTask,
    toggleTask: toggleTask,
    computeTodaySummary: computeTodaySummary,
    computePillars: computePillars,
    computeRecentActivity: computeRecentActivity,
    computeTips: computeTips,
    sortTasksForDisplay: sortTasksForDisplay,
    formatRelativeTime: formatRelativeTime,
    formatTaskDue: formatTaskDue,
    isToday: isToday,
    withinDays: withinDays,
  };
})(window);

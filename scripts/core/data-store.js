/* ==========================================================================
   MindBloom — core/data-store.js
   The single shared, per-device data layer (localStorage-backed) behind
   the dashboard, wellbeing hub (physical.html), journal, and planner.
   Every "log"/"save"/"add" action here is the one place that actually
   writes; journal-storage.js and task-manager.js are thin query layers on
   top of this. Nothing is pre-seeded — a new signup starts with every log
   empty until the person actually logs something (see dashboard.js).
   Load this after core/utils.js and before any page controller that uses
   MindBloomData.
   ========================================================================== */

(function (window) {
  "use strict";

  const KEYS = {
    journal: "mindbloom_journal",
    tasks: "mindbloom_academic_tasks",
    physical: "mindbloom_physical_logs",
    stress: "mindbloom_mental_checkins",
    moods: "mindbloom_moods",
    trustedContacts: "mindbloom_trusted_contacts",
    focusSessions: "mindbloom_focus_sessions",
  };

  /* Five moods, sweeping the app's mood color scale (--mood-rough ...
     --mood-great in variables.css) rough -> great, each with a 0-100
     wellbeing-score weight used by computePillars/computeTodaySummary. */
  const MOOD_META = [
    { key: "rough", label: "Rough", score: 15 },
    { key: "low", label: "Low", score: 38 },
    { key: "okay", label: "Okay", score: 60 },
    { key: "good", label: "Good", score: 82 },
    { key: "great", label: "Great", score: 100 },
  ];

  /* ======================================================================
     LOW-LEVEL STORAGE
     ====================================================================== */
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function load() {
    return {
      journalEntries: readJSON(KEYS.journal, []),
      upcomingTasks: readJSON(KEYS.tasks, []),
      physicalLogs: readJSON(KEYS.physical, []),
      stressLogs: readJSON(KEYS.stress, []),
      moodLogs: readJSON(KEYS.moods, []),
      trustedContacts: readJSON(KEYS.trustedContacts, []),
      focusSessions: readJSON(KEYS.focusSessions, []),
    };
  }

  function moodMeta(key) {
    return MOOD_META.find(function (m) {
      return m.key === key;
    }) || null;
  }

  /* ======================================================================
     TIME HELPERS
     ====================================================================== */
  function isToday(timestamp) {
    if (!timestamp) return false;
    const d = new Date(timestamp);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function daysAgo(timestamp) {
    const ms = startOfDay(new Date()) - startOfDay(new Date(timestamp));
    return Math.round(ms / 86400000);
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return "";
    const then = new Date(timestamp);
    const diffMs = Date.now() - then.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return diffMin + (diffMin === 1 ? " minute ago" : " minutes ago");
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return diffHr + (diffHr === 1 ? " hour ago" : " hours ago");
    const diffDay = daysAgo(timestamp);
    if (diffDay === 1) return "Yesterday";
    if (diffDay < 7) return diffDay + " days ago";
    return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function formatTaskDue(due) {
    if (!due) return "No due date";
    const parts = due.split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const diffDays = Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000);

    if (diffDays === 0) return "Due today";
    if (diffDays === 1) return "Due tomorrow";
    if (diffDays === -1) return "1 day overdue";
    if (diffDays < 0) return Math.abs(diffDays) + " days overdue";
    if (diffDays <= 6) return date.toLocaleDateString(undefined, { weekday: "long" });
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  /* ======================================================================
     JOURNAL — timestamp is canonical; createdAt is kept alongside it
     purely so analytics.js's direct localStorage read (which looks for
     entry.createdAt) can also pick these entries up.
     ====================================================================== */
  function addJournalEntry(entry) {
    const entries = readJSON(KEYS.journal, []);
    const timestamp = new Date().toISOString();
    const record = Object.assign(
      { id: generateId(), timestamp: timestamp, createdAt: timestamp },
      entry
    );
    entries.unshift(record);
    writeJSON(KEYS.journal, entries);
    return record;
  }

  function deleteJournalEntry(id) {
    const entries = readJSON(KEYS.journal, []).filter(function (e) {
      return e.id !== id;
    });
    writeJSON(KEYS.journal, entries);
    return load();
  }

  /* ======================================================================
     TASKS — due is canonical ("YYYY-MM-DD"); dueDate mirrors it for
     analytics.js's direct read, same reasoning as journal above.
     ====================================================================== */
  function addTask(task) {
    const tasks = readJSON(KEYS.tasks, []);
    const record = Object.assign(
      { id: generateId(), done: false },
      task,
      { dueDate: task.due }
    );
    tasks.push(record);
    writeJSON(KEYS.tasks, tasks);
    return load();
  }

  function updateTask(id, patch) {
    const tasks = readJSON(KEYS.tasks, []).map(function (t) {
      if (t.id !== id) return t;
      const merged = Object.assign({}, t, patch);
      if (patch.due) merged.dueDate = patch.due;
      return merged;
    });
    writeJSON(KEYS.tasks, tasks);
    return load();
  }

  function deleteTask(id) {
    const tasks = readJSON(KEYS.tasks, []).filter(function (t) {
      return t.id !== id;
    });
    writeJSON(KEYS.tasks, tasks);
    return load();
  }

  function toggleTask(id) {
    const tasks = readJSON(KEYS.tasks, []).map(function (t) {
      return t.id === id ? Object.assign({}, t, { done: !t.done }) : t;
    });
    writeJSON(KEYS.tasks, tasks);
    return load();
  }

  function sortTasksForDisplay(tasks) {
    const priorityRank = { high: 0, medium: 1, low: 2 };
    return tasks.slice().sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const aDue = a.due || "9999-99-99";
      const bDue = b.due || "9999-99-99";
      if (aDue !== bDue) return aDue < bDue ? -1 : 1;
      const aRank = priorityRank[a.priority] === undefined ? 1 : priorityRank[a.priority];
      const bRank = priorityRank[b.priority] === undefined ? 1 : priorityRank[b.priority];
      return aRank - bRank;
    });
  }

  /* ======================================================================
     TRUSTED CONTACTS (emergency.html) — a person's own short list of who
     to reach out to, independent of the crisis-line resources shown
     alongside them (those are static, not stored here).
     ====================================================================== */
  function addTrustedContact(contact) {
    const contacts = readJSON(KEYS.trustedContacts, []);
    const record = Object.assign({ id: generateId() }, contact);
    contacts.unshift(record);
    writeJSON(KEYS.trustedContacts, contacts);
    return load();
  }

  function deleteTrustedContact(id) {
    const contacts = readJSON(KEYS.trustedContacts, []).filter(function (c) {
      return c.id !== id;
    });
    writeJSON(KEYS.trustedContacts, contacts);
    return load();
  }

  /* ======================================================================
     PHYSICAL — one record per calendar day; logging again today overwrites
     today's entry instead of stacking duplicates.
     ====================================================================== */
  function logPhysical(patch) {
    const logs = readJSON(KEYS.physical, []);
    const idx = logs.findIndex(function (p) {
      return isToday(p.timestamp);
    });
    if (idx !== -1) {
      logs[idx] = Object.assign({}, logs[idx], patch, { timestamp: new Date().toISOString() });
    } else {
      logs.unshift(Object.assign({ id: generateId(), timestamp: new Date().toISOString() }, patch));
    }
    writeJSON(KEYS.physical, logs);
    return load();
  }

  /* ======================================================================
     STRESS + MOOD — every check-in is its own log entry (history matters
     for these two, unlike the one-per-day physical check-in).
     ====================================================================== */
  function logStress(level) {
    const logs = readJSON(KEYS.stress, []);
    logs.unshift({ id: generateId(), timestamp: new Date().toISOString(), level: level });
    writeJSON(KEYS.stress, logs);
    return load();
  }

  function logMood(mood) {
    const logs = readJSON(KEYS.moods, []);
    logs.unshift({ id: generateId(), timestamp: new Date().toISOString(), mood: mood });
    writeJSON(KEYS.moods, logs);
    return load();
  }

  /* ======================================================================
     FOCUS SESSIONS (planner.html's Pomodoro timer) — one entry per
     completed focus interval; break intervals aren't logged.
     ====================================================================== */
  function addFocusSession(session) {
    const logs = readJSON(KEYS.focusSessions, []);
    logs.unshift({
      id: generateId(),
      taskId: session.taskId || null,
      taskTitle: session.taskTitle || "",
      durationMinutes: typeof session.durationMinutes === "number" ? session.durationMinutes : 25,
      timestamp: new Date().toISOString(),
    });
    writeJSON(KEYS.focusSessions, logs);
    return load();
  }

  /* ======================================================================
     DERIVED: TODAY'S SUMMARY (dashboard.js)
     ====================================================================== */
  function computeTodaySummary(record) {
    const todaysMood = record.moodLogs.find(function (m) {
      return isToday(m.timestamp);
    });
    const todaysPhysical = record.physicalLogs.find(function (p) {
      return isToday(p.timestamp);
    });
    const meta = todaysMood ? moodMeta(todaysMood.mood) : null;

    return {
      mood: meta ? meta.label : null,
      sleepHours: todaysPhysical && typeof todaysPhysical.sleepHours === "number" ? todaysPhysical.sleepHours : null,
      sleepGoal: 8,
      waterCups: (todaysPhysical && todaysPhysical.waterCups) || 0,
      waterGoal: 8,
      tasksDone: record.upcomingTasks.filter(function (t) {
        return t.done;
      }).length,
      tasksTotal: record.upcomingTasks.length,
    };
  }

  /* ======================================================================
     DERIVED: WELLBEING PILLARS — each 0-100 or omitted if untracked.
     ====================================================================== */
  function computePillars(record) {
    const pillars = {};

    const recentPhysical = record.physicalLogs.filter(function (p) {
      return daysAgo(p.timestamp) <= 6;
    });
    if (recentPhysical.length) {
      const avg = recentPhysical.reduce(function (sum, p) {
        const sleepScore = Math.min(100, ((p.sleepHours || 0) / 8) * 100);
        const waterScore = Math.min(100, ((p.waterCups || 0) / 8) * 100);
        const activityScore = Math.min(100, ((p.activityMinutes || 0) / 30) * 100);
        return sum + (sleepScore + waterScore + activityScore) / 3;
      }, 0) / recentPhysical.length;
      pillars.physical = Math.round(avg);
    }

    const recentStress = record.stressLogs.filter(function (s) {
      return daysAgo(s.timestamp) <= 6;
    });
    if (recentStress.length) {
      const avgLevel = recentStress.reduce(function (sum, s) {
        return sum + s.level;
      }, 0) / recentStress.length;
      pillars.mental = Math.round(100 - ((avgLevel - 1) / 4) * 100);
    }

    const recentMoods = record.moodLogs.filter(function (m) {
      return daysAgo(m.timestamp) <= 6;
    });
    if (recentMoods.length) {
      const avg = recentMoods.reduce(function (sum, m) {
        const meta = moodMeta(m.mood);
        return sum + (meta ? meta.score : 60);
      }, 0) / recentMoods.length;
      pillars.emotional = Math.round(avg);
    }

    const recentTasks = record.upcomingTasks.filter(function (t) {
      return t.due && daysAgo(t.due + "T00:00:00") >= -6 && daysAgo(t.due + "T00:00:00") <= 0;
    });
    if (recentTasks.length) {
      const done = recentTasks.filter(function (t) {
        return t.done;
      }).length;
      pillars.academic = Math.round((done / recentTasks.length) * 100);
    }

    return pillars;
  }

  /* ======================================================================
     DERIVED: TIPS — up to 3 short, data-driven nudges from the last 7
     days. tip.level drives the tip-item--<level> CSS modifier.
     ====================================================================== */
  function computeTips(record) {
    const tips = [];
    const recentPhysical = record.physicalLogs.filter(function (p) {
      return daysAgo(p.timestamp) <= 6;
    });
    const recentStress = record.stressLogs.filter(function (s) {
      return daysAgo(s.timestamp) <= 6;
    });
    const recentMoods = record.moodLogs.filter(function (m) {
      return daysAgo(m.timestamp) <= 6;
    });

    if (recentPhysical.length) {
      const avgSleep = recentPhysical.reduce(function (s, p) {
        return s + (p.sleepHours || 0);
      }, 0) / recentPhysical.length;
      if (avgSleep < 6.5) {
        tips.push({
          level: "warning",
          icon: "moon",
          title: "Sleep's been light",
          message: "You've averaged " + avgSleep.toFixed(1) + "h this week — aim for a bit earlier tonight.",
        });
      }
    }

    if (recentStress.length) {
      const avgStress = recentStress.reduce(function (s, r) {
        return s + r.level;
      }, 0) / recentStress.length;
      if (avgStress >= 3.5) {
        tips.push({
          level: "warning",
          icon: "wind",
          title: "Stress has been high",
          message: "Try a guided breathing session on the Wellbeing page — even 2 minutes helps.",
        });
      }
    }

    if (recentMoods.length >= 3) {
      const goodMoods = recentMoods.filter(function (m) {
        return m.mood === "good" || m.mood === "great";
      }).length;
      if (goodMoods / recentMoods.length >= 0.7) {
        tips.push({
          level: "positive",
          icon: "sparkle",
          title: "You're on a roll",
          message: "Your mood's been trending up this week. Keep doing what's working.",
        });
      }
    }

    const overdue = record.upcomingTasks.filter(function (t) {
      return !t.done && t.due && t.due < new Date().toISOString().slice(0, 10);
    }).length;
    if (overdue > 0) {
      tips.push({
        level: "info",
        icon: "clock",
        title: overdue === 1 ? "1 task is overdue" : overdue + " tasks are overdue",
        message: "Clear a little space in Planner when you get a moment.",
      });
    }

    return tips.slice(0, 3);
  }

  /* ======================================================================
     DERIVED: RECENT ACTIVITY — merges every log type into one
     most-recent-first feed.
     ====================================================================== */
  function computeRecentActivity(record, limit) {
    const items = [];

    record.moodLogs.forEach(function (m) {
      const meta = moodMeta(m.mood);
      items.push({
        icon: "mood-" + m.mood,
        text: "Logged mood: " + (meta ? meta.label : m.mood),
        timestamp: m.timestamp,
      });
    });

    record.physicalLogs.forEach(function (p) {
      items.push({
        icon: "activity",
        text: "Logged today's check-in",
        timestamp: p.timestamp,
      });
    });

    record.stressLogs.forEach(function (s) {
      items.push({
        icon: "wind",
        text: "Logged a stress check-in",
        timestamp: s.timestamp,
      });
    });

    record.journalEntries.forEach(function (e) {
      items.push({
        icon: "edit",
        text: "Wrote a journal entry",
        timestamp: e.timestamp,
      });
    });

    record.upcomingTasks
      .filter(function (t) {
        return t.done;
      })
      .forEach(function (t) {
        items.push({
          icon: "check",
          text: 'Completed "' + t.title + '"',
          timestamp: t.completedAt || t.due || t.id,
        });
      });

    record.focusSessions.forEach(function (s) {
      items.push({
        icon: "clock",
        text: "Finished a " + s.durationMinutes + "-minute focus session" + (s.taskTitle ? ' on "' + s.taskTitle + '"' : ""),
        timestamp: s.timestamp,
      });
    });

    items.sort(function (a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    return items.slice(0, limit).map(function (item) {
      return { icon: item.icon, text: item.text, time: formatRelativeTime(item.timestamp) };
    });
  }

  window.MindBloomData = {
    MOOD_META: MOOD_META,
    load: load,
    moodMeta: moodMeta,

    addJournalEntry: addJournalEntry,
    deleteJournalEntry: deleteJournalEntry,

    addTask: addTask,
    updateTask: updateTask,
    deleteTask: deleteTask,
    toggleTask: toggleTask,
    sortTasksForDisplay: sortTasksForDisplay,

    logPhysical: logPhysical,
    logStress: logStress,
    logMood: logMood,

    addTrustedContact: addTrustedContact,
    deleteTrustedContact: deleteTrustedContact,
    addFocusSession: addFocusSession,

    isToday: isToday,
    formatTaskDue: formatTaskDue,
    formatRelativeTime: formatRelativeTime,

    computeTodaySummary: computeTodaySummary,
    computePillars: computePillars,
    computeTips: computeTips,
    computeRecentActivity: computeRecentActivity,
  };
})(window);

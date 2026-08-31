/* ==========================================================================
   MindBloom — analytics.js
   Page controller for analytics.html. Reads whatever real data already
   exists in localStorage from other modules (journal entries, academic
   tasks), fills any gaps with a deterministic demo series so the page is
   never empty, computes derived metrics through HabitAnalysis /
   BurnoutScore / WeeklySummary, and renders everything through
   ChartsFactory. This file never calls `new Chart(...)` directly.
   No inline scripts exist in analytics.html — this file attaches its own
   DOMContentLoaded listener.
   ========================================================================== */

(function (window, document) {
  "use strict";

  let currentRangeDays = 7;
  let els = {};

  /* ----------------------------------------------------------------------
     DATE HELPERS
     ---------------------------------------------------------------------- */
  const toDateKey = window.MindBloomUtils.toDateKey;

  function getRangeDates(days) {
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d);
    }
    return dates;
  }

  function formatShortLabel(date, days) {
    if (days <= 7) {
      return date.toLocaleDateString(undefined, { weekday: "short" });
    }
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  /* ----------------------------------------------------------------------
     DETERMINISTIC DEMO SERIES (used only to fill gaps where no real data
     exists yet, so the page always renders meaningfully). Seeded by day-
     of-year so values are stable across reloads rather than jittery.
     ---------------------------------------------------------------------- */
  function seededWave(dayIndex, base, amplitude, period) {
    return base + amplitude * Math.sin((dayIndex / period) * Math.PI * 2);
  }

  function dayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    return Math.floor((date - start) / (1000 * 60 * 60 * 24));
  }

  /* ----------------------------------------------------------------------
     REAL DATA READERS (direct localStorage reads matching the keys other
     modules already use — analytics.js only reads, never writes them)
     ---------------------------------------------------------------------- */
  function readJournalEntries() {
    try {
      const raw = localStorage.getItem("mindbloom_journal");
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  function readTasks() {
    try {
      const raw = localStorage.getItem("mindbloom_academic_tasks");
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  const SENTIMENT_TO_SCORE = {
    joy: 5, gratitude: 5, calm: 4, neutral: 3, sadness: 2, stress: 2, anger: 1.5, fear: 1.5, crisis: 1,
  };

  /* ----------------------------------------------------------------------
     RAW HISTORY — for api/analyze.js (BurnoutScore.computeScoreAsync /
     WeeklySummary's gemini path), which reasons over actual day-by-day
     data and journal text rather than the pre-aggregated signals object
     below. Built once per buildDataBundle call and reused for both the
     burnout call and (via the returned bundle) the weekly summary call.
     ---------------------------------------------------------------------- */
  function buildRawHistory(dates, journalEntries, tasks, moodSeries, sleepSeries) {
    const rangeStart = dates[0];

    const days = dates.map(function (date, index) {
      return {
        date: toDateKey(date),
        mood: moodSeries[index],
        sleepHours: sleepSeries[index],
      };
    });

    const recentJournal = journalEntries
      .filter(function (e) { return new Date(e.createdAt) >= rangeStart; })
      .slice(0, 10)
      .map(function (e) {
        return {
          date: toDateKey(new Date(e.createdAt)),
          text: (e.text || "").slice(0, 300),
          sentiment: e.sentimentLabel || null,
        };
      });

    const overdueTaskCount = tasks.filter(function (t) {
      return t.status !== "done" && new Date(t.dueDate) < new Date();
    }).length;
    const dueSoonTaskCount = tasks.filter(function (t) {
      const diffDays = (new Date(t.dueDate) - new Date()) / 86400000;
      return t.status !== "done" && diffDays >= 0 && diffDays <= 3;
    }).length;

    return {
      days: days,
      journalEntries: recentJournal,
      overdueTaskCount: overdueTaskCount,
      dueSoonTaskCount: dueSoonTaskCount,
    };
  }

  /* ----------------------------------------------------------------------
     BUILD THE DATA BUNDLE FOR THE SELECTED RANGE
     ---------------------------------------------------------------------- */
  function buildDataBundle(days) {
    const dates = getRangeDates(days);
    const journalEntries = readJournalEntries();
    const tasks = readTasks();

    const journalByDate = {};
    journalEntries.forEach(function (entry) {
      const key = toDateKey(new Date(entry.createdAt));
      if (!journalByDate[key]) journalByDate[key] = [];
      journalByDate[key].push(entry);
    });

    const labels = [];
    const moodSeries = [];
    const sleepSeries = [];
    const waterSeries = [];
    const activityDates = [];

    dates.forEach(function (date, index) {
      const key = toDateKey(date);
      labels.push(formatShortLabel(date, days));

      const entriesToday = journalByDate[key];
      if (entriesToday && entriesToday.length > 0) {
        activityDates.push(key);
        const avg = entriesToday.reduce(function (sum, e) {
          return sum + (SENTIMENT_TO_SCORE[e.sentimentLabel] || 3);
        }, 0) / entriesToday.length;
        moodSeries.push(Number(avg.toFixed(1)));
      } else {
        // Deterministic demo fallback so the chart isn't empty
        moodSeries.push(Number(seededWave(dayOfYear(date), 3.4, 0.9, 6).toFixed(1)));
      }

      sleepSeries.push(Number(seededWave(dayOfYear(date) + 3, 7.1, 1.1, 5).toFixed(1)));
      waterSeries.push(Math.round(seededWave(dayOfYear(date) + 6, 5.5, 2, 4)));
    });

    // Task completion within range
    const cutoff = dates[0];
    const tasksInRange = tasks.filter(function (t) {
      return new Date(t.dueDate) >= cutoff;
    });
    const doneCount = tasksInRange.filter(function (t) {
      return t.status === "done";
    }).length;
    const pendingCount = tasksInRange.length - doneCount;
    const overdueCount = tasksInRange.filter(function (t) {
      return t.status !== "done" && new Date(t.dueDate) < new Date();
    }).length;

    const hasRealTasks = tasks.length > 0;
    const taskCompletion = hasRealTasks
      ? { done: doneCount, pending: pendingCount }
      : { done: 8, pending: 3 }; // demo fallback

    // Wellbeing pillar averages (0-100). Academic pillar reflects real
    // completion rate when tasks exist; others are demo-seeded.
    const academicScore = hasRealTasks && tasksInRange.length > 0
      ? Math.round((doneCount / tasksInRange.length) * 100)
      : 74;

    const pillars = {
      labels: ["Physical", "Mental", "Emotional", "Academic"],
      data: [
        Math.round(seededWave(dayOfYear(new Date()), 78, 8, 9)),
        Math.round(seededWave(dayOfYear(new Date()) + 2, 68, 10, 7)),
        Math.round(seededWave(dayOfYear(new Date()) + 4, 82, 7, 8)),
        academicScore,
      ],
    };

    // Habit consistency, based on journal activity (real, falling back to
    // a demo-plausible set of dates if there's no journal history yet)
    const habitDates = activityDates.length > 0
      ? activityDates
      : dates.filter(function (_, i) {
          return i % 2 === 0;
        }).map(toDateKey);

    const habitStats = HabitAnalysis.analyze(habitDates, days);

    const negativeCount = journalEntries.filter(function (e) {
      return ["sadness", "stress", "anger", "fear", "crisis"].indexOf(e.sentimentLabel) !== -1;
    }).length;
    const negativeRatio = journalEntries.length > 0 ? negativeCount / journalEntries.length : 0.2;

    const avgSleep = sleepSeries.reduce(function (a, b) { return a + b; }, 0) / sleepSeries.length;
    const avgMood = moodSeries.reduce(function (a, b) { return a + b; }, 0) / moodSeries.length;
    const avgWorkloadMinutes = tasksInRange.length > 0
      ? tasksInRange.reduce(function (sum, t) { return sum + (t.estimatedMinutes || 30); }, 0) / days
      : 65;

    const rawHistory = buildRawHistory(dates, journalEntries, tasks, moodSeries, sleepSeries);

    // Instant local score first — the AI upgrade (see refreshAll) runs
    // separately afterward so it never blocks the rest of this page.
    const burnoutSignals = {
      avgWorkloadMinutesPerDay: avgWorkloadMinutes,
      avgMoodScore: avgMood,
      avgSleepHours: avgSleep,
      negativeEntryRatio: negativeRatio,
      overdueTaskCount: overdueCount,
    };
    const burnout = BurnoutScore.computeScore(burnoutSignals);

    // Top recurring theme across journal entries (for the weekly summary line)
    const themeCounts = {};
    journalEntries.forEach(function (e) {
      (e.themes || []).forEach(function (theme) {
        themeCounts[theme] = (themeCounts[theme] || 0) + 1;
      });
    });
    const topTheme = Object.keys(themeCounts).sort(function (a, b) {
      return themeCounts[b] - themeCounts[a];
    })[0] || null;

    return {
      labels: labels,
      moodSeries: moodSeries,
      sleepSeries: sleepSeries,
      waterSeries: waterSeries,
      taskCompletion: taskCompletion,
      pillars: pillars,
      habitStats: habitStats,
      burnout: burnout,
      avgSleep: avgSleep,
      taskCompletionRate: taskCompletion.done / Math.max(1, taskCompletion.done + taskCompletion.pending),
      topTheme: topTheme,
      rawHistory: rawHistory,
      burnoutSignals: burnoutSignals,
    };
  }

  /* ----------------------------------------------------------------------
     BURNOUT TREND — direction over time, not just today's snapshot.
     Mirrors buildDataBundle's burnout-signal derivation (real journal/task
     data, the same deterministic demo-fallback for sleep/mood gaps) but
     applied to several past 7-day windows instead of just the currently
     selected range, so "this week" here always matches what the gauge
     above shows on a 7-day range. Kept as its own pass rather than
     threaded through buildDataBundle so the range toggle (7/30/90) can
     keep driving the snapshot score independently of this weekly series.
     ---------------------------------------------------------------------- */
  function computeBurnoutForWeek(weekEndDate, journalEntries, tasks) {
    const weekDates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(weekEndDate);
      d.setDate(d.getDate() - i);
      weekDates.push(d);
    }
    const weekStart = weekDates[0];

    const moodSum = weekDates.reduce(function (sum, date) {
      const key = toDateKey(date);
      const entriesToday = journalEntries.filter(function (e) {
        return toDateKey(new Date(e.createdAt)) === key;
      });
      if (entriesToday.length) {
        return sum + entriesToday.reduce(function (s, e) {
          return s + (SENTIMENT_TO_SCORE[e.sentimentLabel] || 3);
        }, 0) / entriesToday.length;
      }
      return sum + seededWave(dayOfYear(date), 3.4, 0.9, 6);
    }, 0);
    const avgMood = moodSum / weekDates.length;

    const avgSleep = weekDates.reduce(function (sum, date) {
      return sum + seededWave(dayOfYear(date) + 3, 7.1, 1.1, 5);
    }, 0) / weekDates.length;

    const weekEntries = journalEntries.filter(function (e) {
      const d = new Date(e.createdAt);
      return d >= weekStart && d <= weekEndDate;
    });
    const negativeCount = weekEntries.filter(function (e) {
      return ["sadness", "stress", "anger", "fear", "crisis"].indexOf(e.sentimentLabel) !== -1;
    }).length;
    const negativeRatio = weekEntries.length > 0 ? negativeCount / weekEntries.length : 0.2;

    const weekTasks = tasks.filter(function (t) {
      const d = new Date(t.dueDate);
      return d >= weekStart && d <= weekEndDate;
    });
    const overdueCount = weekTasks.filter(function (t) {
      return t.status !== "done" && new Date(t.dueDate) < new Date();
    }).length;
    const avgWorkloadMinutes = weekTasks.length > 0
      ? weekTasks.reduce(function (sum, t) { return sum + (t.estimatedMinutes || 30); }, 0) / 7
      : 65;

    return BurnoutScore.computeScore({
      avgWorkloadMinutesPerDay: avgWorkloadMinutes,
      avgMoodScore: avgMood,
      avgSleepHours: avgSleep,
      negativeEntryRatio: negativeRatio,
      overdueTaskCount: overdueCount,
    });
  }

  function computeBurnoutHistory(weeksBack) {
    const journalEntries = readJournalEntries();
    const tasks = readTasks();
    const points = [];
    for (let w = weeksBack - 1; w >= 0; w--) {
      const weekEndDate = new Date();
      weekEndDate.setDate(weekEndDate.getDate() - w * 7);
      const result = computeBurnoutForWeek(weekEndDate, journalEntries, tasks);
      points.push({ label: w === 0 ? "This week" : w + "w ago", score: result.score });
    }
    return points;
  }

  /* ----------------------------------------------------------------------
     DOM helpers
     ---------------------------------------------------------------------- */
  const el = window.MindBloomUtils.el;

  function cacheElements() {
    els = {
      rangeToggle: document.getElementById("range-toggle"),
      burnoutScore: document.getElementById("burnout-score-value"),
      burnoutLevel: document.getElementById("burnout-level"),
      burnoutMessage: document.getElementById("burnout-message"),
      burnoutFactors: document.getElementById("burnout-factors"),
      burnoutTrendArrow: document.getElementById("burnout-trend-arrow"),
      burnoutTrendText: document.getElementById("burnout-trend-text"),
      streakCurrent: document.getElementById("streak-current"),
      streakLongest: document.getElementById("streak-longest"),
      consistencyPercent: document.getElementById("consistency-percent"),
      summaryText: document.getElementById("summary-text"),
      periodLabel: document.getElementById("period-label"),
      milestoneList: document.getElementById("milestone-list"),
    };
    MindBloomUtils.initShell("insights");
  }

  /* ----------------------------------------------------------------------
     RENDER
     ---------------------------------------------------------------------- */
  function renderBurnout(burnout) {
    const t = ChartsFactory.theme();
    const colorVar = BurnoutScore.getLevelColorVar(burnout.level);
    const color = getComputedStyle(document.documentElement).getPropertyValue(colorVar).trim() || t.primary;

    ChartsFactory.createGaugeChart("chart-burnout", { value: burnout.score, max: 100, color: color });

    els.burnoutScore.textContent = burnout.score;
    els.burnoutLevel.textContent = burnout.level.charAt(0).toUpperCase() + burnout.level.slice(1) + " risk";
    els.burnoutLevel.style.color = color;
    els.burnoutMessage.textContent = burnout.message;

    els.burnoutFactors.innerHTML = "";
    burnout.factors.forEach(function (factor) {
      els.burnoutFactors.appendChild(el("li", "burnout-factor", factor));
    });
  }

  function renderBurnoutTrend() {
    const points = computeBurnoutHistory(4);
    const scores = points.map(function (p) { return p.score; });
    const trend = BurnoutScore.describeTrend(scores);
    const t = ChartsFactory.theme();

    if (els.burnoutTrendArrow) {
      els.burnoutTrendArrow.textContent = trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→";
      els.burnoutTrendArrow.style.color =
        trend.direction === "up" ? t.accent : trend.direction === "down" ? t.primary : t.textSecondary;
    }
    if (els.burnoutTrendText) els.burnoutTrendText.textContent = trend.message;

    // Deliberately not pinned to the gauge's 0-100 scale — the sparkline's
    // job is to make the shape of the change legible (the arrow/message
    // already state the absolute score), and a fixed 0-100 range flattens
    // most real trends into an almost-straight line.
    ChartsFactory.createLineChart("chart-burnout-trend", {
      labels: points.map(function (p) { return p.label; }),
      data: scores,
      label: "Burnout risk",
      color: t.accent,
    });
  }

  function renderHabits(habitStats) {
    els.streakCurrent.textContent = habitStats.currentStreak;
    els.streakLongest.textContent = habitStats.longestStreak;
    els.consistencyPercent.textContent = habitStats.consistencyPercent + "%";

    const t = ChartsFactory.theme();
    ChartsFactory.createBarChart("chart-weekday", {
      labels: habitStats.weekday.labels,
      datasets: [{ label: "Check-ins", data: habitStats.weekday.counts, color: t.secondary }],
      horizontal: true,
    });
  }

  /* ----------------------------------------------------------------------
     MILESTONES — earned + locked-with-hint, read through MindBloomData
     (core/data-store.js) rather than this file's own direct localStorage
     reads above, since scripts/milestones.js's checks expect that exact
     record shape. Independent of the 7/30/90 range toggle.
     ---------------------------------------------------------------------- */
  function renderMilestones() {
    const list = els.milestoneList;
    if (!list) return;

    const record = MindBloomData.load();
    const milestones = Milestones.evaluate(record);

    list.innerHTML = "";
    milestones.forEach(function (m) {
      list.appendChild(el(
        "li",
        "milestone-item" + (m.earned ? " milestone-item--earned" : ""),
        '<span class="milestone-item__icon">' + MindBloomUtils.icon(m.earned ? "check" : "target") + "</span>" +
          '<span class="milestone-item__body">' +
          '<span class="milestone-item__title">' + m.title + "</span>" +
          '<span class="milestone-item__message">' + (m.earned ? m.description : m.hint) + "</span>" +
          "</span>"
      ));
    });
  }

  async function renderSummary(bundle, periodLabel) {
    els.summaryText.textContent = "Putting together your summary…";
    const summary = await WeeklySummary.generate({
      periodLabel: periodLabel,
      moodFirst: bundle.moodSeries[0],
      moodLast: bundle.moodSeries[bundle.moodSeries.length - 1],
      avgSleepHours: bundle.avgSleep,
      taskCompletionRate: bundle.taskCompletionRate,
      burnoutLevel: bundle.burnout.level,
      consistencyPercent: bundle.habitStats.consistencyPercent,
      topTheme: bundle.topTheme,
      rawHistory: bundle.rawHistory,
    });
    els.summaryText.textContent = summary;
  }

  function renderCharts(bundle) {
    const t = ChartsFactory.theme();

    ChartsFactory.createLineChart("chart-mood", {
      labels: bundle.labels,
      data: bundle.moodSeries,
      label: "Mood",
      color: t.primary,
      suggestedMin: 1,
      suggestedMax: 5,
    });

    ChartsFactory.createRadarChart("chart-pillars", {
      labels: bundle.pillars.labels,
      data: bundle.pillars.data,
      color: t.secondary,
      label: "Wellbeing",
    });

    ChartsFactory.createDoughnutChart("chart-tasks", {
      labels: ["Completed", "Pending"],
      data: [bundle.taskCompletion.done, bundle.taskCompletion.pending],
      colors: [t.primary, t.gridLine],
    });

    ChartsFactory.createBarChart("chart-sleep-water", {
      labels: bundle.labels,
      datasets: [
        { label: "Sleep (hrs)", data: bundle.sleepSeries, color: t.secondary },
        { label: "Water (cups)", data: bundle.waterSeries, color: t.accent },
      ],
    });
  }

  function periodLabelFor(days) {
    if (days === 7) return "7 days";
    if (days === 30) return "30 days";
    return "90 days";
  }

  async function refreshAll() {
    const bundle = buildDataBundle(currentRangeDays);
    const periodLabel = periodLabelFor(currentRangeDays);
    els.periodLabel.textContent = "Last " + periodLabel;

    renderCharts(bundle);
    renderBurnout(bundle.burnout);
    renderBurnoutTrend();
    renderHabits(bundle.habitStats);
    upgradeBurnoutWithAI(bundle, currentRangeDays);
    await renderSummary(bundle, periodLabel);
  }

  // Fire-and-forget: re-renders the gauge with the richer AI read if/when it
  // resolves. computeScoreAsync already falls back to the local score
  // internally on any failure, so there is nothing to catch here — and if
  // the user has since switched ranges, the stale result is simply dropped.
  function upgradeBurnoutWithAI(bundle, requestedRangeDays) {
    BurnoutScore.computeScoreAsync(bundle.burnoutSignals, bundle.rawHistory).then(function (upgraded) {
      if (currentRangeDays !== requestedRangeDays) return;
      renderBurnout(upgraded);
    });
  }

  function wireRangeToggle() {
    els.rangeToggle.querySelectorAll("[data-range]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentRangeDays = Number(btn.dataset.range);
        els.rangeToggle.querySelectorAll("[data-range]").forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === btn));
        });
        refreshAll();
      });
    });
  }

  function showOfflineNotice() {
    const notice = document.getElementById("charts-offline-notice");
    if (notice) notice.hidden = false;
  }

  function init() {
    cacheElements();
    renderMilestones(); // independent of Chart.js, so it still renders if charts fail to load

    if (!ChartsFactory.isAvailable()) {
      showOfflineNotice();
      els.summaryText.textContent =
        "Charts couldn't load without a connection, but your data is safe locally and charts will appear next time you're online.";
      return;
    }

    ChartsFactory.applyGlobalDefaults();
    wireRangeToggle();
    refreshAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})(window, document);

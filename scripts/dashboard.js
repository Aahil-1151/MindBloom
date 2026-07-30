/* ==========================================================================
   MindBloom — dashboard.js
   Home Dashboard controller. Renders Sidebar/Bottom-Nav active state,
   Header, Wellbeing Score, Today's Summary, Quick Actions, Tips for You,
   Daily Motivation, Recent Activity, and Upcoming Tasks.

   Data model: every section reads through MindBloomData (core/data-store.js)
   — the same shared, per-user record that physical.html and journal.html
   write to when someone logs a mood, sleep/water/activity check-in, a
   stress check-in, or a journal entry. That means logging something on
   another page shows up here immediately on the next load: Today's
   Summary, Recent Activity, the wellbeing pillars, and the Tips card are
   all *derived* from those logs, never hand-maintained here. Nothing is
   pre-seeded — a new signup starts with every log empty and every section
   in its honest empty state until the person actually logs something.
   ========================================================================== */

(function (window) {
  "use strict";

  /* ======================================================================
     STATIC APP DATA — chrome that isn't tied to any one user's history
     ====================================================================== */
  const PILLARS_META = [
    { key: "physical", label: "Physical", color: "var(--color-primary)" },
    { key: "mental", label: "Mental", color: "var(--color-secondary)" },
    { key: "emotional", label: "Emotional", color: "var(--color-celebrate)" },
    { key: "academic", label: "Academic", color: "var(--color-accent)" },
  ];

  const QUICK_ACTIONS = [
    { icon: "mood-good", label: "Log Mood", href: "physical.html#mood" },
    { icon: "edit", label: "Journal", href: "journal.html" },
    { icon: "wind", label: "Breathe", href: "physical.html#mental" },
    { icon: "clock", label: "Focus", href: "planner.html" },
  ];

  const MOTIVATION_QUOTES = [
    "Small steps, repeated daily, beat big leaps taken rarely.",
    "You don't have to feel motivated to make progress today.",
    "Rest is part of the work, not a break from it.",
    "One honest check-in with yourself is worth ten ignored ones.",
    "Progress in any one area lifts the rest — start anywhere.",
    "You're allowed to have an average day and still be doing great.",
  ];

  const DASHBOARD_DATA = {
    user: { name: "there" },
    quickActions: QUICK_ACTIONS,
    motivationQuotes: MOTIVATION_QUOTES,
  };

  /* ======================================================================
     SHARED DATA — loaded fresh at init from MindBloomData (core/data-store.js)
     ====================================================================== */
  let record = null;

  /* ======================================================================
     HELPERS
     ====================================================================== */
  function qs(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  const el = MindBloomUtils.el;

  function getGreeting(name) {
    const hour = new Date().getHours();
    let timeGreeting = "Good evening";
    if (hour < 12) timeGreeting = "Good morning";
    else if (hour < 18) timeGreeting = "Good afternoon";
    return timeGreeting + ", " + name;
  }

  function getFormattedDate() {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  function buildTodaySummary() {
    const summary = MindBloomData.computeTodaySummary(record);
    return [
      { icon: "mood-good", value: summary.mood || "Not logged", label: "Mood today" },
      {
        icon: "moon",
        value: summary.sleepHours ? summary.sleepHours + "h" : "Not logged",
        label: "Sleep (goal " + summary.sleepGoal + "h)",
      },
      { icon: "droplet", value: summary.waterCups + " / " + summary.waterGoal, label: "Water cups" },
      { icon: "check", value: summary.tasksDone + " / " + summary.tasksTotal, label: "Tasks done" },
    ];
  }

  /* ======================================================================
     RENDER: HEADER
     ====================================================================== */
  function renderHeader() {
    const greetingEl = qs("#header-greeting");
    const dateEl = qs("#header-date");
    const avatarEl = qs("#header-avatar");

    if (greetingEl) greetingEl.textContent = getGreeting(DASHBOARD_DATA.user.name);
    if (dateEl) dateEl.textContent = getFormattedDate();
    if (avatarEl) avatarEl.textContent = DASHBOARD_DATA.user.name.charAt(0).toUpperCase();
  }

  /* ======================================================================
     RENDER: WELLBEING SCORE (circular ring + pillar breakdown)
     ====================================================================== */
  function computeOverallScore(pillarScores) {
    const tracked = PILLARS_META.map(function (p) {
      return pillarScores[p.key];
    }).filter(function (score) {
      return typeof score === "number";
    });
    if (!tracked.length) return null;
    const total = tracked.reduce(function (sum, s) {
      return sum + s;
    }, 0);
    return Math.round(total / tracked.length);
  }

  function scoreMessage(score) {
    if (score === null) return "Log a mood, task, or journal entry to start building your wellbeing score.";
    if (score >= 85) return "You're thriving across the board. Keep it up!";
    if (score >= 70) return "Solid balance today — one or two areas need attention.";
    if (score >= 50) return "A mixed day. Let's shore up the lower-scoring areas.";
    return "Things feel heavy right now. Let's take it one pillar at a time.";
  }

  function renderWellbeingScore() {
    const pillars = MindBloomData.computePillars(record);
    const score = computeOverallScore(pillars);
    const numberEl = qs("#wellbeing-score-number");
    const messageEl = qs("#wellbeing-score-message");
    const breakdownEl = qs("#wellbeing-breakdown");
    const ringFill = qs("#wellbeing-ring-fill");

    if (messageEl) messageEl.textContent = scoreMessage(score);

    // Animate the ring fill (an untracked score just sits at an empty ring)
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const displayScore = score === null ? 0 : score;
    if (ringFill) {
      ringFill.style.strokeDasharray = circumference.toFixed(2);
      ringFill.style.strokeDashoffset = circumference.toFixed(2);
      // force reflow, then animate to target offset
      requestAnimationFrame(function () {
        const offset = circumference * (1 - displayScore / 100);
        ringFill.style.transition = "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)";
        ringFill.style.strokeDashoffset = offset.toFixed(2);
      });
    }

    // Animate the number counting up (or show a placeholder when untracked)
    if (numberEl) {
      if (score === null) {
        numberEl.textContent = "--";
      } else {
        let current = 0;
        const step = Math.max(1, Math.round(score / 30));
        const counter = setInterval(function () {
          current = Math.min(score, current + step);
          numberEl.textContent = current;
          if (current >= score) clearInterval(counter);
        }, 20);
      }
    }

    if (breakdownEl) {
      breakdownEl.innerHTML = "";
      PILLARS_META.forEach(function (pillar) {
        const pillarScore = pillars[pillar.key];
        const pill = el(
          "span",
          "wellbeing-pill",
          '<span class="wellbeing-pill__dot" style="background:' +
            pillar.color +
            '"></span>' +
            pillar.label +
            " " +
            (typeof pillarScore === "number" ? pillarScore : "—")
        );
        breakdownEl.appendChild(pill);
      });
    }
  }

  /* ======================================================================
     RENDER: TODAY'S SUMMARY
     ====================================================================== */
  function renderSummary() {
    const grid = qs("#summary-grid");
    if (!grid) return;
    grid.innerHTML = "";

    buildTodaySummary().forEach(function (stat, index) {
      const card = el(
        "div",
        "card summary-stat anim-stagger",
        '<div class="summary-stat__top">' +
          '<span class="summary-stat__icon">' + MindBloomUtils.icon(stat.icon) + "</span>" +
          '<span class="summary-stat__value">' + stat.value + "</span>" +
          "</div>" +
          '<span class="summary-stat__label">' + stat.label + "</span>"
      );
      card.style.setProperty("--delay", index * 60 + "ms");
      grid.appendChild(card);
    });
  }

  /* ======================================================================
     RENDER: QUICK ACTIONS
     ====================================================================== */
  function renderQuickActions() {
    const row = qs("#quick-actions");
    if (!row) return;
    row.innerHTML = "";

    DASHBOARD_DATA.quickActions.forEach(function (action) {
      const button = el(
        "button",
        "quick-action pressable",
        '<span class="quick-action__icon">' + MindBloomUtils.icon(action.icon) + "</span>" +
          '<span class="quick-action__label">' + action.label + "</span>"
      );
      button.type = "button";
      button.addEventListener("click", function () {
        MindBloomUtils.showToast("Opening " + action.label + "…", "success");
        setTimeout(function () {
          window.location.href = action.href;
        }, 450);
      });
      row.appendChild(button);
    });
  }

  /* ======================================================================
     RENDER: TIPS FOR YOU — short, data-driven nudges derived from the
     last 7 days of logs (see MindBloomData.computeTips). Nothing shows
     until there's real history to reason about.
     ====================================================================== */
  function renderTips() {
    const list = qs("#tips-list");
    const emptyState = qs("#tips-empty");
    if (!list) return;
    list.innerHTML = "";

    const tips = MindBloomData.computeTips(record);
    const isEmpty = !tips.length;
    if (emptyState) emptyState.hidden = !isEmpty;
    list.hidden = isEmpty;
    if (isEmpty) return;

    tips.forEach(function (tip, index) {
      const item = el(
        "li",
        "tip-item tip-item--" + tip.level + " anim-stagger",
        '<span class="tip-item__icon">' + MindBloomUtils.icon(tip.icon) + "</span>" +
          '<span class="tip-item__body">' +
          '<span class="tip-item__title">' + tip.title + "</span>" +
          '<span class="tip-item__message">' + tip.message + "</span>" +
          "</span>"
      );
      item.style.setProperty("--delay", index * 60 + "ms");
      list.appendChild(item);
    });
  }

  /* ======================================================================
     RENDER: DAILY MOTIVATION
     ====================================================================== */
  function pickQuote(excludeIndex) {
    const quotes = DASHBOARD_DATA.motivationQuotes;
    let index = Math.floor(Math.random() * quotes.length);
    if (quotes.length > 1) {
      while (index === excludeIndex) {
        index = Math.floor(Math.random() * quotes.length);
      }
    }
    return index;
  }

  function renderMotivation() {
    const quoteEl = qs("#motivation-quote");
    const refreshBtn = qs("#motivation-refresh");
    if (!quoteEl) return;

    let currentIndex = new Date().getDate() % DASHBOARD_DATA.motivationQuotes.length;
    quoteEl.textContent = DASHBOARD_DATA.motivationQuotes[currentIndex];

    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        currentIndex = pickQuote(currentIndex);
        quoteEl.classList.remove("anim-fade-in");
        void quoteEl.offsetWidth; // restart animation
        quoteEl.classList.add("anim-fade-in");
        quoteEl.textContent = DASHBOARD_DATA.motivationQuotes[currentIndex];
      });
    }
  }

  /* ======================================================================
     RENDER: RECENT ACTIVITY — a merged, most-recent-first feed built from
     every log type (mood/physical/stress/journal/tasks), not a separately
     stored list.
     ====================================================================== */
  function renderActivity() {
    const list = qs("#activity-list");
    const emptyState = qs("#activity-empty");
    if (!list) return;
    list.innerHTML = "";

    const activity = MindBloomData.computeRecentActivity(record, 6);
    const isEmpty = !activity.length;
    if (emptyState) emptyState.hidden = !isEmpty;
    list.hidden = isEmpty;
    if (isEmpty) return;

    activity.forEach(function (item, index) {
      const li = el(
        "li",
        "activity-item anim-stagger",
        '<span class="activity-item__icon">' + MindBloomUtils.icon(item.icon) + "</span>" +
          '<span class="activity-item__text">' + item.text + "</span>" +
          '<span class="activity-item__time">' + item.time + "</span>"
      );
      li.style.setProperty("--delay", index * 50 + "ms");
      list.appendChild(li);
    });
  }

  /* ======================================================================
     RENDER: UPCOMING TASKS (interactive — toggling persists through
     MindBloomData.toggleTask and re-renders the summary + activity feed)
     ====================================================================== */
  function renderTasks() {
    const list = qs("#task-list");
    const emptyState = qs("#task-empty");
    if (!list) return;
    list.innerHTML = "";

    const isEmpty = !record.upcomingTasks.length;
    if (emptyState) emptyState.hidden = !isEmpty;
    list.hidden = isEmpty;
    if (isEmpty) return;

    const sorted = MindBloomData.sortTasksForDisplay(record.upcomingTasks).slice(0, 6);
    sorted.forEach(function (task, index) {
      const li = el("li", "task-item anim-stagger" + (task.done ? " task-item--done" : ""));
      li.style.setProperty("--delay", index * 50 + "ms");

      const checkbox = el("button", "checkbox task-item__checkbox");
      checkbox.type = "button";
      checkbox.setAttribute("role", "checkbox");
      checkbox.setAttribute("aria-checked", String(task.done));
      checkbox.setAttribute("aria-label", "Mark '" + task.title + "' as done");
      if (task.done) checkbox.innerHTML = MindBloomUtils.icon("check", "icon--sm");

      checkbox.addEventListener("click", function () {
        record = MindBloomData.toggleTask(task.id);
        const toggled = record.upcomingTasks.find(function (t) {
          return t.id === task.id;
        });
        renderTasks();
        renderSummary();
        renderActivity();
        renderWellbeingScore();
        MindBloomUtils.showToast(
          toggled && toggled.done ? "Nice work — task complete!" : "Marked as not done yet.",
          toggled && toggled.done ? "success" : null
        );
      });

      const metaParts = [];
      if (task.subject) metaParts.push(task.subject);
      metaParts.push(MindBloomData.formatTaskDue(task.due));

      const body = el(
        "div",
        "task-item__body",
        '<div class="task-item__title">' + task.title + "</div>" +
          '<div class="task-item__meta">' + metaParts.join(" • ") + "</div>"
      );

      const priority = el(
        "span",
        "task-item__priority task-item__priority--" + task.priority,
        task.priority.charAt(0).toUpperCase() + task.priority.slice(1)
      );

      li.appendChild(checkbox);
      li.appendChild(body);
      li.appendChild(priority);
      list.appendChild(li);
    });
  }

  /* ======================================================================
     NAV STATE + LOGOUT — delegated to the shared shell wiring in
     core/utils.js (marks the active sidebar/bottom-nav item, wires
     logout, and redirects to login.html if there's no session).
     ====================================================================== */
  function applyRealUserIfSignedIn() {
    if (window.AuthService && typeof window.AuthService.getSession === "function") {
      const session = window.AuthService.getSession();
      if (session && session.name) {
        DASHBOARD_DATA.user.name = session.name.split(" ")[0];
      }
    }
  }

  /* ======================================================================
     INIT
     ====================================================================== */
  function init() {
    record = MindBloomData.load();
    applyRealUserIfSignedIn();
    renderHeader();
    renderWellbeingScore();
    renderSummary();
    renderQuickActions();
    renderTips();
    renderMotivation();
    renderActivity();
    renderTasks();
    MindBloomUtils.initShell("home");
  }

  window.MindBloomDashboard = {
    init: init,
    get record() {
      return record;
    },
  };
})(window);

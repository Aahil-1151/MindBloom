/* ==========================================================================
   MindBloom — dashboard.js
   Home Dashboard controller. Renders Sidebar/Bottom-Nav active state,
   Header, Wellbeing Score, Today's Summary, Quick Actions, Daily
   Motivation, Recent Activity, and Upcoming Tasks — all from an in-memory
   dummy dataset (DASHBOARD_DATA below). No backend or storage service is
   required to see a fully working dashboard.

   Swap point for later: replace the DASHBOARD_DATA block and the reads
   inside render*() functions with calls to the real services
   (moodService, academicService, insightsService, etc.) — the render
   functions themselves already expect this exact shape, so the DOM code
   does not need to change.
   ========================================================================== */

(function (window) {
  "use strict";

  /* ======================================================================
     DUMMY DATA — stands in for services/*.js + insightsService.js
     ====================================================================== */
  const DASHBOARD_DATA = {
    user: {
      name: "Alex",
    },

    pillars: [
      { key: "physical", label: "Physical", score: 82, color: "var(--color-primary)" },
      { key: "mental", label: "Mental", score: 68, color: "var(--color-secondary)" },
      { key: "emotional", label: "Emotional", score: 90, color: "var(--color-celebrate)" },
      { key: "academic", label: "Academic", score: 74, color: "var(--color-accent)" },
    ],

    todaySummary: [
      { icon: "mood-good", value: "Good", label: "Mood today" },
      { icon: "moon", value: "7.5h", label: "Sleep (goal 8h)" },
      { icon: "droplet", value: "5 / 8", label: "Water cups" },
      { icon: "check", value: "3 / 5", label: "Tasks done" },
    ],

    quickActions: [
      { icon: "mood-good", label: "Log Mood", href: "physical.html#mood" },
      { icon: "edit", label: "Journal", href: "journal.html" },
      { icon: "wind", label: "Breathe", href: "physical.html#mental" },
      { icon: "clock", label: "Focus", href: "planner.html" },
    ],

    motivationQuotes: [
      "Small steps, repeated daily, beat big leaps taken rarely.",
      "You don't have to feel motivated to make progress today.",
      "Rest is part of the work, not a break from it.",
      "One honest check-in with yourself is worth ten ignored ones.",
      "Progress in any one area lifts the rest — start anywhere.",
      "You're allowed to have an average day and still be doing great.",
    ],

    recentActivity: [
      { icon: "mood-good", text: "You logged your mood as Good", time: "2h ago" },
      { icon: "check", text: 'Completed "Finish chem lab report"', time: "4h ago" },
      { icon: "edit", text: "Wrote a journal entry", time: "Yesterday" },
      { icon: "droplet", text: "Logged 6 cups of water", time: "Yesterday" },
      { icon: "wind", text: "Completed a 5-minute breathing session", time: "2 days ago" },
    ],

    upcomingTasks: [
      {
        id: "t1",
        title: "Submit History essay",
        subject: "History",
        due: "Today, 11:59 PM",
        priority: "high",
        done: false,
      },
      {
        id: "t2",
        title: "Math problem set 4",
        subject: "Math",
        due: "Tomorrow",
        priority: "medium",
        done: false,
      },
      {
        id: "t3",
        title: "Read Chapter 6",
        subject: "Biology",
        due: "Friday",
        priority: "low",
        done: false,
      },
      {
        id: "t4",
        title: "Group project check-in",
        subject: "Computer Science",
        due: "Monday",
        priority: "medium",
        done: true,
      },
    ],
  };

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
  function computeOverallScore(pillars) {
    const total = pillars.reduce(function (sum, p) {
      return sum + p.score;
    }, 0);
    return Math.round(total / pillars.length);
  }

  function scoreMessage(score) {
    if (score >= 85) return "You're thriving across the board. Keep it up!";
    if (score >= 70) return "Solid balance today — one or two areas need attention.";
    if (score >= 50) return "A mixed day. Let's shore up the lower-scoring areas.";
    return "Things feel heavy right now. Let's take it one pillar at a time.";
  }

  function renderWellbeingScore() {
    const score = computeOverallScore(DASHBOARD_DATA.pillars);
    const numberEl = qs("#wellbeing-score-number");
    const messageEl = qs("#wellbeing-score-message");
    const breakdownEl = qs("#wellbeing-breakdown");
    const ringFill = qs("#wellbeing-ring-fill");

    if (messageEl) messageEl.textContent = scoreMessage(score);

    // Animate the ring fill
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    if (ringFill) {
      ringFill.style.strokeDasharray = circumference.toFixed(2);
      ringFill.style.strokeDashoffset = circumference.toFixed(2);
      // force reflow, then animate to target offset
      requestAnimationFrame(function () {
        const offset = circumference * (1 - score / 100);
        ringFill.style.transition = "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)";
        ringFill.style.strokeDashoffset = offset.toFixed(2);
      });
    }

    // Animate the number counting up
    if (numberEl) {
      let current = 0;
      const step = Math.max(1, Math.round(score / 30));
      const counter = setInterval(function () {
        current = Math.min(score, current + step);
        numberEl.textContent = current;
        if (current >= score) clearInterval(counter);
      }, 20);
    }

    if (breakdownEl) {
      breakdownEl.innerHTML = "";
      DASHBOARD_DATA.pillars.forEach(function (pillar) {
        const pill = el(
          "span",
          "wellbeing-pill",
          '<span class="wellbeing-pill__dot" style="background:' +
            pillar.color +
            '"></span>' +
            pillar.label +
            " " +
            pillar.score
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

    DASHBOARD_DATA.todaySummary.forEach(function (stat, index) {
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
     RENDER: RECENT ACTIVITY
     ====================================================================== */
  function renderActivity() {
    const list = qs("#activity-list");
    if (!list) return;
    list.innerHTML = "";

    DASHBOARD_DATA.recentActivity.forEach(function (item, index) {
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
     RENDER: UPCOMING TASKS (interactive — toggling persists in memory
     for this session and re-renders the wellbeing score's academic pillar)
     ====================================================================== */
  function renderTasks() {
    const list = qs("#task-list");
    if (!list) return;
    list.innerHTML = "";

    DASHBOARD_DATA.upcomingTasks.forEach(function (task, index) {
      const li = el("li", "task-item anim-stagger" + (task.done ? " task-item--done" : ""));
      li.style.setProperty("--delay", index * 50 + "ms");

      const checkbox = el("button", "checkbox task-item__checkbox");
      checkbox.type = "button";
      checkbox.setAttribute("role", "checkbox");
      checkbox.setAttribute("aria-checked", String(task.done));
      checkbox.setAttribute("aria-label", "Mark '" + task.title + "' as done");
      if (task.done) checkbox.innerHTML = MindBloomUtils.icon("check", "icon--sm");

      checkbox.addEventListener("click", function () {
        task.done = !task.done;
        renderTasks();
        renderSummary();
        MindBloomUtils.showToast(
          task.done ? "Nice work — task complete!" : "Marked as not done yet.",
          task.done ? "success" : null
        );
      });

      const body = el(
        "div",
        "task-item__body",
        '<div class="task-item__title">' + task.title + "</div>" +
          '<div class="task-item__meta">' + task.subject + " • " + task.due + "</div>"
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
    applyRealUserIfSignedIn();
    renderHeader();
    renderWellbeingScore();
    renderSummary();
    renderQuickActions();
    renderMotivation();
    renderActivity();
    renderTasks();
    MindBloomUtils.initShell("home");
  }

  window.MindBloomDashboard = { init: init, DASHBOARD_DATA: DASHBOARD_DATA };
})(window);

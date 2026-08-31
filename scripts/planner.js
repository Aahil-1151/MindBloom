/* ==========================================================================
   MindBloom — planner.js
   Smart Planner controller (planner.html): the calendar, the Focus Card
   suggestion, the Workload Meter, and the task list + add/edit modal.
   Tasks are read and written through TaskManager -> MindBloomData
   (core/data-store.js) — the same shared, per-user record the dashboard's
   Upcoming Tasks card reads, so adding or checking off a task here shows
   up there immediately too.
   ========================================================================== */

(function (window, document) {
  "use strict";

  function qs(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  const el = MindBloomUtils.el;

  let tasks = [];
  let currentMonth = new Date();
  let selectedKey = Calendar.toDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  let viewMode = "day"; // "day" | "upcoming"
  let editingTaskId = null;

  function refresh() {
    tasks = TaskManager.getAll();
  }

  /* ======================================================================
     CALENDAR
     ====================================================================== */
  function renderCalendar() {
    Calendar.render(qs("#calendar-container"), {
      monthDate: currentMonth,
      selectedKey: selectedKey,
      markedCounts: TaskManager.datesWithTasks(tasks),
      onSelect: function (dateKey) {
        selectedKey = dateKey;
        renderCalendar();
        if (viewMode === "day") renderTaskList();
      },
      onMonthChange: function (newMonth) {
        currentMonth = newMonth;
        renderCalendar();
      },
    });
  }

  /* ======================================================================
     FOCUS CARD
     ====================================================================== */
  function renderFocusCard() {
    const card = qs("#focus-card");
    if (!card) return;
    const suggestion = PriorityEngine.suggestFocusTask(tasks);

    if (!suggestion) {
      card.innerHTML =
        '<span class="focus-card__icon">' +
        MindBloomUtils.icon("check") +
        "</span>" +
        '<div><p class="focus-card__label">Focus</p>' +
        '<p class="focus-card__title">You\'re all caught up</p>' +
        '<p class="focus-card__rationale">Add a task to get a suggestion for what to tackle next.</p></div>';
      return;
    }

    card.innerHTML =
      '<span class="focus-card__icon">' +
      MindBloomUtils.icon("target") +
      "</span>" +
      '<div><p class="focus-card__label">Focus next</p>' +
      '<p class="focus-card__title">' +
      suggestion.task.title +
      "</p>" +
      '<p class="focus-card__rationale">' +
      suggestion.rationale +
      "</p></div>";
  }

  /* ======================================================================
     FOCUS TIMER (Pomodoro) — defaults to PriorityEngine.suggestFocusTask's
     pick; completed focus sessions log to MindBloomData.addFocusSession so
     they can feed Recent Activity and, eventually, Analytics.
     ====================================================================== */
  const timer = {
    mode: "focus", // "focus" | "break"
    running: false,
    remainingSeconds: 25 * 60,
    intervalId: null,
    targetTask: null, // captured at "Start focus", not re-read mid-session
  };

  function timerModeSeconds(mode) {
    const input = qs(mode === "focus" ? "#timer-focus-minutes" : "#timer-break-minutes");
    const minutes = parseInt(input.value, 10) || (mode === "focus" ? 25 : 5);
    return minutes * 60;
  }

  function formatTimerClock(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function renderTimer() {
    qs("#timer-display").textContent = formatTimerClock(timer.remainingSeconds);
    qs("#timer-mode-label").textContent = timer.mode === "focus" ? "Focus session" : "Break";

    const targetLabel = qs("#timer-target-label");
    if (timer.mode === "break") {
      targetLabel.textContent = "Take a breather — back to it after this.";
    } else if (timer.targetTask) {
      targetLabel.textContent = timer.targetTask.title;
    } else {
      const suggestion = PriorityEngine.suggestFocusTask(tasks);
      targetLabel.textContent = suggestion ? suggestion.task.title : "Add a task to get started";
    }

    const toggleBtn = qs("#timer-toggle-btn");
    if (timer.running) {
      toggleBtn.textContent = "Pause";
    } else if (timer.remainingSeconds === timerModeSeconds(timer.mode)) {
      toggleBtn.textContent = timer.mode === "focus" ? "Start focus" : "Start break";
    } else {
      toggleBtn.textContent = "Resume";
    }
  }

  function completeTimerInterval() {
    clearInterval(timer.intervalId);
    timer.intervalId = null;
    timer.running = false;

    if (timer.mode === "focus") {
      MindBloomData.addFocusSession({
        taskId: timer.targetTask ? timer.targetTask.id : null,
        taskTitle: timer.targetTask ? timer.targetTask.title : "",
        durationMinutes: timerModeSeconds("focus") / 60,
      });
      MindBloomUtils.showToast("Focus session complete — nice work!", "success");
      timer.mode = "break";
      timer.targetTask = null;
    } else {
      MindBloomUtils.showToast("Break's over — ready for another round?");
      timer.mode = "focus";
    }
    timer.remainingSeconds = timerModeSeconds(timer.mode);
    renderTimer();
  }

  function tickTimer() {
    timer.remainingSeconds -= 1;
    if (timer.remainingSeconds <= 0) {
      completeTimerInterval();
      return;
    }
    renderTimer();
  }

  function toggleTimer() {
    if (timer.running) {
      clearInterval(timer.intervalId);
      timer.intervalId = null;
      timer.running = false;
      renderTimer();
      return;
    }

    if (timer.mode === "focus" && !timer.targetTask) {
      const suggestion = PriorityEngine.suggestFocusTask(tasks);
      timer.targetTask = suggestion ? suggestion.task : null;
    }

    timer.running = true;
    timer.intervalId = setInterval(tickTimer, 1000);
    renderTimer();
  }

  function resetTimer() {
    clearInterval(timer.intervalId);
    timer.intervalId = null;
    timer.running = false;
    timer.mode = "focus";
    timer.targetTask = null;
    timer.remainingSeconds = timerModeSeconds("focus");
    renderTimer();
  }

  function wireFocusTimer() {
    qs("#timer-toggle-btn").addEventListener("click", toggleTimer);
    qs("#timer-reset-btn").addEventListener("click", resetTimer);

    ["#timer-focus-minutes", "#timer-break-minutes"].forEach(function (selector) {
      qs(selector).addEventListener("change", function () {
        if (timer.running) return;
        timer.remainingSeconds = timerModeSeconds(timer.mode);
        renderTimer();
      });
    });
  }

  /* ======================================================================
     WORKLOAD METER
     ====================================================================== */
  const WORKLOAD_COLOR = {
    light: "var(--color-primary)",
    moderate: "var(--color-gold-500)",
    heavy: "var(--color-coral-500)",
  };

  function renderWorkload() {
    const meter = qs("#workload-meter");
    if (!meter) return;
    const workload = PriorityEngine.computeWorkload(tasks);

    meter.innerHTML =
      '<div class="workload-meter__row">' +
      '<span class="workload-meter__dot" style="background:' +
      WORKLOAD_COLOR[workload.level] +
      '"></span>' +
      '<span class="workload-meter__label">' +
      workload.label +
      " workload</span>" +
      "</div>" +
      '<p class="workload-meter__message">' +
      workload.message +
      "</p>";
  }

  /* ======================================================================
     TASK LIST
     ====================================================================== */
  function selectedDateLabel() {
    const todayKey = Calendar.toDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    if (selectedKey === todayKey) return "Today";
    const parts = selectedKey.split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }

  function renderListHeading() {
    const heading = qs("#list-heading");
    if (!heading) return;
    heading.textContent = viewMode === "day" ? selectedDateLabel() : "All Upcoming";
  }

  function tasksForCurrentView() {
    if (viewMode === "day") {
      return TaskManager.upcoming(TaskManager.forDate(tasks, selectedKey));
    }
    return TaskManager.upcoming(tasks);
  }

  function renderTaskList() {
    renderListHeading();
    const list = qs("#task-list");
    const emptyState = qs("#task-empty");
    if (!list) return;
    list.innerHTML = "";

    const visible = tasksForCurrentView();
    const isEmpty = !visible.length;
    if (emptyState) {
      emptyState.hidden = !isEmpty;
      const heading = emptyState.querySelector("h3");
      const body = emptyState.querySelector("p");
      if (isEmpty && viewMode === "day") {
        if (heading) heading.textContent = "Nothing here";
        if (body) body.textContent = "Tap the + button to add a task for this day.";
      } else if (isEmpty) {
        if (heading) heading.textContent = "No tasks yet";
        if (body) body.textContent = "Tap the + button to add your first task.";
      }
    }
    list.hidden = isEmpty;
    if (isEmpty) return;

    visible.forEach(function (task, index) {
      const metaParts = [];
      if (task.subject) metaParts.push(task.subject);
      metaParts.push(MindBloomData.formatTaskDue(task.due));
      if (task.estimatedMinutes) metaParts.push("~" + task.estimatedMinutes + " min");

      const li = el("li", "planner-task card anim-stagger" + (task.done ? " planner-task--done" : ""));
      li.style.setProperty("--delay", index * 40 + "ms");

      const checkbox = el("button", "checkbox");
      checkbox.type = "button";
      checkbox.setAttribute("role", "checkbox");
      checkbox.setAttribute("aria-checked", String(task.done));
      checkbox.setAttribute("aria-label", "Mark '" + task.title + "' as done");
      if (task.done) checkbox.innerHTML = MindBloomUtils.icon("check", "icon--sm");
      checkbox.addEventListener("click", function () {
        TaskManager.toggle(task.id);
        refresh();
        renderTaskList();
        renderFocusCard();
        renderTimer();
        renderWorkload();
        renderCalendar();
        MindBloomUtils.showToast(!task.done ? "Nice work — task complete!" : "Marked as not done yet.", !task.done ? "success" : null);
      });

      const body = el(
        "div",
        "planner-task__body",
        '<div class="planner-task__title">' +
          task.title +
          "</div>" +
          '<div class="planner-task__meta">' +
          metaParts.join(" • ") +
          "</div>"
      );

      const actions = el(
        "div",
        "planner-task__actions",
        '<span class="chip planner-task__priority planner-task__priority--' +
          task.priority +
          '">' +
          task.priority.charAt(0).toUpperCase() +
          task.priority.slice(1) +
          "</span>"
      );

      const editBtn = el("button", "btn btn--icon", MindBloomUtils.icon("edit", "icon--sm"));
      editBtn.type = "button";
      editBtn.setAttribute("aria-label", "Edit task");
      editBtn.addEventListener("click", function () {
        openModal(task);
      });

      const deleteBtn = el("button", "btn btn--icon", MindBloomUtils.icon("trash", "icon--sm"));
      deleteBtn.type = "button";
      deleteBtn.setAttribute("aria-label", "Delete task");
      deleteBtn.addEventListener("click", function () {
        TaskManager.remove(task.id);
        refresh();
        renderTaskList();
        renderFocusCard();
        renderTimer();
        renderWorkload();
        renderCalendar();
        MindBloomUtils.showToast("Task deleted.", null);
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      li.appendChild(checkbox);
      li.appendChild(body);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  function wireViewToggle() {
    document.querySelectorAll("#view-toggle .chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        viewMode = btn.dataset.view;
        document.querySelectorAll("#view-toggle .chip").forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === btn));
        });
        renderTaskList();
      });
    });
  }

  /* ======================================================================
     ADD / EDIT MODAL
     ====================================================================== */
  function openModal(task) {
    editingTaskId = task ? task.id : null;
    qs("#modal-title").textContent = task ? "Edit task" : "New task";
    qs("#task-title").value = task ? task.title : "";
    qs("#task-subject").value = task ? task.subject || "" : "";
    qs("#task-due").value = task ? task.due || "" : selectedKey;
    qs("#task-priority").value = task ? task.priority : "medium";
    qs("#task-minutes").value = task ? task.estimatedMinutes || 30 : 30;
    qs("#task-notes").value = task ? task.notes || "" : "";
    qs("#task-modal-overlay").hidden = false;
  }

  function closeModal() {
    qs("#task-modal-overlay").hidden = true;
    qs("#task-form").reset();
    editingTaskId = null;
  }

  function wireModal() {
    const addBtn = qs("#add-task-btn");
    const cancelBtn = qs("#modal-cancel");
    const overlay = qs("#task-modal-overlay");
    const form = qs("#task-form");

    if (addBtn) addBtn.addEventListener("click", function () { openModal(null); });
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
    if (overlay) {
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closeModal();
      });
    }

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        const payload = {
          title: qs("#task-title").value.trim(),
          subject: qs("#task-subject").value.trim(),
          due: qs("#task-due").value,
          priority: qs("#task-priority").value,
          estimatedMinutes: parseInt(qs("#task-minutes").value, 10) || null,
          notes: qs("#task-notes").value.trim(),
        };
        if (!payload.title || !payload.due) {
          MindBloomUtils.showToast("A title and due date are required.", "error");
          return;
        }

        if (editingTaskId) {
          TaskManager.update(editingTaskId, payload);
          MindBloomUtils.showToast("Task updated.", "success");
        } else {
          TaskManager.add(payload);
          MindBloomUtils.showToast("Task added.", "success");
        }

        refresh();
        closeModal();
        renderCalendar();
        renderFocusCard();
        renderTimer();
        renderWorkload();
        renderTaskList();
      });
    }
  }

  /* ======================================================================
     INIT
     ====================================================================== */
  function init() {
    refresh();
    renderCalendar();
    renderFocusCard();
    renderTimer();
    wireFocusTimer();
    renderWorkload();
    wireViewToggle();
    renderTaskList();
    wireModal();
    MindBloomUtils.initShell("academic");
  }

  window.MindBloomPlanner = { init: init };

  document.addEventListener("DOMContentLoaded", init);
})(window, document);

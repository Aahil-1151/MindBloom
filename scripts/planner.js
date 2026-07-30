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
    renderWorkload();
    wireViewToggle();
    renderTaskList();
    wireModal();
    MindBloomUtils.initShell("academic");
  }

  window.MindBloomPlanner = { init: init };

  document.addEventListener("DOMContentLoaded", init);
})(window, document);

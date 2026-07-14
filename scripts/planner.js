/* ==========================================================================
   MindBloom — planner.js
   Page controller for planner.html. Wires TaskManager (data),
   PriorityEngine (intelligence), and MindBloomCalendar (calendar UI)
   together, and owns rendering for the focus card, workload meter, and
   task list. No inline scripts exist in planner.html — this file attaches
   its own DOMContentLoaded listener.
   ========================================================================== */

(function (window, document) {
  "use strict";

  let els = {};
  let calendar = null;
  let viewMode = "day"; // "day" | "upcoming"

  /* ----------------------------------------------------------------------
     DOM helpers
     ---------------------------------------------------------------------- */
  const el = MindBloomUtils.el;
  const showToast = MindBloomUtils.showToast;

  function cacheElements() {
    els = {
      calendarContainer: document.getElementById("calendar-container"),
      focusCard: document.getElementById("focus-card"),
      workloadMeter: document.getElementById("workload-meter"),
      viewToggle: document.getElementById("view-toggle"),
      listHeading: document.getElementById("list-heading"),
      taskList: document.getElementById("task-list"),
      emptyState: document.getElementById("task-empty"),
      addBtn: document.getElementById("add-task-btn"),
      modalOverlay: document.getElementById("task-modal-overlay"),
      modalForm: document.getElementById("task-form"),
      modalTitle: document.getElementById("modal-title"),
      titleInput: document.getElementById("task-title"),
      subjectInput: document.getElementById("task-subject"),
      dueInput: document.getElementById("task-due"),
      priorityInput: document.getElementById("task-priority"),
      minutesInput: document.getElementById("task-minutes"),
      notesInput: document.getElementById("task-notes"),
      modalCancel: document.getElementById("modal-cancel"),
    };
    MindBloomUtils.initShell("academic");
  }

  function formatDateLabel(dateKey) {
    const date = new Date(dateKey + "T00:00:00");
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  /* ----------------------------------------------------------------------
     FOCUS CARD
     ---------------------------------------------------------------------- */
  function renderFocusCard() {
    const all = TaskManager.getAll();
    const suggestion = PriorityEngine.suggestFocusTask(all);

    if (!suggestion.task) {
      els.focusCard.innerHTML =
        '<span class="focus-card__icon">' + MindBloomUtils.icon("check") + "</span>" +
        '<div><p class="focus-card__title">Nothing pending</p>' +
        '<p class="focus-card__rationale">' + suggestion.rationale + "</p></div>";
      return;
    }

    els.focusCard.innerHTML =
      '<span class="focus-card__icon">' + MindBloomUtils.icon("target") + "</span>" +
      '<div><p class="focus-card__label">Suggested focus</p>' +
      '<p class="focus-card__title">' + suggestion.task.title + "</p>" +
      '<p class="focus-card__rationale">' + suggestion.rationale + "</p></div>";
  }

  /* ----------------------------------------------------------------------
     WORKLOAD METER (for the selected day)
     ---------------------------------------------------------------------- */
  function renderWorkloadMeter(dateKey) {
    const tasksForDay = TaskManager.getByDate(dateKey);
    const workload = PriorityEngine.getDailyWorkload(tasksForDay);

    const levelColors = {
      free: "var(--color-bloom-500)",
      light: "var(--color-bloom-500)",
      moderate: "var(--color-gold-500)",
      heavy: "var(--color-coral-500)",
    };

    els.workloadMeter.innerHTML =
      '<div class="workload-meter__row">' +
      '<span class="workload-meter__dot" style="background:' + levelColors[workload.level] + '"></span>' +
      '<span class="workload-meter__label">' + workload.taskCount + " task" + (workload.taskCount === 1 ? "" : "s") +
      " · ~" + workload.totalMinutes + " min</span>" +
      "</div>" +
      '<p class="workload-meter__message">' + workload.message + "</p>";
  }

  /* ----------------------------------------------------------------------
     TASK LIST
     ---------------------------------------------------------------------- */
  function getTasksForView(dateKey) {
    if (viewMode === "upcoming") {
      return PriorityEngine.rankTasks(TaskManager.getUpcoming(50));
    }
    return PriorityEngine.rankTasks(TaskManager.getByDate(dateKey));
  }

  function buildTaskRow(task) {
    const row = el("li", "planner-task card" + (task.status === "done" ? " planner-task--done" : ""));

    const checkbox = el("button", "checkbox planner-task__checkbox");
    checkbox.type = "button";
    checkbox.setAttribute("role", "checkbox");
    checkbox.setAttribute("aria-checked", String(task.status === "done"));
    checkbox.setAttribute("aria-label", "Mark '" + task.title + "' as done");
    if (task.status === "done") checkbox.innerHTML = MindBloomUtils.icon("check", "icon--sm");
    checkbox.addEventListener("click", function () {
      TaskManager.toggleComplete(task.id);
      refreshAll();
      showToast(task.status === "done" ? "Marked as not done yet." : "Nice work — task complete!");
    });

    const body = el(
      "div",
      "planner-task__body",
      '<p class="planner-task__title">' + task.title + "</p>" +
        '<p class="planner-task__meta">' + task.subject + " · " + PriorityEngine.getScoreLabel(task) +
        " · " + task.estimatedMinutes + " min</p>"
    );

    const priority = el(
      "span",
      "task-item__priority task-item__priority--" + task.priority,
      task.priority.charAt(0).toUpperCase() + task.priority.slice(1)
    );

    const actions = el("div", "planner-task__actions");
    const editBtn = el("button", "btn btn--icon btn--sm", MindBloomUtils.icon("edit", "icon--sm"));
    editBtn.type = "button";
    editBtn.setAttribute("aria-label", "Edit task");
    editBtn.addEventListener("click", function () {
      openModal(task, editBtn);
    });

    const deleteBtn = el("button", "btn btn--icon btn--sm", MindBloomUtils.icon("trash", "icon--sm"));
    deleteBtn.type = "button";
    deleteBtn.setAttribute("aria-label", "Delete task");
    deleteBtn.addEventListener("click", function () {
      if (window.confirm("Delete '" + task.title + "'?")) {
        TaskManager.remove(task.id);
        refreshAll();
        showToast("Task deleted");
      }
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(checkbox);
    row.appendChild(body);
    row.appendChild(priority);
    row.appendChild(actions);

    return row;
  }

  function renderTaskList(dateKey) {
    els.listHeading.textContent =
      viewMode === "upcoming" ? "All upcoming tasks" : formatDateLabel(dateKey);

    const tasks = getTasksForView(dateKey);
    els.taskList.innerHTML = "";

    if (tasks.length === 0) {
      els.emptyState.hidden = false;
      return;
    }

    els.emptyState.hidden = true;
    tasks.forEach(function (task) {
      els.taskList.appendChild(buildTaskRow(task));
    });
  }

  /* ----------------------------------------------------------------------
     VIEW TOGGLE
     ---------------------------------------------------------------------- */
  function renderViewToggle() {
    els.viewToggle.querySelectorAll("[data-view]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.view === viewMode));
    });
  }

  function wireViewToggle() {
    els.viewToggle.querySelectorAll("[data-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        viewMode = btn.dataset.view;
        renderViewToggle();
        renderTaskList(calendar.getSelectedDateKey());
      });
    });
  }

  /* ----------------------------------------------------------------------
     ADD / EDIT MODAL
     ---------------------------------------------------------------------- */
  let editingTaskId = null;
  let modalTriggerEl = null;

  function openModal(task, triggerEl) {
    editingTaskId = task ? task.id : null;
    modalTriggerEl = triggerEl || document.activeElement;
    els.modalTitle.textContent = task ? "Edit task" : "New task";
    els.titleInput.value = task ? task.title : "";
    els.subjectInput.value = task ? task.subject : "";
    els.dueInput.value = task ? task.dueDate : calendar.getSelectedDateKey();
    els.priorityInput.value = task ? task.priority : "medium";
    els.minutesInput.value = task ? task.estimatedMinutes : 30;
    els.notesInput.value = task ? task.notes : "";
    els.modalOverlay.hidden = false;
    els.titleInput.focus();
    document.addEventListener("keydown", handleModalKeydown);
  }

  function closeModal() {
    els.modalOverlay.hidden = true;
    editingTaskId = null;
    els.modalForm.reset();
    document.removeEventListener("keydown", handleModalKeydown);
    if (modalTriggerEl && typeof modalTriggerEl.focus === "function") {
      modalTriggerEl.focus();
    }
    modalTriggerEl = null;
  }

  function handleModalKeydown(event) {
    if (event.key === "Escape") {
      closeModal();
    }
  }

  function handleModalSubmit(event) {
    event.preventDefault();

    const payload = {
      title: els.titleInput.value.trim(),
      subject: els.subjectInput.value.trim() || "General",
      dueDate: els.dueInput.value,
      priority: els.priorityInput.value,
      estimatedMinutes: Number(els.minutesInput.value) || 30,
      notes: els.notesInput.value.trim(),
    };

    if (!payload.title || !payload.dueDate) return;

    if (editingTaskId) {
      TaskManager.update(editingTaskId, payload);
      showToast("Task updated");
    } else {
      TaskManager.add(payload);
      showToast("Task added");
    }

    closeModal();
    calendar.goToDate(new Date(payload.dueDate + "T00:00:00"));
    refreshAll();
  }

  function wireModal() {
    els.addBtn.addEventListener("click", function () {
      openModal(null, els.addBtn);
    });
    els.modalCancel.addEventListener("click", closeModal);
    els.modalOverlay.addEventListener("click", function (e) {
      if (e.target === els.modalOverlay) closeModal();
    });
    els.modalForm.addEventListener("submit", handleModalSubmit);
  }

  /* ----------------------------------------------------------------------
     REFRESH / INIT
     ---------------------------------------------------------------------- */
  function refreshAll() {
    calendar.setTasksByDate(TaskManager.getGroupedByDate());
    const dateKey = calendar.getSelectedDateKey();
    renderFocusCard();
    renderWorkloadMeter(dateKey);
    renderTaskList(dateKey);
  }

  function init() {
    cacheElements();

    calendar = MindBloomCalendar.create(els.calendarContainer, {
      initialDate: new Date(),
      tasksByDate: TaskManager.getGroupedByDate(),
      onSelectDate: function (dateKey) {
        viewMode = "day";
        renderViewToggle();
        renderWorkloadMeter(dateKey);
        renderTaskList(dateKey);
      },
      onMonthChange: function () {
        /* grid re-renders itself; nothing extra needed since data is
           already loaded in full */
      },
    });

    calendar.render();
    renderViewToggle();
    wireViewToggle();
    wireModal();
    refreshAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})(window, document);

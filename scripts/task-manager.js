/* ==========================================================================
   MindBloom — task-manager.js
   Thin, planner-specific query layer over MindBloomData (core/data-store.js)
   — the actual persistence lives there, shared with the dashboard's
   Upcoming Tasks card. This module adds the read helpers planner.js needs:
   fetch all, tasks due on a given date, and a date -> count map for the
   calendar's dot indicators.
   ========================================================================== */

(function (window) {
  "use strict";

  function getAll() {
    return MindBloomData.load().upcomingTasks;
  }

  function add(task) {
    return MindBloomData.addTask(task);
  }

  function update(id, patch) {
    return MindBloomData.updateTask(id, patch);
  }

  function remove(id) {
    return MindBloomData.deleteTask(id);
  }

  function toggle(id) {
    return MindBloomData.toggleTask(id);
  }

  function getById(tasks, id) {
    return (
      tasks.find(function (t) {
        return t.id === id;
      }) || null
    );
  }

  function forDate(tasks, dateKey) {
    return tasks.filter(function (t) {
      return t.due === dateKey;
    });
  }

  function upcoming(tasks) {
    return MindBloomData.sortTasksForDisplay(tasks);
  }

  /** @returns {Object<string, number>} dateKey ("YYYY-MM-DD") -> task count, for the calendar's dot indicators */
  function datesWithTasks(tasks) {
    const map = {};
    tasks.forEach(function (t) {
      if (!t.due) return;
      map[t.due] = (map[t.due] || 0) + 1;
    });
    return map;
  }

  window.TaskManager = {
    getAll: getAll,
    add: add,
    update: update,
    remove: remove,
    toggle: toggle,
    getById: getById,
    forDate: forDate,
    upcoming: upcoming,
    datesWithTasks: datesWithTasks,
  };
})(window);

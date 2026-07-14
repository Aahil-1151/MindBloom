/* ==========================================================================
   MindBloom — task-manager.js
   Data layer for the Smart Planner. Reads/writes tasks to localStorage
   today. Method names and return shapes (getAll, add, update, remove,
   toggleComplete) mirror what a future Firestore-backed version would
   expose (users/{uid}/tasks/{id}) — swapping the internals later requires
   no changes in calendar.js, priority-engine.js, or planner.js.
   ========================================================================== */

(function (window) {
  "use strict";

  const TASKS_KEY = "mindbloom_academic_tasks";

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.error("TaskManager: failed to read " + key, err);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error("TaskManager: failed to write " + key, err);
      return false;
    }
  }

  function generateId() {
    return (
      "task_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8)
    );
  }

  /** Normalizes any Date/string into a plain "YYYY-MM-DD" key. */
  const toDateKey = window.MindBloomUtils.toDateKey;

  const TaskManager = {
    /**
     * @returns {Array<{
     *   id:string, title:string, subject:string, dueDate:string,
     *   priority:'high'|'medium'|'low', estimatedMinutes:number,
     *   status:'pending'|'done', notes:string,
     *   createdAt:string, updatedAt:string|null
     * }>}
     */
    getAll() {
      return readJSON(TASKS_KEY, []);
    },

    /** @returns {object|null} */
    getById(id) {
      return this.getAll().find(function (task) {
        return task.id === id;
      }) || null;
    },

    /**
     * @param {object} task
     * @returns {object} the stored task, with defaults filled in
     */
    add(task) {
      const stored = {
        id: task.id || generateId(),
        title: task.title,
        subject: task.subject || "General",
        dueDate: toDateKey(task.dueDate || new Date()),
        priority: task.priority || "medium",
        estimatedMinutes: Number(task.estimatedMinutes) || 30,
        status: task.status || "pending",
        notes: task.notes || "",
        createdAt: task.createdAt || new Date().toISOString(),
        updatedAt: null,
      };

      const all = this.getAll();
      all.push(stored);
      writeJSON(TASKS_KEY, all);

      return stored;
    },

    /**
     * @param {string} id
     * @param {object} changes
     * @returns {object|null}
     */
    update(id, changes) {
      const all = this.getAll();
      const index = all.findIndex(function (t) {
        return t.id === id;
      });
      if (index === -1) return null;

      const normalizedChanges = Object.assign({}, changes);
      if (normalizedChanges.dueDate) {
        normalizedChanges.dueDate = toDateKey(normalizedChanges.dueDate);
      }

      all[index] = Object.assign({}, all[index], normalizedChanges, {
        updatedAt: new Date().toISOString(),
      });
      writeJSON(TASKS_KEY, all);
      return all[index];
    },

    /** @returns {object|null} the updated task */
    toggleComplete(id) {
      const task = this.getById(id);
      if (!task) return null;
      return this.update(id, { status: task.status === "done" ? "pending" : "done" });
    },

    /** @returns {boolean} */
    remove(id) {
      const all = this.getAll();
      const filtered = all.filter(function (t) {
        return t.id !== id;
      });
      writeJSON(TASKS_KEY, filtered);
      return filtered.length !== all.length;
    },

    /**
     * @param {string|Date} date
     * @returns {Array} tasks due on that exact calendar date
     */
    getByDate(date) {
      const key = toDateKey(date);
      return this.getAll().filter(function (t) {
        return t.dueDate === key;
      });
    },

    /**
     * @returns {Object<string, Array>} map of "YYYY-MM-DD" -> tasks due that day
     */
    getGroupedByDate() {
      const groups = {};
      this.getAll().forEach(function (task) {
        if (!groups[task.dueDate]) groups[task.dueDate] = [];
        groups[task.dueDate].push(task);
      });
      return groups;
    },

    /**
     * @param {number} n
     * @returns {Array} the next n pending tasks, soonest due date first
     */
    getUpcoming(n) {
      return this.getAll()
        .filter(function (t) {
          return t.status !== "done";
        })
        .sort(function (a, b) {
          return new Date(a.dueDate) - new Date(b.dueDate);
        })
        .slice(0, n);
    },

    /** Utility exposed for other modules that need consistent date keys. */
    toDateKey: toDateKey,

    /** Wipe all tasks. */
    clear() {
      writeJSON(TASKS_KEY, []);
      return true;
    },
  };

  window.TaskManager = TaskManager;
})(window);

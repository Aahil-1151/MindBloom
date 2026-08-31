/* ==========================================================================
   MindBloom — calendar.js
   A small, dependency-free month-grid calendar renderer used by
   planner.html. Builds entirely fresh DOM into a container each render —
   no state of its own, the caller (planner.js) owns the current month /
   selected date and re-renders on change.
   ========================================================================== */

(function (window, document) {
  "use strict";

  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function toDateKey(year, month, day) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return year + "-" + mm + "-" + dd;
  }

  /**
   * @param {HTMLElement} container
   * @param {object} opts
   * @param {Date} opts.monthDate - any date within the month to display
   * @param {string} opts.selectedKey - the currently-selected "YYYY-MM-DD"
   * @param {Object<string,number>} opts.markedCounts - dateKey -> task count, for dots
   * @param {(dateKey:string)=>void} opts.onSelect
   * @param {(newMonthDate:Date)=>void} opts.onMonthChange
   */
  function render(container, opts) {
    if (!container) return;
    const monthDate = opts.monthDate;
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const now = new Date();
    const todayKey = toDateKey(now.getFullYear(), now.getMonth(), now.getDate());

    const startOffset = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const header = document.createElement("div");
    header.className = "calendar__header";

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "btn btn--icon";
    prevBtn.setAttribute("aria-label", "Previous month");
    prevBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-chevron-left"></use></svg>';
    prevBtn.addEventListener("click", function () {
      opts.onMonthChange(new Date(year, month - 1, 1));
    });

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "btn btn--icon";
    nextBtn.setAttribute("aria-label", "Next month");
    nextBtn.innerHTML =
      '<svg class="icon" aria-hidden="true" style="transform:rotate(180deg)"><use href="#icon-chevron-left"></use></svg>';
    nextBtn.addEventListener("click", function () {
      opts.onMonthChange(new Date(year, month + 1, 1));
    });

    const label = document.createElement("span");
    label.className = "calendar__month-label";
    label.textContent = monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    header.appendChild(prevBtn);
    header.appendChild(label);
    header.appendChild(nextBtn);

    const weekdaysRow = document.createElement("div");
    weekdaysRow.className = "calendar__weekdays";
    WEEKDAYS.forEach(function (wd) {
      const cell = document.createElement("span");
      cell.className = "calendar__weekday";
      cell.textContent = wd;
      weekdaysRow.appendChild(cell);
    });

    const grid = document.createElement("div");
    grid.className = "calendar__grid";

    for (let i = 0; i < startOffset; i++) {
      const empty = document.createElement("div");
      empty.className = "calendar__cell calendar__cell--empty";
      grid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = toDateKey(year, month, day);
      const cell = document.createElement("button");
      cell.type = "button";
      let cls = "calendar__cell";
      if (dateKey === todayKey) cls += " calendar__cell--today";
      if (dateKey === opts.selectedKey) cls += " calendar__cell--selected";
      cell.className = cls;
      cell.textContent = String(day);
      cell.setAttribute("aria-label", monthDate.toLocaleDateString(undefined, { month: "long" }) + " " + day);

      const count = (opts.markedCounts || {})[dateKey] || 0;
      if (count > 0) {
        const dot = document.createElement("span");
        dot.className = "calendar__dot" + (count > 1 ? " calendar__dot--multi" : "");
        cell.appendChild(dot);
      }

      cell.addEventListener("click", function () {
        opts.onSelect(dateKey);
      });

      grid.appendChild(cell);
    }

    container.innerHTML = "";
    container.appendChild(header);
    container.appendChild(weekdaysRow);
    container.appendChild(grid);
  }

  window.Calendar = { render: render, toDateKey: toDateKey };
})(window, document);

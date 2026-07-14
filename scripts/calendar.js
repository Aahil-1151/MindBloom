/* ==========================================================================
   MindBloom — calendar.js
   A self-contained, reusable month-grid calendar component. It never reads
   or writes storage — it only renders a month for a given year/month, marks
   days that have tasks (via a tasksByDate map it's handed), and reports
   navigation/selection back through callbacks. planner.js owns all data;
   this module owns only the grid.

   Usage:
     const calendar = MindBloomCalendar.create(containerEl, {
       initialDate: new Date(),
       tasksByDate: { "2026-07-10": [...tasks] },
       onSelectDate: (dateKey) => { ... },
       onMonthChange: (year, month) => { ... },
     });
     calendar.render();
     calendar.setTasksByDate(newMap); // call after tasks change elsewhere
   ========================================================================== */

(function (window) {
  "use strict";

  const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
  const MONTH_LABELS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const toDateKey = window.MindBloomUtils.toDateKey;

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  const el = window.MindBloomUtils.el;

  function createCalendar(container, options) {
    const settings = Object.assign(
      {
        initialDate: new Date(),
        tasksByDate: {},
        onSelectDate: function () {},
        onMonthChange: function () {},
      },
      options
    );

    let viewYear = settings.initialDate.getFullYear();
    let viewMonth = settings.initialDate.getMonth();
    let selectedDate = new Date(settings.initialDate);
    let tasksByDate = settings.tasksByDate;

    function buildHeader() {
      const header = el("div", "calendar__header");

      const prevBtn = el("button", "btn btn--icon btn--sm calendar__nav", "‹");
      prevBtn.type = "button";
      prevBtn.setAttribute("aria-label", "Previous month");
      prevBtn.addEventListener("click", function () {
        viewMonth -= 1;
        if (viewMonth < 0) {
          viewMonth = 11;
          viewYear -= 1;
        }
        settings.onMonthChange(viewYear, viewMonth);
        render();
      });

      const label = el(
        "span",
        "calendar__month-label",
        MONTH_LABELS[viewMonth] + " " + viewYear
      );

      const nextBtn = el("button", "btn btn--icon btn--sm calendar__nav", "›");
      nextBtn.type = "button";
      nextBtn.setAttribute("aria-label", "Next month");
      nextBtn.addEventListener("click", function () {
        viewMonth += 1;
        if (viewMonth > 11) {
          viewMonth = 0;
          viewYear += 1;
        }
        settings.onMonthChange(viewYear, viewMonth);
        render();
      });

      header.appendChild(prevBtn);
      header.appendChild(label);
      header.appendChild(nextBtn);
      return header;
    }

    function buildWeekdayRow() {
      const row = el("div", "calendar__weekdays");
      WEEKDAY_LABELS.forEach(function (label) {
        row.appendChild(el("span", "calendar__weekday", label));
      });
      return row;
    }

    function buildGrid() {
      const grid = el("div", "calendar__grid");

      const firstOfMonth = new Date(viewYear, viewMonth, 1);
      const startOffset = firstOfMonth.getDay(); // 0 = Sunday
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const today = new Date();

      for (let i = 0; i < startOffset; i++) {
        grid.appendChild(el("span", "calendar__cell calendar__cell--empty"));
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(viewYear, viewMonth, day);
        const dateKey = toDateKey(cellDate);
        const tasksForDay = tasksByDate[dateKey] || [];
        const pendingCount = tasksForDay.filter(function (t) {
          return t.status !== "done";
        }).length;

        const cell = el("button", "calendar__cell");
        cell.type = "button";
        cell.textContent = String(day);
        cell.dataset.date = dateKey;

        if (isSameDay(cellDate, today)) cell.classList.add("calendar__cell--today");
        if (isSameDay(cellDate, selectedDate)) cell.classList.add("calendar__cell--selected");

        if (pendingCount > 0) {
          const dot = el("span", "calendar__dot");
          if (pendingCount > 1) dot.classList.add("calendar__dot--multi");
          cell.appendChild(dot);
        }

        cell.addEventListener("click", function () {
          selectedDate = cellDate;
          settings.onSelectDate(dateKey);
          render();
        });

        grid.appendChild(cell);
      }

      return grid;
    }

    function render() {
      container.innerHTML = "";
      container.appendChild(buildHeader());
      container.appendChild(buildWeekdayRow());
      container.appendChild(buildGrid());
    }

    return {
      render: render,

      /** Call after tasks change elsewhere so the dots stay accurate. */
      setTasksByDate(newMap) {
        tasksByDate = newMap || {};
        render();
      },

      /** Programmatically jump to and select a specific date. */
      goToDate(date) {
        viewYear = date.getFullYear();
        viewMonth = date.getMonth();
        selectedDate = new Date(date);
        render();
      },

      /** @returns {string} the currently selected date as "YYYY-MM-DD" */
      getSelectedDateKey() {
        return toDateKey(selectedDate);
      },
    };
  }

  window.MindBloomCalendar = { create: createCalendar, toDateKey: toDateKey };
})(window);

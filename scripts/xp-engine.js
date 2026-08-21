/* ==========================================================================
   MindBloom — xp-engine.js
   Pure XP-curve math for the dashboard's level display: how much an
   action is worth, and what level a cumulative XP total maps to. No
   storage or DOM access — dashboard.js sums record.xpLog (core/
   data-store.js) into a totalXp number and passes it in here, the same
   way analytics.js hands BurnoutScore.computeScore a signals object it
   built itself.

   ACTION_XP mirrors core/data-store.js's own copy of the same table
   (that file awards the XP when an action happens; this file is only
   consulted for display, e.g. "+10 XP" toasts) — the two are kept as
   separate constants so data-store.js stays as dependency-free as every
   other function in it. Keep both in sync if either changes.
   ========================================================================== */

(function (window) {
  "use strict";

  // Fixed award per logged action, regardless of the data logged — a
  // rough mood day earns the same XP as a great one, since this rewards
  // the act of checking in, never the content, so honest logging is
  // never penalized.
  const ACTION_XP = {
    mood: 10,
    journal: 15,
    task: 10,
    physical: 10,
    focus: 20,
  };

  // Simple curve: level = floor(sqrt(xp / 50)), so each level needs a
  // growing amount of XP (50, 200, 450, 800, ...) rather than a flat
  // per-level cost.
  const XP_PER_LEVEL_UNIT = 50;

  function xpForLevel(level) {
    return XP_PER_LEVEL_UNIT * level * level;
  }

  const XPEngine = {
    /** @returns {number} XP awarded for a given action key, or 0 if unknown. */
    getXpForAction(action) {
      return ACTION_XP[action] || 0;
    },

    /**
     * @param {number} totalXp
     * @returns {{level:number, totalXp:number, xpIntoLevel:number, xpForNextLevel:number, progressPercent:number}}
     */
    computeLevel(totalXp) {
      const xp = Math.max(0, totalXp || 0);
      const level = Math.floor(Math.sqrt(xp / XP_PER_LEVEL_UNIT));
      const currentLevelXp = xpForLevel(level);
      const nextLevelXp = xpForLevel(level + 1);
      const xpIntoLevel = xp - currentLevelXp;
      const xpForNextLevel = nextLevelXp - currentLevelXp;

      return {
        level: level,
        totalXp: xp,
        xpIntoLevel: xpIntoLevel,
        xpForNextLevel: xpForNextLevel,
        progressPercent: xpForNextLevel > 0 ? Math.round((xpIntoLevel / xpForNextLevel) * 100) : 100,
      };
    },
  };

  window.XPEngine = XPEngine;
})(window);

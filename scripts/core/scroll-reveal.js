/* ==========================================================================
   MindBloom — core/scroll-reveal.js
   Opt-in GSAP ScrollTrigger reveal for page sections: fade + rise into
   place as the user scrolls to them. Complements, not replaces, the
   on-load entrance animations in styles/animations.css (anim-fade-up
   etc.) — those fire once at page load; this fires per-section as it
   enters the viewport, so a long page (analytics, planner, journal)
   keeps feeling alive as you scroll rather than going static after the
   first 300ms.

   Fails silently and does nothing if GSAP/ScrollTrigger didn't load
   (offline first load, CDN blocked) or the user has prefers-reduced-
   motion set — sections are never hidden by default CSS, only animated
   FROM their natural visible state, so the page degrades to fully
   readable, static content either way. Mark a section with class
   "scroll-reveal" to opt it in; don't add it to anything a user may
   need instantly (e.g. emergency.html's crisis-line numbers).
   ========================================================================== */

(function (window, document) {
  "use strict";

  function init() {
    if (!window.gsap || !window.ScrollTrigger) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);

    document.querySelectorAll(".scroll-reveal").forEach(function (el) {
      // Skip anything not actually laid out yet (e.g. inside a hidden tab
      // panel) — ScrollTrigger would measure a 0x0 position and the
      // reveal could get stuck at its "from" (invisible) state forever.
      if (el.offsetParent === null) return;

      gsap.from(el, {
        opacity: 0,
        y: 28,
        duration: 0.7,
        ease: "expo.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          toggleActions: "play none none none",
        },
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window, document);

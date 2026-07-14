/* ==========================================================================
   MindBloom — app.js
   Bootstrapper for the root index.html entry point. Its only job is to
   decide where to send the visitor: back into their session on
   dashboard.html if one exists, or to login.html if not. Every other page
   loads its own controller script directly — this file is only used by
   the root index.html.
   ========================================================================== */

(function (window, document) {
  "use strict";

  function redirect() {
    const hasSession =
      window.AuthService && typeof window.AuthService.isAuthenticated === "function"
        ? window.AuthService.isAuthenticated()
        : false;

    window.location.replace(hasSession ? "pages/dashboard.html" : "pages/login.html");
  }

  document.addEventListener("DOMContentLoaded", redirect);
})(window, document);

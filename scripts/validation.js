/* ==========================================================================
   MindBloom — validation.js
   Pure validation functions. No DOM access, no storage access — these
   functions only take data in and return booleans/objects out, so they can
   be unit-tested in isolation and reused by any future form (not just auth).
   Exposed globally as window.Validation.
   ========================================================================== */

(function (window) {
  "use strict";

  const Validation = {};

  /* ---------------------------------------------------------------------
     Field-level checks
     --------------------------------------------------------------------- */

  Validation.isValidEmail = function (email) {
    if (typeof email !== "string") return false;
    const trimmed = email.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    return emailPattern.test(trimmed);
  };

  Validation.isValidName = function (name) {
    if (typeof name !== "string") return false;
    const trimmed = name.trim();
    return trimmed.length >= 2 && trimmed.length <= 60;
  };

  Validation.isValidPassword = function (password) {
    if (typeof password !== "string") return false;
    const hasMinLength = password.length >= 8;
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return hasMinLength && hasLetter && hasNumber;
  };

  Validation.passwordsMatch = function (password, confirmPassword) {
    return (
      typeof password === "string" &&
      password.length > 0 &&
      password === confirmPassword
    );
  };

  /* ---------------------------------------------------------------------
     Password strength meter — used by signup.html and the reset-password
     step of forgot-password.html for live feedback.
     Returns a score from 0–5 and a human label.
     --------------------------------------------------------------------- */
  Validation.getPasswordStrength = function (password) {
    if (!password) {
      return { score: 0, label: "Too short" };
    }

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    let label = "Weak";
    if (score >= 4) label = "Strong";
    else if (score >= 2) label = "Medium";

    return { score: Math.min(score, 5), label: label };
  };

  /* ---------------------------------------------------------------------
     Form-level validators — each returns { valid, errors } where errors
     is a map of fieldName -> human-readable message. Empty errors object
     means the form passed.
     --------------------------------------------------------------------- */

  Validation.validateSignupForm = function (data) {
    const name = data.name || "";
    const email = data.email || "";
    const password = data.password || "";
    const confirmPassword = data.confirmPassword || "";
    const errors = {};

    if (!Validation.isValidName(name)) {
      errors.name = "Enter a name between 2 and 60 characters.";
    }
    if (!Validation.isValidEmail(email)) {
      errors.email = "Enter a valid email address.";
    }
    if (!Validation.isValidPassword(password)) {
      errors.password =
        "Password needs at least 8 characters, including a letter and a number.";
    }
    if (!Validation.passwordsMatch(password, confirmPassword)) {
      errors.confirmPassword = "Passwords do not match.";
    }

    return { valid: Object.keys(errors).length === 0, errors: errors };
  };

  Validation.validateLoginForm = function (data) {
    const email = data.email || "";
    const password = data.password || "";
    const errors = {};

    if (!Validation.isValidEmail(email)) {
      errors.email = "Enter a valid email address.";
    }
    if (!password || password.length === 0) {
      errors.password = "Enter your password.";
    }

    return { valid: Object.keys(errors).length === 0, errors: errors };
  };

  Validation.validateForgotPasswordForm = function (data) {
    const email = data.email || "";
    const errors = {};

    if (!Validation.isValidEmail(email)) {
      errors.email = "Enter a valid email address.";
    }

    return { valid: Object.keys(errors).length === 0, errors: errors };
  };

  Validation.validateResetPasswordForm = function (data) {
    const password = data.password || "";
    const confirmPassword = data.confirmPassword || "";
    const errors = {};

    if (!Validation.isValidPassword(password)) {
      errors.password =
        "Password needs at least 8 characters, including a letter and a number.";
    }
    if (!Validation.passwordsMatch(password, confirmPassword)) {
      errors.confirmPassword = "Passwords do not match.";
    }

    return { valid: Object.keys(errors).length === 0, errors: errors };
  };

  window.Validation = Validation;
})(window);

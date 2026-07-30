/* ==========================================================================
   MindBloom — validation.js
   Pure, dependency-free form-validation helpers shared by every auth page
   controller in auth.js (initLoginPage / initSignupPage /
   initForgotPasswordPage). Load this before auth.js.

   Every validate*Form() function returns { valid: boolean, errors: object },
   where `errors` is keyed by the same field names used in each page's
   data-field="..." markup (name, email, password, confirmPassword) — auth.js
   feeds those keys straight into setFieldError() without translation.
   ========================================================================== */

(function (window) {
  "use strict";

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MIN_PASSWORD_LENGTH = 8;

  function isBlank(value) {
    return value === undefined || value === null || !String(value).trim();
  }

  function validateEmailField(email, errors) {
    if (isBlank(email)) {
      errors.email = "Email is required.";
    } else if (!EMAIL_RE.test(String(email).trim())) {
      errors.email = "Enter a valid email address.";
    }
  }

  function validateRequiredPassword(password, errors) {
    if (isBlank(password)) {
      errors.password = "Password is required.";
    }
  }

  function validateStrongPassword(password, errors) {
    if (isBlank(password)) {
      errors.password = "Password is required.";
    } else if (String(password).length < MIN_PASSWORD_LENGTH) {
      errors.password = "Password must be at least " + MIN_PASSWORD_LENGTH + " characters.";
    }
  }

  function validateConfirmPassword(password, confirmPassword, errors) {
    if (isBlank(confirmPassword)) {
      errors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords don't match.";
    }
  }

  /**
   * Scores password strength on a simple 0-5 scale (length + character
   * variety). Used by the signup page's live strength meter — see
   * #password-strength-fill / #password-strength-label in signup.html,
   * whose [data-level="weak|medium|strong"] CSS expects `label.toLowerCase()`
   * to be exactly one of those three words.
   * @returns {{score:number, label:"Weak"|"Medium"|"Strong"}}
   */
  function getPasswordStrength(password) {
    password = password || "";
    let score = 0;
    if (password.length >= MIN_PASSWORD_LENGTH) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    let label = "Weak";
    if (score >= 4) label = "Strong";
    else if (score >= 2) label = "Medium";

    return { score: score, label: label };
  }

  /** @returns {{valid:boolean, errors:object}} */
  function validateLoginForm(data) {
    const errors = {};
    validateEmailField(data.email, errors);
    validateRequiredPassword(data.password, errors);
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /** @returns {{valid:boolean, errors:object}} */
  function validateSignupForm(data) {
    const errors = {};
    if (isBlank(data.name)) {
      errors.name = "Name is required.";
    }
    validateEmailField(data.email, errors);
    validateStrongPassword(data.password, errors);
    if (!errors.password) {
      validateConfirmPassword(data.password, data.confirmPassword, errors);
    }
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /** @returns {{valid:boolean, errors:object}} */
  function validateForgotPasswordForm(data) {
    const errors = {};
    validateEmailField(data.email, errors);
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /** @returns {{valid:boolean, errors:object}} */
  function validateResetPasswordForm(data) {
    const errors = {};
    validateStrongPassword(data.password, errors);
    if (!errors.password) {
      validateConfirmPassword(data.password, data.confirmPassword, errors);
    }
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  window.Validation = {
    validateLoginForm: validateLoginForm,
    validateSignupForm: validateSignupForm,
    validateForgotPasswordForm: validateForgotPasswordForm,
    validateResetPasswordForm: validateResetPasswordForm,
    getPasswordStrength: getPasswordStrength,
  };
})(window);

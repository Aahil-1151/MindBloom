/* ==========================================================================
   MindBloom — auth.js
   Two things live in this file, intentionally kept together for now since
   the brief scopes auth to exactly these files:

   1. AuthService — a Firebase-ready data/auth abstraction. Every method
      name and return shape here (signup, login, logout, getSession,
      requestPasswordReset, resetPassword) mirrors what a Firebase
      Authentication wrapper would expose. Swapping the internals from
      localStorage to Firebase later means editing only the bodies of
      these methods — no calling code on any page has to change.

   2. Page controllers (initLoginPage / initSignupPage /
      initForgotPasswordPage) — DOM wiring that calls AuthService +
      Validation and updates the UI. Each page's inline script calls
      exactly one of these on load.
   ========================================================================== */

(function (window) {
  "use strict";

  /* ======================================================================
     PART 1 — AUTH SERVICE (localStorage now, Firebase-ready)
     ====================================================================== */

  const USERS_KEY = "mindbloom_users";
  const SESSION_KEY = "mindbloom_session";
  const RESET_KEY = "mindbloom_reset_requests";

  // ---- low-level storage helpers -----------------------------------------
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.error("AuthService: failed to read " + key, err);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error("AuthService: failed to write " + key, err);
      return false;
    }
  }

  function getUsers() {
    return readJSON(USERS_KEY, []);
  }

  function saveUsers(users) {
    return writeJSON(USERS_KEY, users);
  }

  function generateId() {
    return (
      "u_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10)
    );
  }

  // SHA-256 hashing via the native Web Crypto API. The user's normalized
  // email acts as a per-account salt so two users with the same password
  // never produce the same stored hash.
  // NOTE: this is a client-side stand-in appropriate for a localStorage-only
  // demo. It is not a substitute for real server-side auth. When Firebase
  // is wired in, AuthService.signup/login below will call
  // createUserWithEmailAndPassword / signInWithEmailAndPassword instead,
  // and Firebase handles credential security server-side — nothing outside
  // this file needs to know that happened.
  async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + ":" + password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function findUserByEmail(email) {
    const normalized = email.trim().toLowerCase();
    return getUsers().find((u) => u.email === normalized) || null;
  }

  const AuthService = {
    /**
     * Create a new account and start a session.
     * @returns {Promise<{success:boolean, user?:object, error?:string}>}
     */
    async signup({ name, email, password }) {
      const normalizedEmail = email.trim().toLowerCase();

      if (findUserByEmail(normalizedEmail)) {
        return { success: false, error: "An account with this email already exists." };
      }

      const passwordHash = await hashPassword(password, normalizedEmail);

      const user = {
        id: generateId(),
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: passwordHash,
        createdAt: new Date().toISOString(),
        onboardedAt: null,
      };

      const users = getUsers();
      users.push(user);
      saveUsers(users);

      this._createSession(user);

      return { success: true, user: this._publicUser(user) };
    },

    /**
     * Verify credentials and start a session.
     * @returns {Promise<{success:boolean, user?:object, error?:string}>}
     */
    async login(email, password) {
      const normalizedEmail = email.trim().toLowerCase();
      const user = findUserByEmail(normalizedEmail);

      if (!user) {
        return { success: false, error: "No account found with this email." };
      }

      const passwordHash = await hashPassword(password, normalizedEmail);

      if (passwordHash !== user.passwordHash) {
        return { success: false, error: "Incorrect password. Try again." };
      }

      this._createSession(user);

      return { success: true, user: this._publicUser(user) };
    },

    /** End the current session. */
    logout() {
      localStorage.removeItem(SESSION_KEY);
      return true;
    },

    /** @returns {object|null} the current session, or null if signed out. */
    getSession() {
      return readJSON(SESSION_KEY, null);
    },

    /** @returns {boolean} */
    isAuthenticated() {
      return !!this.getSession();
    },

    /**
     * Step 1 of password reset. In production this becomes
     * firebase.auth().sendPasswordResetEmail(email) and Firebase handles
     * the email + secure token entirely. Locally, we generate a token and
     * let the UI move straight to the reset step in the same session,
     * since there is no email transport available client-side.
     * Always resolves with success:true regardless of whether the account
     * exists, so the UI never reveals which emails are registered.
     */
    async requestPasswordReset(email) {
      const normalizedEmail = email.trim().toLowerCase();
      const user = findUserByEmail(normalizedEmail);

      if (!user) {
        return { success: true };
      }

      const resetToken = generateId();
      const requests = readJSON(RESET_KEY, {});
      requests[normalizedEmail] = {
        token: resetToken,
        requestedAt: new Date().toISOString(),
      };
      writeJSON(RESET_KEY, requests);

      return { success: true, token: resetToken };
    },

    /**
     * Step 2 of password reset — sets a new password for the given email.
     * @returns {Promise<{success:boolean, error?:string}>}
     */
    async resetPassword(email, newPassword) {
      const normalizedEmail = email.trim().toLowerCase();
      const users = getUsers();
      const index = users.findIndex((u) => u.email === normalizedEmail);

      if (index === -1) {
        return { success: false, error: "No account found with this email." };
      }

      users[index].passwordHash = await hashPassword(newPassword, normalizedEmail);
      saveUsers(users);

      const requests = readJSON(RESET_KEY, {});
      delete requests[normalizedEmail];
      writeJSON(RESET_KEY, requests);

      return { success: true };
    },

    _createSession(user) {
      writeJSON(SESSION_KEY, {
        userId: user.id,
        name: user.name,
        email: user.email,
        loggedInAt: new Date().toISOString(),
      });
    },

    _publicUser(user) {
      return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
    },
  };

  window.AuthService = AuthService;

  /* ======================================================================
     PART 2 — PAGE CONTROLLERS (DOM wiring for login/signup/forgot-password)
     ====================================================================== */

  function qs(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function setFieldError(fieldName, message) {
    const field = qs('[data-field="' + fieldName + '"]');
    if (!field) return;
    const errorEl = field.querySelector(".field__error");
    const inputEl = field.querySelector(".input");
    if (message) {
      field.classList.add("field--invalid");
      if (inputEl) inputEl.classList.add("input--error");
      if (errorEl) errorEl.textContent = message;
    } else {
      field.classList.remove("field--invalid");
      if (inputEl) inputEl.classList.remove("input--error");
      if (errorEl) errorEl.textContent = "";
    }
  }

  function clearFieldErrors(fieldNames) {
    fieldNames.forEach(function (name) {
      setFieldError(name, "");
    });
  }

  function showFormMessage(el, message, type) {
    if (!el) return;
    el.textContent = message;
    el.className = "form-message" + (type ? " form-message--" + type : "");
    el.hidden = !message;
  }

  function setButtonLoading(button, isLoading, loadingText, defaultText) {
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : defaultText;
  }

  function wirePasswordToggle(toggleBtn, input) {
    if (!toggleBtn || !input) return;
    toggleBtn.addEventListener("click", function () {
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      toggleBtn.setAttribute("aria-pressed", String(isPassword));
      toggleBtn.textContent = isPassword ? "Hide" : "Show";
    });
  }

  function redirectIfAuthenticated(destination) {
    if (AuthService.isAuthenticated()) {
      window.location.href = destination;
    }
  }

  // ---- LOGIN PAGE ---------------------------------------------------------
  function initLoginPage() {
    redirectIfAuthenticated("dashboard.html");

    const form = qs("#login-form");
    if (!form) return;

    const emailInput = qs("#login-email");
    const passwordInput = qs("#login-password");
    const submitBtn = qs("#login-submit");
    const formMessage = qs("#login-message");
    const toggleBtn = qs("#login-password-toggle");

    wirePasswordToggle(toggleBtn, passwordInput);

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      clearFieldErrors(["email", "password"]);
      showFormMessage(formMessage, "", null);

      const data = { email: emailInput.value, password: passwordInput.value };
      const result = Validation.validateLoginForm(data);

      if (!result.valid) {
        Object.keys(result.errors).forEach(function (field) {
          setFieldError(field, result.errors[field]);
        });
        return;
      }

      setButtonLoading(submitBtn, true, "Signing in…", "Sign in");

      let outcome;
      try {
        outcome = await AuthService.login(data.email, data.password);
      } catch (err) {
        console.error("Login failed unexpectedly", err);
        setButtonLoading(submitBtn, false, "Signing in…", "Sign in");
        showFormMessage(formMessage, "Something went wrong signing you in. Please try again.", "error");
        return;
      }

      setButtonLoading(submitBtn, false, "Signing in…", "Sign in");

      if (!outcome.success) {
        showFormMessage(formMessage, outcome.error, "error");
        form.classList.add("anim-shake");
        setTimeout(function () {
          form.classList.remove("anim-shake");
        }, 400);
        return;
      }

      showFormMessage(formMessage, "Welcome back! Redirecting…", "success");
      setTimeout(function () {
        window.location.href = "dashboard.html";
      }, 500);
    });
  }

  // ---- SIGNUP PAGE ---------------------------------------------------------
  function initSignupPage() {
    redirectIfAuthenticated("dashboard.html");

    const form = qs("#signup-form");
    if (!form) return;

    const nameInput = qs("#signup-name");
    const emailInput = qs("#signup-email");
    const passwordInput = qs("#signup-password");
    const confirmInput = qs("#signup-confirm-password");
    const submitBtn = qs("#signup-submit");
    const formMessage = qs("#signup-message");
    const toggleBtn = qs("#signup-password-toggle");
    const strengthFill = qs("#password-strength-fill");
    const strengthLabel = qs("#password-strength-label");

    wirePasswordToggle(toggleBtn, passwordInput);

    passwordInput.addEventListener("input", function () {
      const strength = Validation.getPasswordStrength(passwordInput.value);
      if (strengthFill) {
        strengthFill.style.width = (strength.score / 5) * 100 + "%";
        strengthFill.setAttribute("data-level", strength.label.toLowerCase());
      }
      if (strengthLabel) {
        strengthLabel.textContent = passwordInput.value ? strength.label : "";
      }
    });

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      clearFieldErrors(["name", "email", "password", "confirmPassword"]);
      showFormMessage(formMessage, "", null);

      const data = {
        name: nameInput.value,
        email: emailInput.value,
        password: passwordInput.value,
        confirmPassword: confirmInput.value,
      };

      const result = Validation.validateSignupForm(data);
      if (!result.valid) {
        Object.keys(result.errors).forEach(function (field) {
          setFieldError(field, result.errors[field]);
        });
        return;
      }

      setButtonLoading(submitBtn, true, "Creating account…", "Create account");

      let outcome;
      try {
        outcome = await AuthService.signup(data);
      } catch (err) {
        console.error("Signup failed unexpectedly", err);
        setButtonLoading(submitBtn, false, "Creating account…", "Create account");
        showFormMessage(formMessage, "Something went wrong creating your account. Please try again.", "error");
        return;
      }

      setButtonLoading(submitBtn, false, "Creating account…", "Create account");

      if (!outcome.success) {
        showFormMessage(formMessage, outcome.error, "error");
        setFieldError("email", outcome.error);
        return;
      }

      showFormMessage(formMessage, "Account created! Redirecting…", "success");
      setTimeout(function () {
        window.location.href = "onboarding.html";
      }, 500);
    });
  }

  // ---- FORGOT PASSWORD PAGE (two-step: request -> reset) ------------------
  function initForgotPasswordPage() {
    const requestStep = qs("#request-step");
    const resetStep = qs("#reset-step");
    const requestForm = qs("#request-form");
    const resetForm = qs("#reset-form");

    if (!requestForm) return;

    const requestEmailInput = qs("#forgot-email");
    const requestSubmitBtn = qs("#request-submit");
    const requestMessage = qs("#request-message");

    let verifiedEmail = null;

    requestForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      clearFieldErrors(["email"]);
      showFormMessage(requestMessage, "", null);

      const data = { email: requestEmailInput.value };
      const result = Validation.validateForgotPasswordForm(data);

      if (!result.valid) {
        Object.keys(result.errors).forEach(function (field) {
          setFieldError(field, result.errors[field]);
        });
        return;
      }

      setButtonLoading(requestSubmitBtn, true, "Checking…", "Send reset link");
      await AuthService.requestPasswordReset(data.email);
      setButtonLoading(requestSubmitBtn, false, "Checking…", "Send reset link");

      // Neutral confirmation regardless of account existence — matches how
      // a real Firebase email-link flow reads from the user's perspective.
      verifiedEmail = data.email.trim().toLowerCase();
      showFormMessage(
        requestMessage,
        "If that account exists, you can now set a new password below.",
        "success"
      );

      if (requestStep) requestStep.hidden = true;
      if (resetStep) {
        resetStep.hidden = false;
        resetStep.classList.add("anim-fade-up");
      }
    });

    if (!resetForm) return;

    const newPasswordInput = qs("#new-password");
    const confirmPasswordInput = qs("#confirm-new-password");
    const resetSubmitBtn = qs("#reset-submit");
    const resetMessage = qs("#reset-message");

    resetForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      clearFieldErrors(["password", "confirmPassword"]);
      showFormMessage(resetMessage, "", null);

      if (!verifiedEmail) {
        showFormMessage(resetMessage, "Please verify your email first.", "error");
        return;
      }

      const data = {
        password: newPasswordInput.value,
        confirmPassword: confirmPasswordInput.value,
      };

      const result = Validation.validateResetPasswordForm(data);
      if (!result.valid) {
        Object.keys(result.errors).forEach(function (field) {
          setFieldError(field, result.errors[field]);
        });
        return;
      }

      setButtonLoading(resetSubmitBtn, true, "Updating…", "Update password");

      let outcome;
      try {
        outcome = await AuthService.resetPassword(verifiedEmail, data.password);
      } catch (err) {
        console.error("Password reset failed unexpectedly", err);
        setButtonLoading(resetSubmitBtn, false, "Updating…", "Update password");
        showFormMessage(resetMessage, "Something went wrong updating your password. Please try again.", "error");
        return;
      }

      setButtonLoading(resetSubmitBtn, false, "Updating…", "Update password");

      if (!outcome.success) {
        showFormMessage(resetMessage, outcome.error, "error");
        return;
      }

      showFormMessage(resetMessage, "Password updated! Redirecting to sign in…", "success");
      setTimeout(function () {
        window.location.href = "login.html";
      }, 900);
    });
  }

  window.MindBloomAuthPages = {
    initLoginPage: initLoginPage,
    initSignupPage: initSignupPage,
    initForgotPasswordPage: initForgotPasswordPage,
  };
})(window);

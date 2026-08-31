/* ==========================================================================
   MindBloom — emergency.js
   Controller for emergency.html: the static crisis-line resources (call/
   text 988, text Crisis Text Line — the same numbers api/chat.js's system
   prompt already points students to) plus a user-managed list of trusted
   contacts, read and written through MindBloomData (core/data-store.js)
   the same way the planner reads and writes tasks.
   ========================================================================== */

(function (window, document) {
  "use strict";

  function qs(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  const el = MindBloomUtils.el;
  const showToast = MindBloomUtils.showToast;

  let contacts = [];
  let els = {};

  function cacheElements() {
    els = {
      list: document.getElementById("contact-list"),
      empty: document.getElementById("contact-empty"),
      addBtn: document.getElementById("add-contact-btn"),
      modalOverlay: document.getElementById("contact-modal-overlay"),
      form: document.getElementById("contact-form"),
      cancelBtn: document.getElementById("contact-modal-cancel"),
      nameInput: document.getElementById("contact-name"),
      relationshipInput: document.getElementById("contact-relationship"),
      phoneInput: document.getElementById("contact-phone"),
    };
    MindBloomUtils.initShell("emergency");
  }

  function refresh() {
    contacts = MindBloomData.load().trustedContacts;
  }

  /* ======================================================================
     TRUSTED CONTACTS LIST
     ====================================================================== */
  function renderContacts() {
    els.list.innerHTML = "";
    const isEmpty = !contacts.length;
    els.empty.hidden = !isEmpty;
    els.list.hidden = isEmpty;
    if (isEmpty) return;

    contacts.forEach(function (contact, index) {
      const li = el("li", "emergency-contact card anim-stagger");
      li.style.setProperty("--delay", index * 40 + "ms");

      const body = el(
        "div",
        "emergency-contact__body",
        '<p class="emergency-contact__name">' +
          contact.name +
          "</p>" +
          '<p class="emergency-contact__meta">' +
          [contact.relationship, contact.phone].filter(Boolean).join(" • ") +
          "</p>"
      );

      const actions = el("div", "emergency-contact__actions");

      const callLink = el("a", "btn btn--icon", MindBloomUtils.icon("send", "icon--sm"));
      callLink.href = "tel:" + contact.phone;
      callLink.setAttribute("aria-label", "Call " + contact.name);

      const deleteBtn = el("button", "btn btn--icon", MindBloomUtils.icon("trash", "icon--sm"));
      deleteBtn.type = "button";
      deleteBtn.setAttribute("aria-label", "Remove " + contact.name);
      deleteBtn.addEventListener("click", function () {
        MindBloomData.deleteTrustedContact(contact.id);
        refresh();
        renderContacts();
        showToast("Contact removed");
      });

      actions.appendChild(callLink);
      actions.appendChild(deleteBtn);

      li.appendChild(body);
      li.appendChild(actions);
      els.list.appendChild(li);
    });
  }

  /* ======================================================================
     ADD CONTACT MODAL
     ====================================================================== */
  function openModal() {
    els.form.reset();
    els.modalOverlay.hidden = false;
  }

  function closeModal() {
    els.modalOverlay.hidden = true;
    els.form.reset();
  }

  function wireModal() {
    els.addBtn.addEventListener("click", openModal);
    els.cancelBtn.addEventListener("click", closeModal);
    els.modalOverlay.addEventListener("click", function (e) {
      if (e.target === els.modalOverlay) closeModal();
    });

    els.form.addEventListener("submit", function (e) {
      e.preventDefault();
      const payload = {
        name: els.nameInput.value.trim(),
        relationship: els.relationshipInput.value.trim(),
        phone: els.phoneInput.value.trim(),
      };
      if (!payload.name || !payload.phone) {
        showToast("A name and phone number are required.", "error");
        return;
      }

      MindBloomData.addTrustedContact(payload);
      refresh();
      closeModal();
      renderContacts();
      showToast("Contact added", "success");
    });
  }

  /* ======================================================================
     INIT
     ====================================================================== */
  function init() {
    cacheElements();
    refresh();
    renderContacts();
    wireModal();
  }

  window.MindBloomEmergency = { init: init };

  document.addEventListener("DOMContentLoaded", init);
})(window, document);

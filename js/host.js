// ============================================================
// Host Dashboard — Session Management & Question Board
// ============================================================

(function () {
  const sessionId = getSessionIdFromURL();
  if (!sessionId) {
    window.location.href = "index.html";
    return;
  }

  let currentUser = null;
  let sessionData = null;
  let allQuestions = [];
  let activeFilter = "all";
  let activeSort = "top";
  let searchQuery = "";
  let answeringQuestionId = null;
  let unsubscribeQuestions = null;

  // Firestore refs
  const sessionRef = db.collection("sessions").doc(sessionId);
  const questionsRef = sessionRef.collection("questions");

  document.addEventListener("DOMContentLoaded", async () => {
    initDarkMode();

    currentUser = await ensureAnonymousAuth();
    if (!currentUser) {
      showToast("Authentication failed", "error");
      hideLoading();
      return;
    }

    // Load session data
    try {
      const snap = await sessionRef.get();
      if (!snap.exists) {
        showToast("Session not found", "error");
        hideLoading();
        return;
      }
      sessionData = snap.data();
      renderSessionInfo();
      setupRealtimeListeners();
      setupEventHandlers();
      hideLoading();
    } catch (err) {
      console.error("Load session error:", err);
      showToast("Failed to load session", "error");
      hideLoading();
    }
  });

  // ── Render session info in sidebar ──
  function renderSessionInfo() {
    document.getElementById("sessionTitle").textContent = sessionData.title;
    document.getElementById("sessionCode").textContent = sessionData.code;
    document.title = `${sessionData.title} — Host — LiveQ&A`;

    // QR code
    const joinURL = buildParticipantURL(sessionId);
    document.getElementById("joinLink").value = joinURL;
    renderQRCode(document.getElementById("qrCode"), joinURL, 180);

    // Session status
    updateSessionStatus();

    // Accepting toggle
    document.getElementById("toggleAccepting").checked = sessionData.acceptingQuestions !== false;
  }

  function updateSessionStatus() {
    const dot = document.querySelector(".status-dot");
    const text = document.getElementById("statusText");
    if (sessionData.isActive) {
      dot.className = "status-dot active";
      text.textContent = "Active";
    } else {
      dot.className = "status-dot inactive";
      text.textContent = "Ended";
    }
  }

  // ── Real-time listeners ──
  function setupRealtimeListeners() {
    // Listen to session changes
    sessionRef.onSnapshot((snap) => {
      if (snap.exists) {
        sessionData = snap.data();
        updateSessionStatus();
        document.getElementById("toggleAccepting").checked = sessionData.acceptingQuestions !== false;
        document.getElementById("participantCount").textContent = sessionData.participantCount || 0;
      }
    });

    // Listen to questions
    unsubscribeQuestions = questionsRef.onSnapshot((snap) => {
      allQuestions = [];
      snap.forEach((doc) => {
        allQuestions.push({ id: doc.id, ...doc.data() });
      });
      document.getElementById("questionCount").textContent = allQuestions.length;
      renderQuestions();
      updateSpotlight();
    });
  }

  // ── Sorting & filtering ──
  function getFilteredQuestions() {
    let filtered = [...allQuestions];

    // Filter
    if (activeFilter === "open") {
      filtered = filtered.filter((q) => q.status === "open");
    } else if (activeFilter === "answered") {
      filtered = filtered.filter((q) => q.status === "answered");
    } else if (activeFilter === "pinned") {
      filtered = filtered.filter((q) => q.isPinned);
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (q) =>
          q.text.toLowerCase().includes(query) ||
          (q.participantName || "").toLowerCase().includes(query)
      );
    }

    // Sort: pinned first, then by chosen criteria
    filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if (activeSort === "top") {
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
        return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
      }
      if (activeSort === "newest") {
        return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
      }
      if (activeSort === "oldest") {
        return (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0);
      }
      return 0;
    });

    return filtered;
  }

  // ── Render question cards ──
  function renderQuestions() {
    const list = document.getElementById("questionList");
    const empty = document.getElementById("emptyState");
    const filtered = getFilteredQuestions();

    if (filtered.length === 0) {
      list.innerHTML = "";
      empty.style.display = "flex";
      return;
    }

    empty.style.display = "none";
    list.innerHTML = filtered.map((q) => buildQuestionCard(q)).join("");
    attachCardListeners();
  }

  function buildQuestionCard(q) {
    const badges = [];
    if (q.isPinned) badges.push('<span class="badge badge-pinned">Pinned</span>');
    if (q.isCurrentlyAnswering) badges.push('<span class="badge badge-live">Live</span>');
    if (q.status === "answered") badges.push('<span class="badge badge-answered">Answered</span>');
    if (q.status === "open") badges.push('<span class="badge badge-open">Open</span>');

    const answerHTML = q.answer
      ? `<div class="question-answer"><strong>Answer:</strong> ${escapeHTML(q.answer)}</div>`
      : "";

    return `
      <div class="question-card ${q.isCurrentlyAnswering ? "card-live" : ""} ${q.isPinned ? "card-pinned" : ""}" data-id="${q.id}">
        <div class="question-card-top">
          <div class="question-votes">
            <span class="vote-count">${q.voteCount || 0}</span>
            <span class="vote-label">votes</span>
          </div>
          <div class="question-content">
            <div class="question-meta">
              <span class="question-author">${escapeHTML(q.participantName || "Anonymous")}</span>
              <span class="question-time">${timeAgo(q.createdAt)}</span>
              ${badges.join("")}
            </div>
            <p class="question-text">${escapeHTML(q.text)}</p>
            ${answerHTML}
          </div>
        </div>
        <div class="question-actions">
          <button class="btn-action btn-answer" data-id="${q.id}" title="Answer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Answer
          </button>
          <button class="btn-action btn-spotlight ${q.isCurrentlyAnswering ? "active" : ""}" data-id="${q.id}" title="Currently Answering">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            ${q.isCurrentlyAnswering ? "On Air" : "Spotlight"}
          </button>
          <button class="btn-action btn-pin ${q.isPinned ? "active" : ""}" data-id="${q.id}" title="${q.isPinned ? "Unpin" : "Pin"}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg>
            ${q.isPinned ? "Unpin" : "Pin"}
          </button>
          <button class="btn-action btn-delete" data-id="${q.id}" title="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Remove
          </button>
        </div>
      </div>
    `;
  }

  // ── Spotlight ──
  function updateSpotlight() {
    const section = document.getElementById("spotlightSection");
    const spotQ = allQuestions.find((q) => q.isCurrentlyAnswering);
    if (spotQ) {
      section.style.display = "block";
      document.getElementById("spotlightText").textContent = spotQ.text;
      document.getElementById("spotlightAuthor").textContent =
        `— ${spotQ.participantName || "Anonymous"}`;
    } else {
      section.style.display = "none";
    }
  }

  // ── Card action listeners ──
  function attachCardListeners() {
    // Answer button
    document.querySelectorAll(".btn-answer").forEach((btn) => {
      btn.addEventListener("click", () => openAnswerModal(btn.dataset.id));
    });

    // Spotlight toggle
    document.querySelectorAll(".btn-spotlight").forEach((btn) => {
      btn.addEventListener("click", () => toggleSpotlight(btn.dataset.id));
    });

    // Pin toggle
    document.querySelectorAll(".btn-pin").forEach((btn) => {
      btn.addEventListener("click", () => togglePin(btn.dataset.id));
    });

    // Delete
    document.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", () => confirmDelete(btn.dataset.id));
    });
  }

  // ── Answer modal ──
  function openAnswerModal(questionId) {
    answeringQuestionId = questionId;
    const q = allQuestions.find((q) => q.id === questionId);
    if (!q) return;
    document.getElementById("modalQuestionText").textContent = q.text;
    document.getElementById("answerInput").value = q.answer || "";
    document.getElementById("answerModal").style.display = "flex";
    document.getElementById("answerInput").focus();
  }

  function closeAnswerModal() {
    document.getElementById("answerModal").style.display = "none";
    answeringQuestionId = null;
  }

  async function submitAnswer() {
    if (!answeringQuestionId) return;
    const answer = document.getElementById("answerInput").value.trim();
    try {
      await questionsRef.doc(answeringQuestionId).update({
        answer,
        status: answer ? "answered" : "open",
      });
      showToast("Answer saved!");
      closeAnswerModal();
    } catch (err) {
      console.error("Submit answer error:", err);
      showToast("Failed to save answer", "error");
    }
  }

  // ── Toggle spotlight (currently answering) ──
  async function toggleSpotlight(questionId) {
    const q = allQuestions.find((q) => q.id === questionId);
    if (!q) return;
    const batch = db.batch();
    // Clear any other spotlighted questions
    allQuestions
      .filter((oq) => oq.isCurrentlyAnswering && oq.id !== questionId)
      .forEach((oq) => {
        batch.update(questionsRef.doc(oq.id), { isCurrentlyAnswering: false });
      });
    batch.update(questionsRef.doc(questionId), {
      isCurrentlyAnswering: !q.isCurrentlyAnswering,
    });
    try {
      await batch.commit();
    } catch (err) {
      console.error("Spotlight error:", err);
      showToast("Failed to update spotlight", "error");
    }
  }

  // ── Toggle pin ──
  async function togglePin(questionId) {
    const q = allQuestions.find((q) => q.id === questionId);
    if (!q) return;
    try {
      await questionsRef.doc(questionId).update({ isPinned: !q.isPinned });
    } catch (err) {
      console.error("Pin error:", err);
      showToast("Failed to pin question", "error");
    }
  }

  // ── Delete question ──
  function confirmDelete(questionId) {
    showConfirmModal("Delete Question", "This will permanently remove this question.", async () => {
      try {
        await questionsRef.doc(questionId).delete();
        showToast("Question removed");
      } catch (err) {
        console.error("Delete error:", err);
        showToast("Failed to delete question", "error");
      }
    });
  }

  // ── Confirm modal ──
  let confirmCallback = null;

  function showConfirmModal(title, message, onConfirm) {
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmMessage").textContent = message;
    document.getElementById("confirmModal").style.display = "flex";
    confirmCallback = onConfirm;
  }

  function closeConfirmModal() {
    document.getElementById("confirmModal").style.display = "none";
    confirmCallback = null;
  }

  // ── Setup all event handlers ──
  function setupEventHandlers() {
    // Copy link
    document.getElementById("copyLink").addEventListener("click", () => {
      copyToClipboard(document.getElementById("joinLink").value);
    });

    // Filter tabs
    document.querySelectorAll(".filter-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        activeFilter = tab.dataset.filter;
        renderQuestions();
      });
    });

    // Sort
    document.getElementById("sortSelect").addEventListener("change", (e) => {
      activeSort = e.target.value;
      renderQuestions();
    });

    // Search
    document.getElementById("searchInput").addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      renderQuestions();
    });

    // Toggle accepting questions
    document.getElementById("toggleAccepting").addEventListener("change", async (e) => {
      try {
        await sessionRef.update({ acceptingQuestions: e.target.checked });
        showToast(e.target.checked ? "Now accepting questions" : "Questions paused");
      } catch (err) {
        console.error("Toggle accepting error:", err);
        showToast("Failed to update", "error");
      }
    });

    // Export CSV
    document.getElementById("exportCSV").addEventListener("click", () => {
      const rows = [["Question", "Author", "Votes", "Status", "Answer", "Time"]];
      allQuestions.forEach((q) => {
        rows.push([
          q.text,
          q.participantName || "Anonymous",
          q.voteCount || 0,
          q.status,
          q.answer || "",
          q.createdAt?.toDate?.().toISOString() || "",
        ]);
      });
      downloadCSV(`liveqa-${sessionData.code}-questions.csv`, rows);
      showToast("CSV exported!");
    });

    // Reset session
    document.getElementById("resetSession").addEventListener("click", () => {
      showConfirmModal(
        "Reset Session",
        "This will delete ALL questions. This cannot be undone.",
        async () => {
          try {
            const batch = db.batch();
            allQuestions.forEach((q) => batch.delete(questionsRef.doc(q.id)));
            await batch.commit();
            await sessionRef.update({ participantCount: 0 });
            showToast("Session reset!");
            closeConfirmModal();
          } catch (err) {
            console.error("Reset error:", err);
            showToast("Failed to reset session", "error");
          }
        }
      );
    });

    // End session
    document.getElementById("endSession").addEventListener("click", () => {
      showConfirmModal(
        "End Session",
        "This will close the session. Participants will no longer be able to submit questions.",
        async () => {
          try {
            await sessionRef.update({ isActive: false, acceptingQuestions: false });
            showToast("Session ended");
            closeConfirmModal();
          } catch (err) {
            console.error("End session error:", err);
            showToast("Failed to end session", "error");
          }
        }
      );
    });

    // Answer modal
    document.getElementById("closeAnswerModal").addEventListener("click", closeAnswerModal);
    document.getElementById("cancelAnswer").addEventListener("click", closeAnswerModal);
    document.getElementById("submitAnswer").addEventListener("click", submitAnswer);

    // Confirm modal
    document.getElementById("confirmCancel").addEventListener("click", closeConfirmModal);
    document.getElementById("confirmOk").addEventListener("click", () => {
      if (confirmCallback) confirmCallback();
      closeConfirmModal();
    });

    // Close modals on overlay click
    document.getElementById("answerModal").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeAnswerModal();
    });
    document.getElementById("confirmModal").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeConfirmModal();
    });
  }
})();

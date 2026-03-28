// ============================================================
// Participant View — Submit & Vote on Questions
// ============================================================

(function () {
  const sessionId = getSessionIdFromURL();
  if (!sessionId) {
    window.location.href = "index.html";
    return;
  }

  let currentUser = null;
  let participantName = "Anonymous";
  let sessionData = null;
  let allQuestions = [];
  let myVotes = new Set(); // question IDs the user has voted on
  let activeSort = "top";
  let joined = false;

  // Firestore refs
  const sessionRef = db.collection("sessions").doc(sessionId);
  const questionsRef = sessionRef.collection("questions");

  document.addEventListener("DOMContentLoaded", async () => {
    initDarkMode();

    // Load session data and auth in parallel for speed
    const [sessionSnap, user] = await Promise.all([
      sessionRef.get().catch((err) => {
        console.error("Load session error:", err);
        return null;
      }),
      ensureAnonymousAuth(),
    ]);

    if (!user) {
      showToast("Authentication failed", "error");
      hideLoading();
      return;
    }
    currentUser = user;

    if (!sessionSnap || !sessionSnap.exists) {
      showToast("Session not found", "error");
      hideLoading();
      return;
    }
    sessionData = sessionSnap.data();

    if (!sessionData.isActive) {
      hideLoading();
      document.getElementById("closedOverlay").style.display = "flex";
      return;
    }

    document.getElementById("sessionTitle").textContent = sessionData.title;
    document.getElementById("nameModalSession").textContent = sessionData.title;
    document.title = `${sessionData.title} — LiveQ&A`;

    // Check if already joined (stored in sessionStorage for this tab)
    const savedName = sessionStorage.getItem(`liveqa-name-${sessionId}`);
    if (savedName !== null) {
      participantName = savedName || "Anonymous";
      joined = true;
      startSession();
    } else {
      hideLoading();
      document.getElementById("nameModal").style.display = "flex";
      document.getElementById("participantName").focus();
    }
  });

  // ── Join button ──
  document.addEventListener("click", (e) => {
    if (e.target.id === "joinBtn" || e.target.closest("#joinBtn")) {
      const nameInput = document.getElementById("participantName");
      participantName = nameInput.value.trim() || "Anonymous";
      sessionStorage.setItem(`liveqa-name-${sessionId}`, participantName);
      document.getElementById("nameModal").style.display = "none";
      joined = true;

      // Increment participant count
      sessionRef.update({
        participantCount: firebase.firestore.FieldValue.increment(1),
      }).catch(() => {});

      startSession();
    }
  });

  // Allow Enter key on name input
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && document.activeElement?.id === "participantName") {
      e.preventDefault();
      document.getElementById("joinBtn").click();
    }
  });

  function startSession() {
    hideLoading();
    window.scrollTo(0, 0);
    setupRealtimeListeners();
    setupEventHandlers();
    loadMyVotes();
  }

  // ── Load existing votes for this user ──
  async function loadMyVotes() {
    try {
      // We need to query across all questions' votes subcollections
      // Since Firestore doesn't support collection group queries easily in compat,
      // we load them as questions come in — see vote rendering in renderQuestions
    } catch (err) {
      console.error("Load votes error:", err);
    }
  }

  // ── Real-time listeners ──
  function setupRealtimeListeners() {
    // Listen to session changes
    sessionRef.onSnapshot((snap) => {
      if (!snap.exists) return;
      sessionData = snap.data();
      document.getElementById("sessionTitle").textContent = sessionData.title;

      if (!sessionData.isActive) {
        document.getElementById("closedOverlay").style.display = "flex";
      }

      // Toggle submit section
      const submitSection = document.getElementById("submitSection");
      const notAccepting = document.getElementById("notAccepting");
      const form = document.getElementById("questionForm");
      if (sessionData.acceptingQuestions) {
        form.style.display = "flex";
        notAccepting.style.display = "none";
      } else {
        form.style.display = "none";
        notAccepting.style.display = "flex";
      }
    });

    // Listen to questions
    questionsRef.onSnapshot(async (snap) => {
      allQuestions = [];
      snap.forEach((doc) => {
        allQuestions.push({ id: doc.id, ...doc.data() });
      });
      document.getElementById("questionCount").textContent = allQuestions.length;

      // Load my votes for these questions
      await refreshMyVotes();
      renderQuestions();
    });
  }

  // ── Refresh which questions this user has voted on ──
  async function refreshMyVotes() {
    myVotes.clear();
    const promises = allQuestions.map(async (q) => {
      try {
        const voteDoc = await questionsRef
          .doc(q.id)
          .collection("votes")
          .doc(currentUser.uid)
          .get();
        if (voteDoc.exists && voteDoc.data().voted) {
          myVotes.add(q.id);
        }
      } catch {
        // Ignore individual errors
      }
    });
    await Promise.all(promises);
  }

  // ── Sort questions ──
  function getSortedQuestions() {
    const sorted = [...allQuestions];
    sorted.sort((a, b) => {
      // Pinned first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      if (activeSort === "top") {
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
        return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
      }
      if (activeSort === "newest") {
        return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
      }
      return 0;
    });
    return sorted;
  }

  // ── Render questions ──
  function renderQuestions() {
    const list = document.getElementById("questionList");
    const empty = document.getElementById("emptyState");
    const sorted = getSortedQuestions();

    if (sorted.length === 0) {
      list.innerHTML = "";
      empty.style.display = "flex";
      return;
    }

    empty.style.display = "none";
    list.innerHTML = sorted.map((q) => buildQuestionCard(q)).join("");
    attachVoteListeners();
  }

  function buildQuestionCard(q) {
    const hasVoted = myVotes.has(q.id);
    const badges = [];
    if (q.isPinned) badges.push('<span class="badge badge-pinned">Pinned</span>');
    if (q.isCurrentlyAnswering) badges.push('<span class="badge badge-live">Live</span>');
    if (q.status === "answered") badges.push('<span class="badge badge-answered">Answered</span>');

    const answerHTML = q.answer
      ? `<div class="question-answer"><strong>Answer:</strong> ${escapeHTML(q.answer)}</div>`
      : "";

    return `
      <div class="question-card ${q.isCurrentlyAnswering ? "card-live" : ""}" data-id="${q.id}">
        <div class="question-card-top">
          <button class="vote-btn ${hasVoted ? "voted" : ""}" data-id="${q.id}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${hasVoted ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            <span class="vote-count">${q.voteCount || 0}</span>
          </button>
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
      </div>
    `;
  }

  // ── Vote handling ──
  function attachVoteListeners() {
    document.querySelectorAll(".vote-btn").forEach((btn) => {
      btn.addEventListener("click", () => toggleVote(btn.dataset.id));
    });
  }

  async function toggleVote(questionId) {
    const hasVoted = myVotes.has(questionId);
    const voteRef = questionsRef
      .doc(questionId)
      .collection("votes")
      .doc(currentUser.uid);
    const questionRef = questionsRef.doc(questionId);

    try {
      if (hasVoted) {
        // Remove vote
        await voteRef.delete();
        await questionRef.update({
          voteCount: firebase.firestore.FieldValue.increment(-1),
        });
        myVotes.delete(questionId);
      } else {
        // Add vote
        await voteRef.set({
          voted: true,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });
        await questionRef.update({
          voteCount: firebase.firestore.FieldValue.increment(1),
        });
        myVotes.add(questionId);
      }
      renderQuestions();
    } catch (err) {
      console.error("Vote error:", err);
      showToast("Failed to vote", "error");
    }
  }

  // ── Event handlers ──
  function setupEventHandlers() {
    // Character count
    const questionInput = document.getElementById("questionInput");
    const charCount = document.getElementById("charCount");
    questionInput.addEventListener("input", () => {
      charCount.textContent = questionInput.value.length;
    });

    // Submit question
    document.getElementById("questionForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = questionInput.value.trim();
      if (!text) {
        showToast("Please enter a question", "error");
        return;
      }

      // Duplicate check
      const isDuplicate = allQuestions.some((q) => isSimilar(text, q.text));
      if (isDuplicate) {
        showToast("A similar question already exists. Try voting for it instead!", "error");
        return;
      }

      const btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;

      try {
        await questionsRef.add({
          text,
          participantName,
          participantId: currentUser.uid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          voteCount: 0,
          status: "open",
          isPinned: false,
          isCurrentlyAnswering: false,
          answer: "",
        });
        questionInput.value = "";
        charCount.textContent = "0";
        showToast("Question submitted!");
      } catch (err) {
        console.error("Submit question error:", err);
        showToast("Failed to submit question", "error");
      } finally {
        btn.disabled = false;
      }
    });

    // Sort
    document.getElementById("sortSelect").addEventListener("change", (e) => {
      activeSort = e.target.value;
      renderQuestions();
    });
  }
})();

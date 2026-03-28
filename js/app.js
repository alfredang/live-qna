// ============================================================
// Landing Page — Create / Join Session
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  initDarkMode();

  const createForm = document.getElementById("createForm");
  const joinForm = document.getElementById("joinForm");

  // ── Create a new session ──
  createForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById("sessionTitle");
    const title = titleInput.value.trim();
    if (!title) return;

    const btn = createForm.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Creating…";

    try {
      const user = await ensureAnonymousAuth();
      if (!user) throw new Error("Authentication failed");

      const code = generateSessionCode();
      const sessionRef = await db.collection("sessions").add({
        title,
        code,
        hostId: user.uid,
        isActive: true,
        acceptingQuestions: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        participantCount: 0,
      });

      // Redirect to host dashboard
      window.location.href = `host.html?session=${sessionRef.id}`;
    } catch (err) {
      console.error("Create session error:", err);
      showToast("Failed to create session. Check your Firebase config.", "error");
      btn.disabled = false;
      btn.textContent = "Create Session";
    }
  });

  // ── Join an existing session by code ──
  joinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const codeInput = document.getElementById("joinCode");
    const code = codeInput.value.trim().toUpperCase();
    if (!code) return;

    const btn = joinForm.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Joining…";

    try {
      const snap = await db
        .collection("sessions")
        .where("code", "==", code)
        .limit(1)
        .get();

      if (snap.empty) {
        showToast("Session not found. Check your code.", "error");
        btn.disabled = false;
        btn.textContent = "Join Session";
        return;
      }

      const sessionDoc = snap.docs[0];
      window.location.href = `participant.html?session=${sessionDoc.id}`;
    } catch (err) {
      console.error("Join session error:", err);
      showToast("Failed to look up session.", "error");
      btn.disabled = false;
      btn.textContent = "Join Session";
    }
  });

  // Auto-uppercase session code input
  document.getElementById("joinCode").addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
});

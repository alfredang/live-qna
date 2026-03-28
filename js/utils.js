// ============================================================
// Shared Utilities
// ============================================================

// Generate a short session code (6 uppercase alphanumeric chars)
function generateSessionCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get session ID from URL query param
function getSessionIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("session");
}

// Build the participant join URL for a given session ID
function buildParticipantURL(sessionId) {
  const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, "");
  return `${base}participant.html?session=${sessionId}`;
}

// Build the host URL
function buildHostURL(sessionId) {
  const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, "");
  return `${base}host.html?session=${sessionId}`;
}

// Format a Firestore Timestamp to a readable relative time
function timeAgo(timestamp) {
  if (!timestamp) return "";
  const now = Date.now();
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Math.floor((now - date.getTime()) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Show a toast notification
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast-visible"));
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Escape HTML to prevent XSS
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Simple duplicate detection via Levenshtein-ish similarity
function isSimilar(a, b) {
  const normalize = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  // Check if one contains the other (80%+ overlap)
  if (na.length > 5 && nb.length > 5) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  // Jaccard on words
  const wordsA = new Set(na.split(/\s+/));
  const wordsB = new Set(nb.split(/\s+/));
  if (wordsA.size < 3 || wordsB.size < 3) return false;
  let intersection = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) intersection++; });
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union > 0.7;
}

// Dark mode utilities
function initDarkMode() {
  const saved = localStorage.getItem("liveqa-dark");
  if (saved === "true" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.body.classList.add("dark");
  }
  const toggle = document.getElementById("darkModeToggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      document.body.classList.toggle("dark");
      localStorage.setItem("liveqa-dark", document.body.classList.contains("dark"));
    });
  }
}

// Copy text to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!");
  } catch {
    showToast("Failed to copy", "error");
  }
}

// CSV export helper
function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// QR code generation (uses qrcode-generator library)
function renderQRCode(container, text, size = 200) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const cellSize = Math.floor(size / qr.getModuleCount());
  container.innerHTML = qr.createSvgTag(cellSize, 0);
  // Style the SVG
  const svg = container.querySelector("svg");
  if (svg) {
    svg.style.width = size + "px";
    svg.style.height = size + "px";
    svg.style.borderRadius = "12px";
  }
}

// Hide loading overlay
function hideLoading() {
  const el = document.getElementById("loading-overlay");
  if (el) {
    el.classList.add("fade-out");
    setTimeout(() => el.style.display = "none", 300);
  }
}

// Show loading overlay
function showLoading() {
  const el = document.getElementById("loading-overlay");
  if (el) {
    el.classList.remove("fade-out");
    el.style.display = "flex";
  }
}

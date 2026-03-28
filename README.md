<div align="center">

# LiveQ&A

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

**Real-time audience Q&A and voting platform for workshops, conferences, classrooms, and town halls.**

[Live Demo](https://alfredang.github.io/live-qna/) · [Report Bug](https://github.com/alfredang/live-qna/issues) · [Request Feature](https://github.com/alfredang/live-qna/issues)

</div>

---

## Screenshot

<!-- Add a screenshot of your app here -->
<!-- ![Screenshot](screenshot.png) -->

## About

LiveQ&A is a real-time audience engagement platform inspired by Pigeonhole Live. Hosts create a Q&A session and share a QR code or session code with their audience. Participants submit questions, upvote the ones they care about most, and the best questions rise to the top — all in real time.

### Key Features

| Feature | Description |
|---------|-------------|
| **QR Code Join** | Participants scan a QR code to instantly join a session |
| **Real-Time Sync** | Questions, votes, and answers update live via Firebase |
| **Upvoting** | Audience votes surface the most popular questions |
| **Host Dashboard** | Answer, pin, spotlight, and moderate questions |
| **Anonymous Auth** | No sign-up required — Firebase anonymous auth handles identity |
| **Dark Mode** | System-aware dark/light theme toggle |
| **CSV Export** | Export all questions and answers for post-event review |
| **Duplicate Detection** | Prevents similar questions via word-similarity matching |
| **Mobile-First** | Participant view optimized for phone screens |

## Tech Stack

| Category | Technology |
|----------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Firebase Cloud Firestore (real-time NoSQL) |
| Auth | Firebase Anonymous Authentication |
| QR Code | qrcode-generator (CDN) |
| Hosting | GitHub Pages via GitHub Actions |
| CI/CD | GitHub Actions with secret injection |

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  GitHub Pages                    │
│              (Static Hosting + CDN)              │
└──────────────────────┬──────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   index.html     host.html    participant.html
   (Landing)     (Dashboard)    (Mobile Q&A)
        │              │              │
        └──────────────┼──────────────┘
                       ▼
              ┌────────────────┐
              │  firebase-     │
              │  config.js     │
              │  (SDK init)    │
              └───────┬────────┘
                      ▼
        ┌─────────────────────────┐
        │    Firebase Services    │
        ├─────────────────────────┤
        │  Cloud Firestore        │
        │  ├── sessions/          │
        │  │   ├── questions/     │
        │  │   │   └── votes/     │
        │  Anonymous Auth         │
        └─────────────────────────┘
```

## Project Structure

```
live-qna/
├── index.html              # Landing page — create or join session
├── host.html               # Host dashboard with moderation tools
├── participant.html        # Mobile-friendly participant view
├── css/
│   └── style.css           # Full styling with dark mode support
├── js/
│   ├── firebase-config.js  # Firebase initialization (secrets injected at deploy)
│   ├── utils.js            # Shared helpers (QR, toast, time, CSV, similarity)
│   ├── app.js              # Landing page logic (create/join sessions)
│   ├── host.js             # Host dashboard (moderation, answers, export)
│   └── participant.js      # Participant view (submit, vote, real-time)
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions — builds & deploys to Pages
├── firebase.json           # Firebase Hosting config
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore index config
└── .gitignore
```

## Getting Started

### Prerequisites

- A [Firebase](https://console.firebase.google.com/) project with:
  - **Anonymous Authentication** enabled
  - **Cloud Firestore** database created
- [GitHub CLI](https://cli.github.com/) (optional, for setting secrets)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/alfredang/live-qna.git
   cd live-qna
   ```

2. **Add your Firebase config**

   Edit `js/firebase-config.js` and replace the `__FIREBASE_*__` placeholders with your actual Firebase config values.

3. **Open in browser**
   ```bash
   open index.html
   ```
   Or use any local server (e.g., `npx serve .`).

### Environment Secrets (for GitHub Pages deployment)

Set these secrets in your GitHub repo under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `FIREBASE_API_KEY` | Your Firebase API key |
| `FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `FIREBASE_STORAGE_BUCKET` | `your-project.firebasestorage.app` |
| `FIREBASE_MESSAGING_SENDER_ID` | Your sender ID |
| `FIREBASE_APP_ID` | Your app ID |
| `FIREBASE_MEASUREMENT_ID` | Your measurement ID |

The GitHub Actions workflow injects these at deploy time so secrets never appear in source code.

## Deployment

### GitHub Pages (automated)

Push to `main` and the GitHub Actions workflow handles everything:
1. Checks out code
2. Injects Firebase secrets from GitHub environment
3. Deploys to GitHub Pages

### Firebase Hosting (alternative)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## Firestore Data Model

```
sessions/{sessionId}
  ├── title             (string)
  ├── code              (string, 6-char unique)
  ├── hostId            (string, Firebase UID)
  ├── isActive          (boolean)
  ├── acceptingQuestions (boolean)
  ├── createdAt         (timestamp)
  ├── participantCount  (number)
  │
  └── questions/{questionId}
        ├── text                 (string)
        ├── participantName      (string)
        ├── participantId        (string)
        ├── createdAt            (timestamp)
        ├── voteCount            (number)
        ├── status               (string: open | answered)
        ├── isPinned             (boolean)
        ├── isCurrentlyAnswering (boolean)
        ├── answer               (string)
        │
        └── votes/{participantId}
              ├── voted          (boolean)
              └── timestamp      (timestamp)
```

## Contributing

Contributions are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Developed By

**Dr. Alfred Ang**

## Acknowledgements

- [Firebase](https://firebase.google.com/) — Real-time backend
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) — QR code generation
- [Pigeonhole Live](https://pigeonholelive.com/) — Inspiration

---

<div align="center">

If you found this useful, please give it a ⭐

</div>

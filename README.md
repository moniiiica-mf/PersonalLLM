# monii

A privacy-safe, single-page ChatGPT/Claude-like demo interface built with vanilla HTML, CSS, and JavaScript. No frameworks, no build step, no data storage — just open `index.html` in your browser.

## Quick Start

1. Clone or download this repository.
2. Open `index.html` in any modern browser.
3. Start chatting!

No server, no install, no dependencies.

## Privacy Guarantees

This application is designed to be **fully privacy-safe**:

- **No localStorage, sessionStorage, cookies, or IndexedDB** — zero persistence mechanisms
- **No network requests** — no fetch, XHR, or WebSocket calls of any kind
- **No filesystem or environment access** — the app cannot inspect your system
- **In-memory only** — all conversations exist solely in JavaScript variables and are **cleared on page refresh**
- **Safe DOM rendering** — all user input is rendered via `createElement`/`textContent` (never `innerHTML`), preventing XSS injection
- **Safe math evaluation** — uses a recursive descent parser instead of `eval()` or `Function()`

## Features

- **Clean landing page** with suggested prompt chips
- **Chat interface** with user/assistant message bubbles, typing indicator, auto-scroll
- **Rules-based responder** that handles:
  - Greetings ("hello", "hey", etc.)
  - Math expressions (e.g., `2+2`, `(5+3)/2`, `12 * 7`)
  - Common FAQs (wicked problems, design research, email templates)
  - Helpful fallback with usage suggestions
- **New Chat** button to clear conversation
- **Responsive design** — works on desktop and mobile
- **Accessible** — ARIA labels, focus states, keyboard navigation

## Keyboard Shortcuts

| Action               | Shortcut          |
| -------------------- | ----------------- |
| Send message         | `Enter`           |
| New line in message  | `Shift + Enter`   |

## Project Structure

```
PersonalLLM/
├── index.html    — Page structure and layout
├── styles.css    — All styling (responsive, accessible)
├── app.js        — Chat logic and in-memory rules-based responder
└── README.md     — This file
```

## Deployment

This is a static site. To deploy to GitHub Pages:

1. Push the code to a GitHub repository.
2. Go to **Settings > Pages** in the repository.
3. Under **Source**, select the branch containing the code and set the folder to `/ (root)`.
4. Click **Save**. Your site will be available at `https://<username>.github.io/<repo-name>/`.

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). No polyfills needed.

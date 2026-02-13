# My Personal LLM

A single-page ChatGPT/Claude-like chat interface built with vanilla HTML, CSS, and JavaScript. No frameworks, no build step — just open `index.html` in your browser.

## Quick Start

1. Clone or download this repository.
2. Open `index.html` in any modern browser.
3. Start chatting!

That's it. No server, no install, no dependencies.

## Features

- **Clean landing page** with suggested prompt chips
- **Chat interface** with user/assistant message bubbles
- **Local Basic Brain** — a rules-based responder that works offline:
  - Greetings, current time/date
  - Safe math evaluation (e.g., `2+2`, `(5+3)/2`, `12 * 7`)
  - Common FAQs and helpful fallback messages
- **API Mode** (optional) — connect any LLM backend
- **localStorage persistence** — refresh the page and your chat is still there
- **Responsive design** — works on desktop and mobile
- **Accessible** — ARIA labels, focus states, keyboard navigation
- **Secure** — DOM rendering via `textContent` (no `innerHTML`), safe math parser (no `eval`)

## API Mode

Click the **Settings** gear icon to enable API Mode. When enabled, messages are sent to a configurable backend endpoint.

### API Contract

**Request** — `POST` to the configured endpoint (default: `http://localhost:8080/chat`):

```json
{
  "messages": [
    { "role": "user", "content": "Hello!" },
    { "role": "assistant", "content": "Hi there!" },
    { "role": "user", "content": "What is 2+2?" }
  ]
}
```

**Response** — JSON with a `reply` field:

```json
{
  "reply": "2+2 equals 4!"
}
```

If the API call fails, the app shows a non-intrusive error toast and automatically falls back to the Local Basic Brain.

### Example Backend (Node.js / Express)

Below is a minimal example backend. This is **documentation only** — it is not required to run the app.

```js
const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

app.post("/chat", (req, res) => {
  const { messages } = req.body;
  const lastMessage = messages[messages.length - 1];

  // Replace this with your actual LLM call (OpenAI, Anthropic, local model, etc.)
  const reply = `You said: "${lastMessage.content}". This is a placeholder response.`;

  res.json({ reply });
});

app.listen(8080, () => {
  console.log("Chat backend running on http://localhost:8080");
});
```

Install dependencies and run:

```bash
npm init -y
npm install express cors
node server.js
```

Then enable "Use API" in the app's settings panel.

## Keyboard Shortcuts

| Action               | Shortcut          |
| -------------------- | ----------------- |
| Send message         | `Enter`           |
| New line in message  | `Shift + Enter`   |
| Close settings panel | `Escape`          |

## Project Structure

```
PersonalLLM/
├── index.html    — Page structure and layout
├── styles.css    — All styling (responsive, accessible)
├── app.js        — Chat logic, local brain, API integration
└── README.md     — This file
```

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). No polyfills needed.

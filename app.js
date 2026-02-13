/**
 * My Personal LLM — Privacy-Safe Demo Interface
 *
 * A single-page ChatGPT/Claude-like chat interface that:
 * - Operates entirely in memory (no persistence whatsoever)
 * - Never uses localStorage, sessionStorage, cookies, or IndexedDB
 * - Never makes network requests or accesses localhost endpoints
 * - Never inspects the filesystem or environment
 * - Generates responses solely via in-memory rules-based logic
 * - Renders all content safely via createElement/textContent (no innerHTML)
 *
 * Conversations are cleared on page refresh by design.
 */

(function () {
  "use strict";

  // ===== DOM References =====
  const $ = (sel) => document.querySelector(sel);
  const landing = $("#landing");
  const chatScreen = $("#chatScreen");
  const messagesEl = $("#messages");
  const topBar = $("#topBar");
  const msgInput = $("#msgInput");
  const sendBtn = $("#sendBtn");
  const newChatBtn = $("#newChatBtn");
  const toastContainer = $("#toastContainer");
  const chips = document.querySelectorAll(".chip");

  // ===== In-Memory State (never persisted) =====
  let conversation = []; // Array of { role, content, createdAt }
  let isThinking = false;

  // ===== Init =====
  function init() {
    showLanding();
    bindEvents();
    msgInput.focus();
  }

  // ===== UI Rendering =====

  /** Show the landing screen */
  function showLanding() {
    landing.classList.remove("hidden");
    chatScreen.classList.add("hidden");
    topBar.classList.add("hidden");
  }

  /** Show the chat screen */
  function showChat() {
    landing.classList.add("hidden");
    chatScreen.classList.remove("hidden");
    topBar.classList.remove("hidden");
  }

  /**
   * Append a single message element to the messages container.
   * Uses createElement/textContent exclusively to avoid innerHTML injection.
   */
  function appendMessageEl(msg) {
    const row = document.createElement("div");
    row.className = "msg-row " + msg.role;
    row.setAttribute("role", "article");

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.textContent = msg.content;

    row.appendChild(bubble);

    // Timestamp meta line
    if (msg.createdAt) {
      const meta = document.createElement("div");
      meta.className = "msg-meta";
      meta.textContent = formatTime(msg.createdAt);
      row.appendChild(meta);
    }

    messagesEl.appendChild(row);
  }

  /** Show a typing indicator */
  function showTyping() {
    const el = document.createElement("div");
    el.className = "typing-indicator";
    el.id = "typingIndicator";
    el.setAttribute("aria-label", "Assistant is thinking");
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("span");
      dot.className = "typing-dot";
      el.appendChild(dot);
    }
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  /** Remove the typing indicator */
  function hideTyping() {
    const el = document.getElementById("typingIndicator");
    if (el) el.remove();
  }

  /** Scroll the chat to the bottom */
  function scrollToBottom() {
    chatScreen.scrollTop = chatScreen.scrollHeight;
  }

  /** Format a timestamp for display */
  function formatTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  /** Show a toast notification */
  function showToast(message) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // ===== Event Binding =====

  function bindEvents() {
    // Send message
    sendBtn.addEventListener("click", handleSend);

    // Keyboard: Enter to send, Shift+Enter for newline
    msgInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // Auto-resize textarea
    msgInput.addEventListener("input", autoResize);

    // Prompt chips
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const prompt = chip.getAttribute("data-prompt");
        if (prompt) {
          msgInput.value = prompt;
          autoResize();
          handleSend();
        }
      });
    });

    // New chat
    newChatBtn.addEventListener("click", handleNewChat);
  }

  /** Auto-resize the textarea to fit content */
  function autoResize() {
    msgInput.style.height = "auto";
    msgInput.style.height = Math.min(msgInput.scrollHeight, 150) + "px";
  }

  // ===== Chat Logic =====

  /** Handle sending a message */
  function handleSend() {
    if (isThinking) return;

    const text = msgInput.value.trim();
    if (!text) return;

    // Clear input and resize
    msgInput.value = "";
    autoResize();

    // Add user message to in-memory conversation
    const userMsg = {
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    conversation.push(userMsg);

    // Transition to chat view if first message
    if (conversation.length === 1) {
      showChat();
    }

    appendMessageEl(userMsg);
    scrollToBottom();

    // Generate response with simulated delay
    setThinking(true);
    showTyping();

    const delayMs = 400 + Math.random() * 600;
    setTimeout(() => {
      hideTyping();
      setThinking(false);

      const reply = localBrain(text);
      const assistantMsg = {
        role: "assistant",
        content: reply,
        createdAt: new Date().toISOString(),
      };
      conversation.push(assistantMsg);
      appendMessageEl(assistantMsg);
      scrollToBottom();
    }, delayMs);
  }

  /** Enable/disable the send button and thinking state */
  function setThinking(val) {
    isThinking = val;
    sendBtn.disabled = val;
  }

  /** Handle new chat — clears in-memory conversation */
  function handleNewChat() {
    conversation = [];
    messagesEl.textContent = "";
    showLanding();
    msgInput.value = "";
    autoResize();
    msgInput.focus();
    showToast("Conversation cleared");
  }

  // ===== Local Basic Brain (In-Memory Rules-Based Responder) =====

  /**
   * A simple rules-based responder that generates replies entirely
   * from in-memory logic. No network calls, no storage, no system access.
   */
  function localBrain(input) {
    const text = input.trim();
    const lower = text.toLowerCase();

    // --- Greetings ---
    if (/^(hi|hello|hey|howdy|sup|yo|greetings)\b/i.test(lower)) {
      const greetings = [
        "Hello! How can I help you today?",
        "Hey there! What's on your mind?",
        "Hi! Feel free to ask me anything.",
        "Hello! I'm here to help. What would you like to know?",
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }

    // --- What can you do / Help ---
    if (
      lower.includes("what can you do") ||
      lower.includes("what do you do") ||
      lower.includes("your capabilities")
    ) {
      return [
        "I'm a privacy-safe demo running entirely in your browser. I can:",
        "",
        "- Respond to greetings",
        "- Evaluate simple math expressions (e.g., 2+2, 12*7, (5+3)/2)",
        "- Answer a few common questions",
        "- Provide helpful suggestions",
        "",
        "No data is stored or sent anywhere. Conversations are cleared on refresh.",
      ].join("\n");
    }

    if (lower === "help" || lower === "/help") {
      return [
        "Here are some things you can try:",
        "",
        '- Say "hello" for a greeting',
        '- Type a math expression like "2+2" or "(10+5)*3"',
        '- Ask "what can you do?" to see my capabilities',
        '- Ask "what is a wicked problem?"',
        '- Ask "write a polite email to a professor"',
        "",
        "This is a privacy-safe demo. Nothing is stored or transmitted.",
      ].join("\n");
    }

    // --- FAQ: Wicked problem ---
    if (lower.includes("wicked problem")) {
      return "A wicked problem is a complex issue that is difficult or impossible to solve because of incomplete, contradictory, or changing requirements that are often hard to recognize. The term was coined by design theorists Horst Rittel and Melvin Webber in 1973. Examples include climate change, poverty, and healthcare reform.";
    }

    // --- FAQ: Design research ---
    if (lower.includes("design research")) {
      return "Design research is a systematic investigation into the needs, behaviors, and motivations of people in order to inform and inspire the design of products, services, and experiences.";
    }

    // --- FAQ: Polite email ---
    if (lower.includes("polite email") && lower.includes("professor")) {
      return [
        "Here's a template you can adapt:",
        "",
        "Subject: Question Regarding [Topic]",
        "",
        "Dear Professor [Last Name],",
        "",
        "I hope this message finds you well. My name is [Your Name], and I am currently enrolled in your [Course Name] class.",
        "",
        "I am writing to inquire about [your specific question]. I have reviewed the course materials, but I would appreciate your guidance on this matter.",
        "",
        "Thank you for your time and consideration. I look forward to hearing from you.",
        "",
        "Best regards,",
        "[Your Name]",
        "[Your Student ID]",
      ].join("\n");
    }

    // --- FAQ: Summarize ---
    if (lower.startsWith("summarize")) {
      return "I'd love to help summarize text! However, as a rules-based demo, I can't process long texts intelligently. I can answer common questions, do basic math, and demonstrate the chat interface.\n\nTry typing \"help\" to see what I can do!";
    }

    // --- Math expressions ---
    const mathResult = tryMath(text);
    if (mathResult !== null) {
      return text + " = " + mathResult;
    }

    // --- Fallback ---
    return "I'm a privacy-safe demo with built-in responses only. No data is stored or sent anywhere.\n\nTry asking:\n- \"hello\"\n- A math expression like \"2+2\"\n- \"what is a wicked problem?\"\n- \"help\" for more examples";
  }

  // ===== Safe Math Evaluation =====

  /**
   * Safely evaluate a math expression.
   *
   * Only allows: digits, spaces, parentheses, decimal points,
   * and operators +, -, *, /
   *
   * Uses a recursive descent parser (no eval, no Function constructor).
   * Returns the numeric result or null if the input is not a valid expression.
   */
  function tryMath(input) {
    const expr = input.trim();

    // Quick reject: must contain at least one digit and one operator
    if (!/\d/.test(expr)) return null;
    if (!/[+\-*/]/.test(expr)) return null;

    // Strict whitelist: only allow safe characters
    if (!/^[\d\s()+\-*/.]+$/.test(expr)) return null;

    // Reject empty parens
    if (/\(\s*\)/.test(expr)) return null;

    try {
      const result = parseMathExpression(expr);
      if (result === null || !isFinite(result)) return null;
      // Round to avoid floating point noise
      return Math.round(result * 1e10) / 1e10;
    } catch {
      return null;
    }
  }

  /**
   * Recursive descent parser for basic math.
   * Grammar:
   *   expression = term (('+' | '-') term)*
   *   term       = factor (('*' | '/') factor)*
   *   factor     = '-' factor | '(' expression ')' | number
   */
  function parseMathExpression(str) {
    let pos = 0;

    function skipWhitespace() {
      while (pos < str.length && str[pos] === " ") pos++;
    }

    function parseNumber() {
      skipWhitespace();
      let start = pos;
      if (str[pos] === "-") pos++;
      if (pos >= str.length || (str[pos] < "0" || str[pos] > "9") && str[pos] !== ".") {
        pos = start;
        return null;
      }
      while (pos < str.length && str[pos] >= "0" && str[pos] <= "9") pos++;
      if (pos < str.length && str[pos] === ".") {
        pos++;
        while (pos < str.length && str[pos] >= "0" && str[pos] <= "9") pos++;
      }
      const num = parseFloat(str.substring(start, pos));
      if (isNaN(num)) return null;
      return num;
    }

    function parseFactor() {
      skipWhitespace();
      if (str[pos] === "-") {
        pos++;
        const val = parseFactor();
        if (val === null) return null;
        return -val;
      }
      if (str[pos] === "(") {
        pos++;
        const val = parseExpression();
        skipWhitespace();
        if (str[pos] !== ")") return null;
        pos++;
        return val;
      }
      return parseNumber();
    }

    function parseTerm() {
      let left = parseFactor();
      if (left === null) return null;
      skipWhitespace();
      while (pos < str.length && (str[pos] === "*" || str[pos] === "/")) {
        const op = str[pos];
        pos++;
        const right = parseFactor();
        if (right === null) return null;
        if (op === "*") left *= right;
        else {
          if (right === 0) return null;
          left /= right;
        }
        skipWhitespace();
      }
      return left;
    }

    function parseExpression() {
      let left = parseTerm();
      if (left === null) return null;
      skipWhitespace();
      while (pos < str.length && (str[pos] === "+" || str[pos] === "-")) {
        const op = str[pos];
        pos++;
        const right = parseTerm();
        if (right === null) return null;
        if (op === "+") left += right;
        else left -= right;
        skipWhitespace();
      }
      return left;
    }

    const result = parseExpression();
    skipWhitespace();
    if (pos !== str.length) return null;
    return result;
  }

  // ===== Boot =====
  init();
})();

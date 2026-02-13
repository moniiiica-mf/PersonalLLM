/**
 * My Personal LLM — Vanilla JS Chat Application
 *
 * A single-page ChatGPT/Claude-like chat interface with:
 * - Local rules-based responder ("Local Basic Brain")
 * - Optional API mode for connecting to a backend LLM
 * - localStorage persistence
 * - Safe math evaluation (no raw eval)
 * - DOM-safe rendering (no innerHTML)
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
  const settingsBtnLanding = $("#settingsBtnLanding");
  const settingsBtnTop = $("#settingsBtnTop");
  const settingsOverlay = $("#settingsOverlay");
  const closeSettingsBtn = $("#closeSettings");
  const apiToggle = $("#apiToggle");
  const apiEndpointInput = $("#apiEndpoint");
  const apiSettingsDiv = $("#apiSettings");
  const modeLabel = $("#modeLabel");
  const toastContainer = $("#toastContainer");
  const chips = document.querySelectorAll(".chip");

  // ===== State =====
  const STORAGE_KEY = "personalllm_conversation";
  const SETTINGS_KEY = "personalllm_settings";

  let conversation = []; // Array of { role, content, createdAt }
  let isThinking = false;
  let settings = {
    useApi: false,
    apiEndpoint: "http://localhost:8080/chat",
  };

  // ===== Init =====
  function init() {
    loadSettings();
    loadConversation();
    renderUI();
    bindEvents();
    msgInput.focus();
  }

  // ===== Persistence =====

  /** Load conversation from localStorage */
  function loadConversation() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        conversation = JSON.parse(raw);
      }
    } catch {
      conversation = [];
    }
  }

  /** Save conversation to localStorage */
  function saveConversation() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversation));
    } catch {
      // localStorage may be full; silently ignore
    }
  }

  /** Load settings from localStorage */
  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        settings.useApi = !!saved.useApi;
        if (saved.apiEndpoint) settings.apiEndpoint = saved.apiEndpoint;
      }
    } catch {
      // Use defaults
    }
  }

  /** Save settings to localStorage */
  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Silently ignore
    }
  }

  // ===== UI Rendering =====

  /** Render the full UI state (landing vs. chat) */
  function renderUI() {
    // Update settings UI
    apiToggle.checked = settings.useApi;
    apiEndpointInput.value = settings.apiEndpoint;
    apiSettingsDiv.classList.toggle("hidden", !settings.useApi);
    modeLabel.textContent = settings.useApi ? "API Mode" : "Local Basic Brain";

    if (conversation.length === 0) {
      showLanding();
    } else {
      showChat();
      renderAllMessages();
    }
  }

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

  /** Render all messages from conversation state */
  function renderAllMessages() {
    // Clear existing
    messagesEl.textContent = "";
    conversation.forEach((msg) => appendMessageEl(msg));
    scrollToBottom();
  }

  /**
   * Append a single message element to the messages container.
   * Uses createElement/textContent to avoid innerHTML injection.
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
  function showToast(message, isError) {
    const el = document.createElement("div");
    el.className = "toast" + (isError ? " error" : "");
    el.textContent = message;
    toastContainer.appendChild(el);
    // Auto-remove after animation
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

    // Settings openers
    settingsBtnLanding.addEventListener("click", openSettings);
    settingsBtnTop.addEventListener("click", openSettings);
    closeSettingsBtn.addEventListener("click", closeSettings);

    // Close settings on overlay click
    settingsOverlay.addEventListener("click", (e) => {
      if (e.target === settingsOverlay) closeSettings();
    });

    // Close settings on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !settingsOverlay.classList.contains("hidden")) {
        closeSettings();
      }
    });

    // API toggle
    apiToggle.addEventListener("change", () => {
      settings.useApi = apiToggle.checked;
      apiSettingsDiv.classList.toggle("hidden", !settings.useApi);
      modeLabel.textContent = settings.useApi ? "API Mode" : "Local Basic Brain";
      saveSettings();
    });

    // API endpoint change
    apiEndpointInput.addEventListener("change", () => {
      settings.apiEndpoint = apiEndpointInput.value.trim();
      saveSettings();
    });
  }

  /** Auto-resize the textarea to fit content */
  function autoResize() {
    msgInput.style.height = "auto";
    msgInput.style.height = Math.min(msgInput.scrollHeight, 150) + "px";
  }

  // ===== Settings Panel =====

  function openSettings() {
    settingsOverlay.classList.remove("hidden");
    closeSettingsBtn.focus();
  }

  function closeSettings() {
    settingsOverlay.classList.add("hidden");
    msgInput.focus();
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

    // Add user message
    const userMsg = {
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    conversation.push(userMsg);
    saveConversation();

    // Transition to chat view if first message
    if (conversation.length === 1) {
      showChat();
    }

    appendMessageEl(userMsg);
    scrollToBottom();

    // Generate response
    setThinking(true);
    showTyping();

    generateResponse(text)
      .then((reply) => {
        hideTyping();
        setThinking(false);

        const assistantMsg = {
          role: "assistant",
          content: reply,
          createdAt: new Date().toISOString(),
        };
        conversation.push(assistantMsg);
        saveConversation();
        appendMessageEl(assistantMsg);
        scrollToBottom();
      })
      .catch(() => {
        hideTyping();
        setThinking(false);
      });
  }

  /** Enable/disable the send button and thinking state */
  function setThinking(val) {
    isThinking = val;
    sendBtn.disabled = val;
  }

  /** Handle new chat */
  function handleNewChat() {
    conversation = [];
    saveConversation();
    messagesEl.textContent = "";
    showLanding();
    msgInput.value = "";
    autoResize();
    msgInput.focus();
  }

  // ===== Response Generation =====

  /**
   * Generate a response. Tries API mode first if enabled,
   * falls back to Local Basic Brain on failure.
   */
  async function generateResponse(userText) {
    if (settings.useApi) {
      try {
        return await callApi(userText);
      } catch (err) {
        showToast(
          "API request failed. Falling back to local mode.",
          true
        );
        // Fall through to local brain
      }
    }
    // Simulate slight delay for natural feel
    await delay(400 + Math.random() * 600);
    return localBrain(userText);
  }

  // ===== API Mode =====

  /**
   * Send conversation to the configured API endpoint.
   * Request:  { messages: [{ role, content }, ...] }
   * Response: { reply: "..." }
   */
  async function callApi() {
    const messages = conversation.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(settings.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error("API returned status " + res.status);
      }

      const data = await res.json();

      if (!data.reply || typeof data.reply !== "string") {
        throw new Error("Invalid API response format");
      }

      return data.reply;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  // ===== Local Basic Brain =====

  /**
   * A small rules-based responder that handles common patterns.
   * No external dependencies needed.
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

    // --- Time ---
    if (
      lower.includes("what time") ||
      lower.includes("current time") ||
      lower.includes("time is it")
    ) {
      const now = new Date();
      return (
        "The current local time is " +
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) +
        "."
      );
    }

    // --- Date ---
    if (
      lower.includes("what date") ||
      lower.includes("today's date") ||
      lower.includes("what day")
    ) {
      const now = new Date();
      return (
        "Today is " +
        now.toLocaleDateString([], {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }) +
        "."
      );
    }

    // --- What can you do / Help ---
    if (
      lower.includes("what can you do") ||
      lower.includes("what do you do") ||
      lower.includes("your capabilities")
    ) {
      return [
        "In Local Basic Brain mode, I can:",
        "",
        "- Respond to greetings",
        "- Tell you the current time and date",
        "- Evaluate simple math expressions (e.g., 2+2, 12*7, (5+3)/2)",
        "- Answer a few common questions",
        "- Provide helpful suggestions",
        "",
        'To unlock full conversational AI, enable "Use API" in Settings and connect a backend LLM.',
      ].join("\n");
    }

    if (lower === "help" || lower === "/help") {
      return [
        "Here are some things you can try:",
        "",
        '- Say "hello" for a greeting',
        '- Ask "what time is it?" for the current time',
        '- Type a math expression like "2+2" or "(10+5)*3"',
        '- Ask "what can you do?" to see my capabilities',
        '- Ask "what is a wicked problem?"',
        "",
        "Tip: Open Settings to connect an API backend for full AI conversations.",
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
      return 'I\'d love to help summarize text for you! In Local Basic Brain mode, I can\'t process long texts intelligently. To get real summaries, enable "Use API" in Settings and connect a backend LLM.\n\nFor now, try pasting a shorter text and I\'ll do my best!';
    }

    // --- Math expressions ---
    const mathResult = tryMath(text);
    if (mathResult !== null) {
      return text + " = " + mathResult;
    }

    // --- Fallback ---
    return "I'm running in basic mode with limited built-in responses. Connect an LLM backend via Settings to answer anything!\n\nTry asking:\n- \"hello\"\n- \"what time is it?\"\n- A math expression like \"2+2\"\n- \"help\" for more examples";
  }

  // ===== Safe Math Evaluation =====

  /**
   * Safely evaluate a math expression.
   *
   * Only allows: digits, spaces, parentheses, decimal points,
   * and operators +, -, *, /
   *
   * Uses a simple recursive descent parser instead of eval().
   * Returns the numeric result or null if the input is not a valid expression.
   */
  function tryMath(input) {
    const expr = input.trim();

    // Quick reject: must contain at least one digit and one operator
    if (!/\d/.test(expr)) return null;
    if (!/[+\-*/]/.test(expr)) return null;

    // Strict whitelist: only allow safe characters
    if (!/^[\d\s()+\-*/.]+$/.test(expr)) return null;

    // Reject empty parens or other oddities
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
      // Handle leading negative only inside factor
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
      // Unary minus
      if (str[pos] === "-") {
        pos++;
        const val = parseFactor();
        if (val === null) return null;
        return -val;
      }
      // Parenthesized expression
      if (str[pos] === "(") {
        pos++; // skip '('
        const val = parseExpression();
        skipWhitespace();
        if (str[pos] !== ")") return null;
        pos++; // skip ')'
        return val;
      }
      // Number
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
          if (right === 0) return null; // Division by zero
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
    // Ensure we consumed the entire string
    if (pos !== str.length) return null;
    return result;
  }

  // ===== Utilities =====

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ===== Boot =====
  init();
})();

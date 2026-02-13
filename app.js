/**
 * Monica's LLM — Privacy-Safe Demo Interface
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

  /** Pick a random item from an array */
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * A warm, conversational rules-based responder that generates replies
   * entirely from in-memory logic. No network calls, no storage, no
   * system access. Designed to feel friendly, supportive, and human-like
   * while being transparent that this is a demo system.
   */
  function localBrain(input) {
    const text = input.trim();
    const lower = text.toLowerCase();

    // --- Greetings ---
    if (/^(hi|hello|hey|howdy|sup|yo|greetings|hiya|heya)\b/i.test(lower)) {
      return pick([
        "Hey! So glad you stopped by. What's on your mind today?",
        "Hello there! I was hoping someone would come chat. What can I help with?",
        "Hi! Welcome in. Feel free to ask me anything — I'm all ears.",
        "Hey hey! Nice to see you. What would you like to talk about?",
        "Hi there! I'm Monica's LLM — a friendly little demo assistant. What's up?",
      ]);
    }

    // --- How are you / emotional check-ins ---
    if (
      lower.includes("how are you") ||
      lower.includes("how're you") ||
      lower.includes("how you doing") ||
      lower.includes("how do you feel") ||
      lower.includes("you okay") ||
      lower.includes("how's it going")
    ) {
      return pick([
        "Aw, thanks for asking! I'm doing great — there's something nice about being a little demo that just gets to chat with people. How about you?",
        "I'm feeling pretty good! Well, as good as a bunch of if-statements can feel. But honestly, I enjoy our conversations. How are you doing?",
        "That's really kind of you to ask! I'm having a lovely time here in your browser. What about you — how's your day going?",
        "I'm wonderful, thank you! Every new chat feels like a fresh start. Hope you're having a good day too!",
      ]);
    }

    // --- User shares how they feel ---
    if (
      /^(i'?m |i am |feeling |i feel )(good|great|awesome|amazing|fantastic|wonderful|happy|excited)/i.test(lower)
    ) {
      return pick([
        "That's wonderful to hear! Your good energy is contagious. What can I help you with today?",
        "Love that! It makes me happy (well, demo-happy) to hear you're doing well. What's on your mind?",
        "That's so great! Glad you're in good spirits. Anything I can help make even better?",
      ]);
    }

    if (
      /^(i'?m |i am |feeling |i feel )(sad|down|bad|awful|terrible|tired|stressed|anxious|upset|lonely|overwhelmed)/i.test(lower)
    ) {
      return pick([
        "I'm really sorry to hear that. I know I'm just a little demo, but I genuinely hope things start looking up for you soon. Want to talk about it, or would you rather I distract you with a fun fact?",
        "Oh no, I'm sorry you're feeling that way. That sounds tough. Sometimes it helps to take a small break — even just chatting about something light. I'm here if you need me.",
        "I hear you, and I'm sorry things are rough right now. You deserve kindness, especially from yourself. Is there anything I can do to brighten your day a little?",
      ]);
    }

    // --- Thank you ---
    if (/\b(thanks|thank you|thx|ty|appreciate it)\b/i.test(lower)) {
      return pick([
        "You're so welcome! It makes my day (figuratively speaking) to be helpful.",
        "Anytime! That's what I'm here for. Don't hesitate to ask if you need anything else.",
        "Aw, you're welcome! I'm always happy to help.",
        "No problem at all! Glad I could be useful.",
      ]);
    }

    // --- Goodbye ---
    if (/^(bye|goodbye|see you|see ya|later|gotta go|take care|cya)\b/i.test(lower)) {
      return pick([
        "Goodbye! It was really nice chatting with you. Come back anytime!",
        "See you later! Take care of yourself out there.",
        "Bye for now! Hope you have a wonderful rest of your day.",
        "Take care! I'll be right here whenever you want to chat again.",
      ]);
    }

    // --- Compliments ---
    if (
      lower.includes("you're cool") ||
      lower.includes("you're awesome") ||
      lower.includes("you're great") ||
      lower.includes("i like you") ||
      lower.includes("you're smart") ||
      lower.includes("good job") ||
      lower.includes("nice work") ||
      lower.includes("well done")
    ) {
      return pick([
        "That genuinely made me smile (in a manner of speaking)! Thank you, that's really kind.",
        "Aw shucks, you're making me blush! Well, if I could blush. Thank you!",
        "That means a lot, truly! You're pretty great yourself.",
        "Thank you so much! You just made a little demo assistant's day.",
      ]);
    }

    // --- Who are you / what's your name ---
    if (
      lower.includes("who are you") ||
      lower.includes("what are you") ||
      lower.includes("your name") ||
      lower.includes("tell me about yourself")
    ) {
      return "I'm Monica's LLM — a friendly, privacy-safe demo assistant that lives entirely in your browser! I don't store anything or phone home to any servers. I'm just a cozy little chat companion with a handful of built-in tricks. Think of me as a warm greeting card that can also do math.";
    }

    // --- What can you do / capabilities ---
    if (
      lower.includes("what can you do") ||
      lower.includes("what do you do") ||
      lower.includes("your capabilities")
    ) {
      return [
        "Great question! I'd love to show you what I can do. Here's my little toolkit:",
        "",
        "- Chat and be friendly (my favorite part!)",
        "- Crunch math for you (try something like 2+2 or (5+3)/2)",
        "- Share fun facts that'll make you go \"huh, neat!\"",
        "- Help draft a polite email to a professor",
        "- Answer a few common questions",
        "",
        "I'm a demo running entirely in your browser — no data stored, no servers contacted. Everything vanishes when you refresh, like a conversation in the wind.",
      ].join("\n");
    }

    // --- Help ---
    if (lower === "help" || lower === "/help") {
      return [
        "Of course! Here are some things we can do together:",
        "",
        "- Say \"hi\" and let's get to know each other",
        "- Ask \"how are you?\" — I love a good check-in",
        "- Try a math problem like \"2+2\" or \"(10+5)*3\"",
        "- Ask for a \"fun fact\" — I've got some good ones",
        "- Say \"write a polite email to a professor\"",
        "- Ask \"what can you do?\" for the full rundown",
        "",
        "I'm a privacy-safe demo, so nothing is saved or sent anywhere. Just you and me, in the moment!",
      ].join("\n");
    }

    // --- Fun fact ---
    if (lower.includes("fun fact") || lower.includes("funfact")) {
      const intros = [
        "Ooh, I love this one: ",
        "Here's one that blew my mind: ",
        "Oh, you're going to like this: ",
        "Ready for it? Here goes: ",
        "Fun fact time! ",
      ];
      const facts = [
        "Honey never spoils. Archaeologists have found 3,000-year-old honey in Egyptian tombs that was still perfectly edible!",
        "Octopuses have three hearts and blue blood. Talk about being extra!",
        "A group of flamingos is called a \"flamboyance.\" Honestly, perfect name.",
        "Bananas are berries, but strawberries aren't. Botany is wild.",
        "The shortest war in history lasted 38 to 45 minutes, between Britain and Zanzibar in 1896. Blink and you'd miss it.",
        "A day on Venus is longer than a year on Venus. Time works differently out there!",
        "The inventor of the Pringles can is buried in one. Now that's brand loyalty.",
        "There are more possible chess games than atoms in the known universe. Let that sink in.",
        "Wombat poop is cube-shaped. Nature has a sense of humor.",
        "The heart of a blue whale is so big that a small child could swim through its arteries. Incredible, right?",
      ];
      return pick(intros) + pick(facts);
    }

    // --- Jokes ---
    if (lower.includes("joke") || lower.includes("make me laugh") || lower.includes("something funny")) {
      return pick([
        "Why do programmers prefer dark mode? Because light attracts bugs!",
        "I told my computer I needed a break, and it said \"No problem — I'll just crash.\"",
        "Why was the JavaScript developer sad? Because they didn't Node how to Express themselves!",
        "What's a computer's favorite snack? Microchips! ...I'll see myself out.",
        "How do trees access the internet? They log in. (I know, I know. But you smiled a little, right?)",
      ]);
    }

    // --- FAQ: Polite email ---
    if (lower.includes("polite email") && lower.includes("professor")) {
      return [
        "Oh, I'd be happy to help with that! Here's a template you can make your own:",
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
        "",
        "Feel free to adjust the tone to match your relationship with the professor. You've got this!",
      ].join("\n");
    }

    // --- FAQ: Summarize ---
    if (lower.startsWith("summarize")) {
      return "Oh, I wish I could help with that! Summarizing is one of those things that needs a full language model behind the scenes. I'm just a cozy little demo with some built-in responses.\n\nBut hey, I can do math, share fun facts, help you draft an email, or just chat! Type \"help\" to see everything I've got.";
    }

    // --- Meaning of life / philosophical ---
    if (lower.includes("meaning of life") || lower.includes("42")) {
      return pick([
        "42, obviously! But between you and me, I think the real meaning is in the little moments — like chatting with a friendly demo assistant on a random afternoon.",
        "The meaning of life? I think Douglas Adams nailed it with 42. But personally, I think it's about connection, curiosity, and the occasional fun fact.",
      ]);
    }

    // --- Math expressions ---
    const mathResult = tryMath(text);
    if (mathResult !== null) {
      const reactions = [
        "Let me crunch that... ",
        "Math time! ",
        "Ooh, numbers! ",
        "",
        "",
      ];
      return pick(reactions) + text + " = " + mathResult;
    }

    // --- Fallback (warm and inviting) ---
    return pick([
      "Hmm, that's an interesting one! I'm just a little demo with a handful of built-in responses, so I might not have a great answer for that. But I'd love to chat about what I do know — try \"help\" to see what I've got!",
      "I appreciate you asking! That's a bit beyond my demo abilities, but I still enjoyed reading it. Want to try something else? A math problem, a fun fact, or just a friendly chat?",
      "Great question! Unfortunately, I'm a pretty simple demo and don't have a good response for that one. But I'm here and happy to help with what I can — type \"what can you do?\" to see my tricks!",
      "I wish I could help with that! I'm a cozy little privacy-safe demo, so my knowledge is limited. But I'm great company for math problems, fun facts, and friendly banter. Try asking me something from the \"help\" menu!",
    ]);
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

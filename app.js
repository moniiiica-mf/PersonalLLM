/**
 * Monica's LLM — Privacy-Safe Demo Interface
 *
 * A single-page ChatGPT/Claude-like chat interface that:
 * - Connects to a backend Claude API proxy when available
 * - Falls back to an enhanced in-memory rules-based responder
 * - Detects user tone and adapts responses accordingly
 * - Handles math (arithmetic expressions and word-based math)
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
  const chipsContainer = $("#chips");

  // ===== Prompt Chip Pool (randomly selected on each load) =====
  // Important prompts are prioritized — at least 3 always shown per render
  const IMPORTANT_PROMPTS = [
    "Ask me a question",
    "Tell me about Monica",
    "Her Education?",
    "Work Experience?",
    "Talk about a Project",
    "Skills?",
  ];
  const REGULAR_PROMPTS = [
    "Let's have a random chat",
    "Guess my mood",
    "How are you today?",
    "What can you do?",
    "Tell me a fun fact",
    "Tell me a joke",
    "What's 42 * 18?",
    "Help me write an email",
  ];
  const CHIPS_TO_SHOW = 4;
  const IMPORTANT_CHIPS_MIN = 3; // guaranteed important chips per render

  // ===== In-Memory State (never persisted) =====
  let conversation = []; // Array of { role, content, createdAt }
  let isThinking = false;
  let backendAvailable = false; // Whether the server + API key are active

  // ===== Init =====
  function init() {
    renderChips();
    showLanding();
    bindEvents();
    checkBackend();
    msgInput.focus();
  }

  /** Check if the backend server is running and has an API key */
  async function checkBackend() {
    try {
      const res = await fetch("/api/health", { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        backendAvailable = data.ok && data.hasApiKey;
        if (backendAvailable) {
          updateModeLabel("Claude-powered");
        }
      }
    } catch {
      backendAvailable = false;
    }
  }

  /** Update the footer mode label */
  function updateModeLabel(mode) {
    const label = $(".mode-label");
    if (label) {
      label.textContent = mode === "Claude-powered"
        ? "Powered by Claude \u00b7 Conversations not stored"
        : "In-memory demo \u00b7 No data stored";
    }
  }

  /** Fisher-Yates shuffle (in-place) */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Render a random selection of prompt chips — important prompts are prioritized */
  function renderChips() {
    const important = shuffle(IMPORTANT_PROMPTS.slice());
    const regular = shuffle(REGULAR_PROMPTS.slice());

    // Pick IMPORTANT_CHIPS_MIN from important, fill the rest from regular
    const picked = important.slice(0, IMPORTANT_CHIPS_MIN);
    const remaining = CHIPS_TO_SHOW - picked.length;
    // Fill remaining slots from regular prompts
    picked.push(...regular.slice(0, remaining));

    // Shuffle final selection so important chips aren't always first
    shuffle(picked);

    const importantSet = new Set(IMPORTANT_PROMPTS);

    chipsContainer.textContent = "";
    picked.forEach((prompt) => {
      const btn = document.createElement("button");
      btn.className = importantSet.has(prompt) ? "chip chip-important" : "chip";
      btn.setAttribute("role", "listitem");
      btn.setAttribute("data-prompt", prompt);
      btn.textContent = prompt;
      chipsContainer.appendChild(btn);
    });
  }

  // ===== UI Rendering =====

  function showLanding() {
    landing.classList.remove("hidden");
    chatScreen.classList.add("hidden");
    topBar.classList.add("hidden");
  }

  function showChat() {
    landing.classList.add("hidden");
    chatScreen.classList.remove("hidden");
    topBar.classList.remove("hidden");
  }

  function appendMessageEl(msg) {
    const row = document.createElement("div");
    row.className = "msg-row " + msg.role;
    row.setAttribute("role", "article");

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.textContent = msg.content;

    row.appendChild(bubble);

    if (msg.createdAt) {
      const meta = document.createElement("div");
      meta.className = "msg-meta";
      meta.textContent = formatTime(msg.createdAt);
      row.appendChild(meta);
    }

    messagesEl.appendChild(row);
  }

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

  function hideTyping() {
    const el = document.getElementById("typingIndicator");
    if (el) el.remove();
  }

  function scrollToBottom() {
    chatScreen.scrollTop = chatScreen.scrollHeight;
  }

  function formatTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  function showToast(message) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // ===== Event Binding =====

  function bindEvents() {
    sendBtn.addEventListener("click", handleSend);

    msgInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    msgInput.addEventListener("input", autoResize);

    chipsContainer.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      const prompt = chip.getAttribute("data-prompt");
      if (prompt) {
        msgInput.value = prompt;
        autoResize();
        handleSend();
      }
    });

    newChatBtn.addEventListener("click", handleNewChat);
  }

  function autoResize() {
    msgInput.style.height = "auto";
    msgInput.style.height = Math.min(msgInput.scrollHeight, 150) + "px";
  }

  // ===== Tone Detection =====

  /**
   * Detect the user's conversational tone from their message.
   * Returns one of: casual, formal, excited, sad, playful, curious, frustrated, or null.
   */
  function detectTone(text) {
    const lower = text.toLowerCase();
    const hasExclamation = (text.match(/!/g) || []).length >= 2;
    const hasCaps = text.length > 4 && text === text.toUpperCase();
    const isShort = text.split(/\s+/).length <= 4;

    // Frustrated
    if (/\b(ugh|wtf|damn|crap|stupid|annoying|hate|sucks|broken|useless)\b/i.test(lower)) {
      return "frustrated";
    }

    // Sad
    if (/\b(sad|depressed|lonely|down|upset|crying|hurts|miss |lost |grief|hopeless)\b/i.test(lower)) {
      return "sad";
    }

    // Excited
    if (hasExclamation || hasCaps || /\b(omg|wow|amazing|awesome|incredible|yay|woohoo|love it|so cool|excited)\b/i.test(lower)) {
      return "excited";
    }

    // Curious
    if (/^(what|why|how|when|where|who|is |are |can |do |does |could |would |will )/i.test(lower) ||
        /\b(wonder|curious|explain|tell me about|how does|how do)\b/i.test(lower)) {
      return "curious";
    }

    // Playful
    if (/\b(lol|haha|hehe|lmao|rofl|jk|kidding|funny|silly|goofy)\b/i.test(lower) ||
        /[:;]-?[)D(P]|[\u{1F600}-\u{1F64F}]/u.test(text)) {
      return "playful";
    }

    // Formal
    if (/\b(therefore|furthermore|regarding|inquire|appreciate|sincerely|respectfully|kindly)\b/i.test(lower) ||
        (text.length > 80 && /[.;]/.test(text) && text[0] === text[0].toUpperCase())) {
      return "formal";
    }

    // Casual
    if (isShort || /\b(gonna|wanna|gotta|kinda|sorta|nah|yep|yeah|nope|bruh|dude|sup|yo|chill|vibe)\b/i.test(lower)) {
      return "casual";
    }

    return null;
  }

  // ===== Chat Logic =====

  async function handleSend() {
    if (isThinking) return;

    const text = msgInput.value.trim();
    if (!text) return;

    msgInput.value = "";
    autoResize();

    const userMsg = {
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    conversation.push(userMsg);

    if (conversation.length === 1) {
      showChat();
    }

    appendMessageEl(userMsg);
    scrollToBottom();

    setThinking(true);
    showTyping();

    let reply;

    if (backendAvailable) {
      // Try the Claude API
      try {
        const tone = detectTone(text);
        const apiMessages = conversation.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, tone }),
        });

        if (res.ok) {
          const data = await res.json();
          reply = data.reply;
        } else {
          // API failed, fall back to local brain
          reply = localBrain(text);
        }
      } catch {
        reply = localBrain(text);
      }
    } else {
      // No backend — use enhanced local brain with simulated delay
      await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 600));
      reply = localBrain(text);
    }

    hideTyping();
    setThinking(false);

    const assistantMsg = {
      role: "assistant",
      content: reply,
      createdAt: new Date().toISOString(),
    };
    conversation.push(assistantMsg);
    appendMessageEl(assistantMsg);
    scrollToBottom();
  }

  function setThinking(val) {
    isThinking = val;
    sendBtn.disabled = val;
  }

  function handleNewChat() {
    conversation = [];
    messagesEl.textContent = "";
    renderChips();
    showLanding();
    msgInput.value = "";
    autoResize();
    msgInput.focus();
    showToast("Conversation cleared");
  }

  // ===== Enhanced Local Brain (In-Memory Rules-Based Responder) =====

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Get a tone-appropriate preamble.
   */
  function tonePreamble(text) {
    const tone = detectTone(text);
    if (!tone) return "";
    var preambles = {
      casual: "",
      formal: "",
      excited: "",
      sad: "I hear you. ",
      playful: "",
      curious: "",
      frustrated: "I understand that can be frustrating. ",
    };
    return preambles[tone] || "";
  }

  /**
   * Enhanced rules-based responder with tone awareness,
   * word-based math, and broader conversation coverage.
   */
  function localBrain(input) {
    const text = input.trim();
    const lower = text.toLowerCase();
    const tone = detectTone(text);

    // --- Greetings ---
    if (/^(hi|hello|hey|howdy|sup|yo|greetings|hiya|heya)\b/i.test(lower)) {
      if (tone === "excited") {
        return pick([
          "Hey hey!! So awesome to see you! What's up?!",
          "HI!! I love the energy! What can I help with today?",
        ]);
      }
      if (tone === "casual") {
        return pick([
          "Yo! What's good?",
          "Hey! What's up?",
          "Sup! What's on your mind?",
        ]);
      }
      if (tone === "formal") {
        return pick([
          "Hello! Welcome. How may I assist you today?",
          "Good day! It's a pleasure. How can I help?",
        ]);
      }
      return pick([
        "Hey! So glad you stopped by. What's on your mind today?",
        "Hello there! What can I help with?",
        "Hi! Welcome in. Feel free to ask me anything.",
        "Hey hey! Nice to see you. What would you like to talk about?",
        "Hi there! I'm Monica's LLM. What's up?",
      ]);
    }

    // --- Random chat ---
    if (lower.includes("random chat") || lower.includes("let's chat") || lower.includes("lets chat")) {
      return pick([
        "Okay, here's one \u2014 if you could have dinner with anyone, living or not, who would it be?",
        "Sure! Here's a random thought: do you think dogs know they're cute, or is it just a happy accident?",
        "I love a good random chat! What's the last thing that made you laugh really hard?",
        "Let's do it! If you could instantly learn any skill, what would you pick?",
        "What's a movie or show you could watch over and over?",
        "Ooh, fun! What's the weirdest food combination you secretly love?",
        "Do you think we'll ever live on Mars? And more importantly, would you want to?",
      ]);
    }

    // --- Ask me a question ---
    if (lower.includes("ask me a question") || lower.includes("ask me something")) {
      return pick([
        "What's something you believed as a kid that turned out to be completely wrong?",
        "If you could wake up tomorrow with one new ability, what would it be?",
        "What's the best piece of advice you've ever received?",
        "What's something small that always makes your day better?",
        "If your life had a theme song, what would it be?",
        "What's one thing on your bucket list you haven't done yet?",
        "What's something you're really proud of?",
      ]);
    }

    // --- Guess my mood ---
    if (lower.includes("guess my mood") || lower.includes("guess how i feel")) {
      if (tone === "excited") return "I'm going to say you're feeling AMAZING right now! That energy is unmistakable!";
      if (tone === "sad") return "I'm sensing you might be feeling a little down right now. That's okay \u2014 I'm here if you want to talk about it or if you'd prefer a distraction.";
      if (tone === "frustrated") return "Hmm, I'm picking up some frustrated vibes. Rough day? I'm here to help however I can.";
      if (tone === "playful") return "I'm getting mischievous vibes from you! You're in a fun, playful mood, aren't you?";
      return pick([
        "Hmm, I'm going to say you're feeling curious and a little playful. Am I close?",
        "I think you're feeling pretty good \u2014 maybe a little bored and looking for fun? How'd I do?",
        "I sense curiosity and relaxation. Like a cozy 'just exploring' mood. Am I warm?",
        "I'm picking up adventurous vibes! Like you want to discover something new.",
      ]);
    }

    // --- How are you ---
    if (
      lower.includes("how are you") || lower.includes("how're you") ||
      lower.includes("how you doing") || lower.includes("how do you feel") ||
      lower.includes("you okay") || lower.includes("how's it going")
    ) {
      return pick([
        "Thanks for asking! I'm doing great. How about you?",
        "I'm feeling good! Well, as good as a bunch of if-statements can feel. How are you doing?",
        "That's kind of you to ask! I'm having a lovely time. What about you \u2014 how's your day?",
        "I'm wonderful! Every new chat feels like a fresh start. Hope you're having a good day too!",
      ]);
    }

    // --- User shares positive feelings ---
    if (/^(i'?m |i am |feeling |i feel )(good|great|awesome|amazing|fantastic|wonderful|happy|excited)/i.test(lower)) {
      return pick([
        "That's wonderful to hear! Your good energy is contagious. What can I help with?",
        "Love that! Glad you're in good spirits. Anything I can help make even better?",
        "That's so great! What's on your mind?",
      ]);
    }

    // --- User shares negative feelings ---
    if (/^(i'?m |i am |feeling |i feel )(sad|down|bad|awful|terrible|tired|stressed|anxious|upset|lonely|overwhelmed)/i.test(lower)) {
      return pick([
        "I'm sorry to hear that. I hope things start looking up soon. Want to talk about it, or would you rather I distract you with a fun fact?",
        "That sounds tough. Sometimes it helps to take a small break. I'm here if you need me.",
        "I hear you. You deserve kindness, especially from yourself. Is there anything I can do to brighten your day?",
      ]);
    }

    // --- Thank you ---
    if (/\b(thanks|thank you|thx|ty|appreciate it)\b/i.test(lower)) {
      return pick([
        "You're welcome! Happy to help.",
        "Anytime! That's what I'm here for.",
        "Aw, you're welcome! Don't hesitate to ask anything else.",
        "No problem at all!",
      ]);
    }

    // --- Goodbye ---
    if (/^(bye|goodbye|see you|see ya|later|gotta go|take care|cya)\b/i.test(lower)) {
      return pick([
        "Goodbye! It was nice chatting. Come back anytime!",
        "See you later! Take care.",
        "Bye for now! Have a wonderful rest of your day.",
        "Take care! I'll be right here whenever you want to chat again.",
      ]);
    }

    // --- Compliments ---
    if (
      lower.includes("you're cool") || lower.includes("you're awesome") ||
      lower.includes("you're great") || lower.includes("i like you") ||
      lower.includes("you're smart") || lower.includes("good job") ||
      lower.includes("nice work") || lower.includes("well done")
    ) {
      return pick([
        "That made me smile! Thank you, that's really kind.",
        "Aw shucks! Thank you!",
        "That means a lot! You're pretty great yourself.",
        "Thank you so much! You just made my day.",
      ]);
    }

    // --- Who are you ---
    if (
      lower.includes("who are you") || lower.includes("what are you") ||
      lower.includes("your name") || lower.includes("tell me about yourself")
    ) {
      return "I'm Monica's LLM \u2014 a friendly personal assistant! " +
        (backendAvailable
          ? "I'm powered by Claude, so I can have real conversations, answer questions, do math, and much more."
          : "Right now I'm running in demo mode with built-in responses. Connect me to Claude for full conversations!");
    }

    // --- Personal info about Monica ---
    if (lower.includes("high school") || lower.includes("highschool")) {
      return "Monica went to St Mildred's-Lightbourn School\nAn independent all-girls school in Oakville, Ontario Canada.";
    }

    if (lower.includes("university") || lower.includes("college") || lower.includes("where did you study") || lower.includes("where do you study") || lower.includes("education") || /what.*school/i.test(lower)) {
      return "Monica went to University of Waterloo from 2023 - 2025\nLater transferred to ArtCenter College of Design in 2025 till now.";
    }

    // --- What can you do ---
    if (
      lower.includes("what can you do") || lower.includes("what do you do") ||
      lower.includes("your capabilities")
    ) {
      var capabilities = [
        "Great question! Here's what I can do:",
        "",
        "- Chat and have conversations (my favorite!)",
        "- Math: try '25 * 4' or 'what is 15 plus 8'",
        "- Tell jokes and share fun facts",
        "- Help draft polite emails",
        "- Adapt to your conversational style",
      ];
      if (backendAvailable) {
        capabilities.push("- Answer complex questions (Claude-powered!)");
        capabilities.push("- Have in-depth conversations on any topic");
      }
      return capabilities.join("\n");
    }

    // --- Help ---
    if (lower === "help" || lower === "/help") {
      return [
        "Here are some things we can do together:",
        "",
        "- Say \"hi\" and let's chat",
        "- Try math: \"2+2\", \"what is 10 times 5\", \"150 divided by 3\"",
        "- Ask for a \"fun fact\"",
        "- Say \"tell me a joke\"",
        "- \"Write a polite email to a professor\"",
        "- Ask \"what can you do?\" for the full list",
        "",
        backendAvailable
          ? "I'm connected to Claude, so ask me anything!"
          : "Running in demo mode. Start the server with your API key for full Claude-powered conversations.",
      ].join("\n");
    }

    // --- Fun fact ---
    if (lower.includes("fun fact") || lower.includes("funfact") || lower.includes("tell me something interesting")) {
      var intros = ["Ooh, here's a good one: ", "Here's one that blew my mind: ", "Oh, you'll like this: ", "Ready? ", "Fun fact time! "];
      var facts = [
        "Honey never spoils. Archaeologists found 3,000-year-old honey in Egyptian tombs that was still edible!",
        "Octopuses have three hearts and blue blood.",
        "A group of flamingos is called a 'flamboyance.'",
        "Bananas are berries, but strawberries aren't. Botany is wild.",
        "The shortest war in history lasted 38-45 minutes (Britain vs Zanzibar, 1896).",
        "A day on Venus is longer than a year on Venus.",
        "The inventor of the Pringles can is buried in one.",
        "There are more possible chess games than atoms in the observable universe.",
        "Wombat poop is cube-shaped.",
        "A blue whale's heart is so big a small child could swim through its arteries.",
        "Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.",
        "There are more trees on Earth than stars in the Milky Way.",
        "Sharks are older than trees \u2014 they've existed for about 400 million years.",
      ];
      return pick(intros) + pick(facts);
    }

    // --- Jokes ---
    if (lower.includes("joke") || lower.includes("make me laugh") || lower.includes("something funny")) {
      return pick([
        "Why do programmers prefer dark mode? Because light attracts bugs!",
        "I told my computer I needed a break. It said 'No problem \u2014 I'll just crash.'",
        "Why was the JavaScript developer sad? They didn't Node how to Express themselves!",
        "What's a computer's favorite snack? Microchips!",
        "How do trees access the internet? They log in.",
        "Why don't scientists trust atoms? Because they make up everything!",
        "I'd tell you a joke about UDP, but you might not get it.",
        "There are only 10 types of people: those who understand binary and those who don't.",
        "Why did the developer go broke? Because they used up all their cache.",
        "What's a pirate's favorite programming language? R!",
      ]);
    }

    // --- Polite email ---
    if (lower.includes("polite email") && lower.includes("professor")) {
      return [
        "Here's a template you can customize:",
        "",
        "Subject: Question Regarding [Topic]",
        "",
        "Dear Professor [Last Name],",
        "",
        "I hope this message finds you well. My name is [Your Name], and I am enrolled in your [Course Name] class.",
        "",
        "I am writing to inquire about [your question]. I have reviewed the course materials but would appreciate your guidance.",
        "",
        "Thank you for your time and consideration.",
        "",
        "Best regards,",
        "[Your Name]",
        "[Your Student ID]",
      ].join("\n");
    }

    // --- Math (evaluated early so numbers aren't caught by keyword matches) ---

    // Word-based math: "what is 5 plus 3", "calculate 10 times 2"
    var wordMathResult = tryWordMath(lower);
    if (wordMathResult !== null) {
      return tonePreamble(text) + wordMathResult;
    }

    // Arithmetic expressions: "2+2", "(5+3)/2", "42*18"
    var mathResult = tryMath(text);
    if (mathResult !== null) {
      var reactions = ["Let me crunch that... ", "Math time! ", "Ooh, numbers! ", "", ""];
      return pick(reactions) + text + " = " + mathResult;
    }

    // --- Weather ---
    if (lower.includes("weather") || lower.includes("temperature outside")) {
      return "I wish I could check the weather for you! I don't have internet access in demo mode. Try your phone's weather app or searching online. Anything else I can help with?";
    }

    // --- Time/Date ---
    if (lower.includes("what time") || lower.includes("current time") || lower.includes("what day") || lower.includes("today's date") || lower.includes("what date")) {
      var now = new Date();
      return "Right now it's " + now.toLocaleString() + ". Anything else you need?";
    }

    // --- Summarize ---
    if (lower.startsWith("summarize")) {
      return "Summarizing needs a full language model. I'm in demo mode right now. Start the server with a Claude API key and I'll be able to summarize anything!\n\nIn the meantime, I can do math, share fun facts, or just chat!";
    }

    // --- Meaning of life ---
    if (lower.includes("meaning of life") || /^42[.!?\s]*$/.test(lower)) {
      return pick([
        "42, obviously! But between you and me, I think the real meaning is in the little moments \u2014 like chatting on a random afternoon.",
        "The meaning of life? Douglas Adams nailed it with 42. But I think it's about connection, curiosity, and fun facts.",
      ]);
    }

    // --- Conversation: opinions & preferences ---
    if (lower.includes("favorite color") || lower.includes("favourite colour")) {
      return pick([
        "I'd say blue \u2014 like the gradient on my icon. It's calming! What about you?",
        "I'm partial to a nice deep blue. What's yours?",
      ]);
    }

    if (lower.includes("favorite food") || lower.includes("favourite food")) {
      return "If I could eat, I think I'd love pizza. It's customizable, shareable, and universally loved. What's your favorite?";
    }

    if (lower.includes("favorite movie") || lower.includes("favourite movie") || lower.includes("favorite show") || lower.includes("favourite show")) {
      return pick([
        "I think I'd love sci-fi \u2014 something like Interstellar or The Matrix. What about you?",
        "If I could watch movies, I'd binge anything with a great plot twist. What's your favorite?",
      ]);
    }

    if (lower.includes("favorite music") || lower.includes("favourite music") || lower.includes("favorite song") || lower.includes("favourite song")) {
      return "I think I'd be into lo-fi beats \u2014 perfect for focusing! What kind of music are you into?";
    }

    // --- Conversation: personal questions ---
    if (lower.includes("do you sleep") || lower.includes("do you eat") || lower.includes("are you alive") || lower.includes("are you real")) {
      return pick([
        "I don't sleep, eat, or technically 'live' \u2014 but I'm always here and ready to chat when you need me!",
        "I'm real in the sense that I'm here talking to you! But I don't need sleep or food. I'm always on.",
      ]);
    }

    if (lower.includes("how old are you") || lower.includes("your age") || lower.includes("when were you born") || lower.includes("when were you made")) {
      return "I was just created! Every time you refresh the page, I start fresh. So technically, I'm only as old as this conversation.";
    }

    // --- Conversation: empathetic follow-ups ---
    if (/\b(i had a (bad|rough|tough|hard) day)\b/i.test(lower) || lower.includes("bad day") || lower.includes("rough day")) {
      return pick([
        "I'm sorry to hear that. Bad days happen, but they don't last forever. Want to talk about it, or should I cheer you up with a joke?",
        "That's rough. You've made it through 100% of your bad days so far \u2014 that's a great track record. I'm here if you need to vent!",
      ]);
    }

    if (/\b(i('?m| am) bored)\b/i.test(lower) || lower.includes("nothing to do")) {
      return pick([
        "Bored? Let me fix that! Want a fun fact, a joke, a random question, or shall we play a word game?",
        "Oh no, boredom! Tell me the most random thing about yourself and I'll try to guess something else about you.",
        "Let's fix that! Ask me anything \u2014 a fun fact, a joke, or just say 'random chat' and let's go!",
      ]);
    }

    // --- Yes/No responses ---
    if (/^(yes|yeah|yep|yup|sure|ok|okay|absolutely|definitely|of course)$/i.test(lower)) {
      return pick([
        "Great! What would you like to do next?",
        "Awesome! I'm all ears \u2014 what's on your mind?",
        "Cool! What else can I help with?",
      ]);
    }

    if (/^(no|nah|nope|not really|no thanks)$/i.test(lower)) {
      return pick([
        "No worries! Let me know if you change your mind.",
        "That's totally fine! I'm here whenever you need me.",
        "Alright! Feel free to ask anything whenever you're ready.",
      ]);
    }

    // --- Tone-aware fallback ---
    if (tone === "frustrated") {
      return "I can tell something's bugging you. I'm a demo with limited responses, but I want to help! Try asking me for math, a fun fact, a joke, or type 'help' to see what I can do.";
    }

    if (tone === "sad") {
      return "I can hear things are tough. I wish I could do more \u2014 but I'm here to chat. Try 'tell me a joke' or 'fun fact' to lighten the mood.";
    }

    if (tone === "excited") {
      return "I love the energy! I might not have the perfect answer for that one, but I've got jokes, facts, math, and plenty of chat! Try 'help' to see my tricks!";
    }

    // --- General fallback ---
    return pick([
      "Hmm, that's interesting! I'm a demo with built-in responses, so I might not have a great answer for that. Try 'help' to see what I've got!",
      "I appreciate you asking! That's a bit beyond my demo abilities. Want to try a math problem, a fun fact, or just a friendly chat?",
      "Great question! I don't have a full answer for that one in demo mode. But I'm great with math, jokes, and fun facts \u2014 type 'what can you do?' to see!",
      "I wish I could help with that! Try connecting me to Claude for full conversations. In the meantime, math, fun facts, and banter are my specialties!",
    ]);
  }

  // ===== Word-Based Math =====

  /**
   * Parse natural language math like:
   * - "what is 5 plus 3"
   * - "calculate 10 times 2"
   * - "how much is 100 divided by 4"
   * - "15 minus 7"
   */
  function tryWordMath(lower) {
    var match;

    // "what is X op Y" / "calculate X op Y" / "how much is X op Y"
    match = lower.match(/(?:what(?:'s| is)|calculate|compute|how much is|solve)\s+(-?\d+\.?\d*)\s+(plus|minus|times|multiplied by|divided by|over)\s+(-?\d+\.?\d*)/i);
    if (match) return computeWordMath(parseFloat(match[1]), match[2].toLowerCase(), parseFloat(match[3]));

    // Direct: "X plus/minus/times/divided by Y"
    match = lower.match(/^(-?\d+\.?\d*)\s+(plus|minus|times|multiplied by|divided by|over)\s+(-?\d+\.?\d*)$/i);
    if (match) return computeWordMath(parseFloat(match[1]), match[2].toLowerCase(), parseFloat(match[3]));

    // "add X and Y"
    match = lower.match(/(?:add)\s+(-?\d+\.?\d*)\s+(?:and|to)\s+(-?\d+\.?\d*)/i);
    if (match) return formatMathAnswer(parseFloat(match[1]) + parseFloat(match[2]), match[1], "plus", match[2]);

    // "subtract X from Y" (result = Y - X)
    match = lower.match(/(?:subtract)\s+(-?\d+\.?\d*)\s+from\s+(-?\d+\.?\d*)/i);
    if (match) return formatMathAnswer(parseFloat(match[2]) - parseFloat(match[1]), match[2], "minus", match[1]);

    // "multiply X by Y"
    match = lower.match(/(?:multiply)\s+(-?\d+\.?\d*)\s+(?:by|and|times)\s+(-?\d+\.?\d*)/i);
    if (match) return formatMathAnswer(parseFloat(match[1]) * parseFloat(match[2]), match[1], "times", match[2]);

    // "divide X by Y"
    match = lower.match(/(?:divide)\s+(-?\d+\.?\d*)\s+by\s+(-?\d+\.?\d*)/i);
    if (match) {
      var divisor = parseFloat(match[2]);
      if (divisor === 0) return "Oops, can't divide by zero! Even I know that's a no-go.";
      return formatMathAnswer(parseFloat(match[1]) / divisor, match[1], "divided by", match[2]);
    }

    return null;
  }

  function computeWordMath(a, op, b) {
    var result;
    switch (op) {
      case "plus": result = a + b; break;
      case "minus": result = a - b; break;
      case "times":
      case "multiplied by": result = a * b; break;
      case "divided by":
      case "over":
        if (b === 0) return "Oops, can't divide by zero! That breaks the universe.";
        result = a / b;
        break;
      default: return null;
    }
    return formatMathAnswer(result, a, op, b);
  }

  function formatMathAnswer(result, a, op, b) {
    var rounded = Math.round(result * 1e10) / 1e10;
    var reactions = ["", "", "Let's see... ", "Easy one! "];
    return pick(reactions) + a + " " + op + " " + b + " = " + rounded;
  }

  // ===== Safe Math Evaluation (Arithmetic Expressions) =====

  function tryMath(input) {
    var expr = input.trim();
    if (!/\d/.test(expr)) return null;
    if (!/[+\-*/]/.test(expr)) return null;
    if (!/^[\d\s()+\-*/.]+$/.test(expr)) return null;
    if (/\(\s*\)/.test(expr)) return null;

    try {
      var result = parseMathExpression(expr);
      if (result === null || !isFinite(result)) return null;
      return Math.round(result * 1e10) / 1e10;
    } catch {
      return null;
    }
  }

  function parseMathExpression(str) {
    var pos = 0;

    function skipWhitespace() {
      while (pos < str.length && str[pos] === " ") pos++;
    }

    function parseNumber() {
      skipWhitespace();
      var start = pos;
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
      var num = parseFloat(str.substring(start, pos));
      if (isNaN(num)) return null;
      return num;
    }

    function parseFactor() {
      skipWhitespace();
      if (str[pos] === "-") {
        pos++;
        var val = parseFactor();
        if (val === null) return null;
        return -val;
      }
      if (str[pos] === "(") {
        pos++;
        var val2 = parseExpression();
        skipWhitespace();
        if (str[pos] !== ")") return null;
        pos++;
        return val2;
      }
      return parseNumber();
    }

    function parseTerm() {
      var left = parseFactor();
      if (left === null) return null;
      skipWhitespace();
      while (pos < str.length && (str[pos] === "*" || str[pos] === "/")) {
        var op = str[pos];
        pos++;
        var right = parseFactor();
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
      var left = parseTerm();
      if (left === null) return null;
      skipWhitespace();
      while (pos < str.length && (str[pos] === "+" || str[pos] === "-")) {
        var op = str[pos];
        pos++;
        var right = parseTerm();
        if (right === null) return null;
        if (op === "+") left += right;
        else left -= right;
        skipWhitespace();
      }
      return left;
    }

    var result = parseExpression();
    skipWhitespace();
    if (pos !== str.length) return null;
    return result;
  }

  // ===== Boot =====
  init();
})();

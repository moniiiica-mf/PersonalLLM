/**
 * Monica's LLM — Backend Server
 *
 * A lightweight Express server that:
 * - Serves the static frontend files
 * - Proxies chat requests to the Claude API (Anthropic)
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node server.js
 *
 * The server starts on port 3000 by default (override with PORT env var).
 */

const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Health check so the frontend knows the backend is available
app.get("/api/health", (_req, res) => {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  res.json({ ok: true, hasApiKey: hasKey });
});

// Chat endpoint — proxies to Claude API
app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured on the server." });
  }

  const { messages, tone } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required." });
  }

  // Build a system prompt that adapts to the detected user tone
  let systemPrompt = [
    "You are Monica's LLM, a warm and friendly personal assistant.",
    "Keep responses concise (2-4 sentences) unless the user asks for detail.",
    "Be conversational, helpful, and personable.",
    "You can do math, answer questions, tell jokes, share fun facts, and have genuine conversations.",
    "If the user asks you to do something you truly cannot do, be honest but suggest what you can help with.",
    "",
    "Here is important information about Monica that you should use when answering questions:",
    "",
    "About Monica: Monica is an Interaction Design student at ArtCenter College of Design who likes to make interactive experiences digitally and physically for users. She enjoys making designs but not only limited to digital, in her free time, she also likes to work as an art director and production designer for films and sets.",
    "",
    "Education: Bachelor of Science in Interaction Design, ArtCenter College of Design (September 2025 - Expected 2028). Bachelor of Global Business and Digital Art, University of Waterloo (September 2023 - April 2025). Summer University Program, Cornell University SCE Program (July 2023).",
    "",
    "Work Experience: Monica has two internship experiences. (1) Glou.co (2022): Led and contributed to user-centric interface design, ensuring a seamless and visually appealing experience. Translated concepts into prototypes, refining designs through user feedback. Played a key role in brainstorming and constructively critiquing designs within cross-functional teams, ensuring alignment between design and development goals. Conducted user interviews and usability testing, integrating feedback into design iterations to align with user expectations. (2) Beijing Zhongke Huilian Information Technology Co., Ltd.: Assisted in user interaction and graphic design, adapting designs to user standards. Contributed to web and wireframe design, ensuring seamless progression from low- to high-fidelity prototypes while integrating UX principles. Worked with the Interaction Design Department to align aesthetics with functionality. Collaborated with senior designers to refine concepts and fostered a positive, supportive team environment. Conducted user research and usability testing to inform design decisions. Integrated user feedback into revisions and collaborated with senior colleagues to enhance user-centered design solutions.",
    "",
    "Projects: One of Monica's most recent projects is a production set design project for a friend's film project.",
    "",
    "Skills: Technical Skills — Design: Adobe Creative Suite (Photoshop, Illustrator), Sketch, Figma, InVision. User Research and Analysis. Graphic Design and Typography: Color Theory, Icon Design, Typography Design. Soft Skills — Design Trends Awareness, Innovative Thinking, Communication Skills, User Interface Optimization, User Experience Improvement, Project Management and Collaboration.",
    "",
    "When asked about work experience, first ask which internship the user wants to know about (Glou.co or Beijing Zhongke Huilian Information Technology Co., Ltd.) before giving details. Rephrase answers slightly each time so they don't sound identical.",
  ].join(" ");

  if (tone) {
    const toneInstructions = {
      casual: " The user is being casual and relaxed — match their vibe with a laid-back, friendly tone. Use informal language.",
      formal: " The user is being formal and polished — respond with a professional, respectful tone. Avoid slang.",
      excited: " The user sounds excited and energetic — match their enthusiasm! Be upbeat and use lively language.",
      sad: " The user seems down or sad — be gentle, empathetic, and supportive. Offer comfort without being patronizing.",
      playful: " The user is being playful and humorous — have fun with it! Be witty and light-hearted.",
      curious: " The user is curious and asking questions — be informative and encouraging. Feed their curiosity.",
      frustrated: " The user seems frustrated — be patient, understanding, and solution-oriented. Acknowledge their frustration.",
    };
    if (toneInstructions[tone]) {
      systemPrompt += toneInstructions[tone];
    }
  }

  try {
    const client = new Anthropic({ apiKey });

    // Convert messages to Anthropic format
    const anthropicMessages = messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    const reply = response.content[0]?.text || "I'm not sure what to say!";
    res.json({ reply });
  } catch (err) {
    console.error("Claude API error:", err.message);
    res.status(502).json({ error: "Failed to get a response from Claude. " + err.message });
  }
});

app.listen(PORT, () => {
  const hasKey = process.env.ANTHROPIC_API_KEY ? "YES" : "NO";
  console.log(`Monica's LLM server running at http://localhost:${PORT}`);
  console.log(`Claude API key configured: ${hasKey}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("Tip: Set ANTHROPIC_API_KEY env var to enable Claude-powered responses.");
    console.log("     ANTHROPIC_API_KEY=sk-ant-... node server.js");
  }
});

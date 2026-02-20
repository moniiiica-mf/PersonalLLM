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

/*
Minimal Node.js + Express backend that calls OpenAI Chat API to request an AI move.
Save as server.js and run: `npm init -y && npm install express node-fetch dotenv` then:
`node server.js`

Important:
- Set env var OPENAI_API_KEY to your API key (or create a .env file with OPENAI_API_KEY=...).
- This endpoint expects JSON { fen: "...", history: [...] } and will return { move: "e2e4" }.

This example instructs ChatGPT (via the Chat Completions API) to reply with a single UCI move string only.
*/
import express from "express";
import "dotenv/config";
import cors from "cors";
const app = express();
app.use(express.json());
app.use(cors()); // allow local dev; remove or restrict in production

const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_KEY) {
  console.warn(
    "OPENAI_API_KEY not set. Set environment variable before running the server."
  );
}

const moveMatcher = /\b[a-h][1-8][a-h][1-8][qrbn]?\b/i; // regex to match UCI move like e2e4 or e7e8q

app.post("/ai-move", async (req, res) => {
  try {
    const { fen, history } = req.body;

    if (!fen) {
      return res.status(400).send("Missing next move");
    }

    // Craft a strict prompt asking the model to return a single move in UCI format.
    const system = `You are a chess move generator. You MUST respond with exactly one move in UCI format (e.g. e2e4, g1f3, e7e8q for promotion) and nothing else. Do NOT include commentary, explanation, JSON, or any extra text. If you cannot find a legal move, respond with PASS. Use standard algebraic coordinates: a1..h8. Assume position FEN provided is to move. Use reasonable chess knowledge but do not invent illegal moves. Avoid castling if unclear.`;
    const user = `FEN: Move history: ${JSON.stringify(
      history.map(({from, to}, i) => `${i+1}. ${from}-${to}`)
    )}\nRespond with one UCI move only.`;
    console.log("Prompting model with:", user);
    // Use Chat Completions or Responses endpoint depending on availability.
    // Here we call the Chat Completions endpoint.
    const body = {
      model: process.env.GPT_MODEL  || "gpt-4o-mini", // placeholder model; replace with available ChatGPT model in your account
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("OpenAI error", r.status, txt);
      return res.status(500).send("OpenAI API error: " + txt);
    }
    const j = await r.json();
    console.log(JSON.stringify(j));
    const reply =
      j.choices &&
      j.choices[0] &&
      j.choices[0].message &&
      j.choices[0].message.content;
    if (!reply) {
      return res.status(500).send("Empty reply from OpenAI");
    }
    // Extract first token that looks like a move pattern (e.g. e2e4 or e7e8q)
    const m = reply.trim().match(moveMatcher);
    const move = m ? m[0].replace("-", "") : null;
    if (!move) {
      console.warn("Could not parse move from model reply:", reply);
      return res.json({ move: null, raw: reply });
    }
    return res.json({ move });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// serve index.html or similar at / for easy testing
app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/index.html");
});

// simple help page
app.get("/help", (req, res) => {
  res.send(
    'AI chess move server. POST /ai-move with JSON { fen: "...", history: [...] }'
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AI server listening on ${PORT}`));

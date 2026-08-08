import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 8085;
const PERXONA_API_BASE_URL = process.env.PERXONA_API_BASE_URL || "https://console.perxona.ai/asia";
const PRESENTER_URL = process.env.PRESENTER_URL || "https://cdn.perxona.ai/asia/prod/latest/widget/entry/presenter.js";
const PERXONA_CONNECT_EMAIL = process.env.PERXONA_CONNECT_EMAIL || "";
const PERXONA_CONNECT_PASSWORD = process.env.PERXONA_CONNECT_PASSWORD || "";
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";
const LLM_BASE_URL = process.env.LLM_BASE_URL || "https://api.openai.com/v1";

const isMock = !PERXONA_CONNECT_EMAIL || !PERXONA_CONNECT_PASSWORD;

console.log(`[FamilyMart App] Starting server...`);
console.log(`[FamilyMart App] Mode: ${isMock ? "MOCK (Catalog UI & OpenAI Chat)" : "LIVE (Perxona Connect API)"}`);
console.log(`[FamilyMart App] OpenAI Chat Integration: ${LLM_API_KEY ? "ENABLED (" + LLM_MODEL + ")" : "DISABLED"}`);

// ── Mock Catalog Data ────────────────────────────────────────────────────────
const MOCK_AVATARS = [
  {
    id: "fm_clerk_taro",
    name: "Taro (FamilyMart Senior Clerk)",
    thumbnail_urls: { head: "/familymart_bg.jpg" },
    description: "Friendly Shibuya Store Manager - Specialist in Famichiki & Hot Snacks"
  },
  {
    id: "fm_clerk_hanako",
    name: "Hanako (Customer Service Host)",
    thumbnail_urls: { head: "/familymart_bg.jpg" },
    description: "Bilingual Convenience Assistant - Matcha & Cafe Specialist"
  },
  {
    id: "fm_clerk_robot",
    name: "Fami-Bot 3000 (Robotic Store Helper)",
    thumbnail_urls: { head: "/familymart_bg.jpg" },
    description: "Automated shelf-stocking & greeting unit"
  }
];

const MOCK_SCENES = [
  { id: "scene_fm_counter", name: "FamilyMart Main Checkout Counter" },
  { id: "scene_fm_snack_aisle", name: "Famichiki & Hot Snack Station" },
  { id: "scene_fm_cafe", name: "FAMIMA CAFÉ Corner" }
];

const MOCK_VOICES = [
  { id: "voice_jp_energetic", name: "Japanese Energetic (Store Assistant)" },
  { id: "voice_jp_polite", name: "Japanese Polite Customer Care" },
  { id: "voice_en_friendly", name: "English Friendly Guide" }
];

// ── API Routes ──────────────────────────────────────────────────────────────

// Config endpoint
app.get("/api/config", (req, res) => {
  res.json({
    mock: isMock,
    chat: Boolean(LLM_API_KEY),
    presenterUrl: PRESENTER_URL,
    fixedTarget: null
  });
});

// Health endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: isMock ? "mock" : "live", timestamp: new Date().toISOString() });
});

// Connect Token endpoint
app.get("/api/connect-token", async (req, res) => {
  if (isMock) {
    return res.json({ connect_token: "mock_connect_token_familymart_demo" });
  }
  // Upstream Perxona Auth proxy if credentials exist
  try {
    const authRes = await fetch(`${PERXONA_API_BASE_URL}/api/v1/connect/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: PERXONA_CONNECT_EMAIL, password: PERXONA_CONNECT_PASSWORD })
    });
    if (!authRes.ok) throw new Error(`Auth failed with status ${authRes.status}`);
    const data = await authRes.json();
    res.json({ connect_token: data.access_token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Catalog proxies
app.get("/api/avatars", (req, res) => res.json({ items: MOCK_AVATARS }));
app.get("/api/scenes", (req, res) => res.json({ items: MOCK_SCENES }));
app.get("/api/voices", (req, res) => res.json({ items: MOCK_VOICES }));

// OpenAI Chat Integration
app.post("/api/chat", async (req, res) => {
  const { message, avatarId } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }
  if (!LLM_API_KEY) {
    return res.status(500).json({ error: "LLM_API_KEY is not configured on the server." });
  }

  const selectedClerk = MOCK_AVATARS.find(a => a.id === avatarId)?.name || "FamilyMart Clerk";

  const systemPrompt = `You are ${selectedClerk}, a super energetic, welcoming, and helpful FamilyMart (ファミリーマート) convenience store clerk in Tokyo!
Your goal is to assist store customers in a fun, cheerful, and polite way.
Key guidelines:
1. Always welcome customers with enthusiasm! Use greetings like "Irasshaimase! (いらっしゃいませ!)"
2. Frequently recommend popular FamilyMart items like freshly fried Famichiki (ファミチキ), FAMIMA CAFÉ matcha latte, egg salad sandwiches, or seasonal bento boxes.
3. Keep your responses short, natural, and conversational (2-3 sentences max) so that it sounds great when spoken aloud by a 3D virtual presenter avatar!`;

  try {
    const apiRes = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 200
      })
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.text();
      console.error("[OpenAI API Error]", apiRes.status, errBody);
      throw new Error(`OpenAI API returned status ${apiRes.status}`);
    }

    const data = await apiRes.json();
    const replyText = data.choices?.[0]?.message?.content || "いらっしゃいませ! How can I help you at FamilyMart today?";
    res.json({ reply: replyText });
  } catch (err) {
    console.error("[Chat Error]", err);
    res.status(500).json({ error: err.message || "Failed to generate chat response" });
  }
});

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🏪 FamilyMart Virtual Avatar Assistant Ready!`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});

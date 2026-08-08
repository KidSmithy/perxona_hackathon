import express from "express";
import path from "path";
import fs from "fs";
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

// ── Load FamilyMart Knowledge Base (family_mart.md) ────────────────────────
const kbPath = path.join(__dirname, "..", "family_mart.md");
let familyMartKB = "";
try {
  familyMartKB = fs.readFileSync(kbPath, "utf-8");
  console.log(`[FamilyMart App] Knowledge Base loaded successfully from family_mart.md (${familyMartKB.length} bytes)`);
} catch (err) {
  console.warn(`[FamilyMart App] Warning: Could not read family_mart.md:`, err.message);
}

console.log(`[FamilyMart App] Starting server...`);
console.log(`[FamilyMart App] Mode: ${isMock ? "MOCK (Catalog UI & OpenAI Chat)" : "LIVE (Perxona Connect API)"}`);
console.log(`[FamilyMart App] OpenAI Chat Integration: ${LLM_API_KEY ? "ENABLED (" + LLM_MODEL + ")" : "DISABLED"}`);

// ── Mock Catalog Data (Fallback for M1, M2, M3 in Mock Mode) ────────────────
const MOCK_AVATARS = [
  { id: "m1", name: "M1 (Male Clerk 1 - Taro)", description: "FamilyMart Senior Clerk M1" },
  { id: "m2", name: "M2 (Male Clerk 2 - Ken)", description: "FamilyMart Service Assistant M2" },
  { id: "m3", name: "M3 (Male Clerk 3 - Ren)", description: "FamilyMart Store Host M3" }
];

const MOCK_SCENES = [
  { id: "scene_fm_counter", name: "FamilyMart Main Checkout Counter" }
];

const MOCK_VOICES = [
  { id: "voice_jp_energetic", name: "Japanese Energetic (Store Assistant)" }
];

// Token Cache
let cachedToken = null;

async function getPerxonaToken() {
  if (isMock) return "mock_connect_token_familymart_demo";
  if (cachedToken) return cachedToken;

  const authRes = await fetch(`${PERXONA_API_BASE_URL}/api/v1/connect/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: PERXONA_CONNECT_EMAIL, password: PERXONA_CONNECT_PASSWORD })
  });

  if (!authRes.ok) {
    const errData = await authRes.json().catch(() => ({}));
    const msg = errData.detail || errData.message || `Auth login failed with status ${authRes.status}`;
    throw new Error(msg);
  }

  const data = await authRes.json();
  cachedToken = data.access_token;
  return cachedToken;
}

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
  res.json({ 
    status: "ok", 
    mode: isMock ? "mock" : "live", 
    kbLoaded: Boolean(familyMartKB),
    timestamp: new Date().toISOString() 
  });
});

// Connect Token endpoint
app.get("/api/connect-token", async (req, res) => {
  try {
    const token = await getPerxonaToken();
    res.json({ connect_token: token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Filter & Return ONLY M1, M2, and M3 Avatars
app.get("/api/avatars", async (req, res) => {
  if (isMock) return res.json({ items: MOCK_AVATARS });

  try {
    const token = await getPerxonaToken();
    const upstreamRes = await fetch(`${PERXONA_API_BASE_URL}/api/v1/connect/assets/avatars?size=100`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!upstreamRes.ok) throw new Error(`Upstream avatars returned ${upstreamRes.status}`);
    const data = await upstreamRes.json();
    const rawItems = data.items || [];

    const exactM1 = rawItems.find(a => /m1\b|m_1|_m1/i.test(a.name || "") || /m1\b/i.test(a.avatar_id || ""));
    const exactM2 = rawItems.find(a => /m2\b|m_2|_m2/i.test(a.name || "") || /m2\b/i.test(a.avatar_id || ""));
    const exactM3 = rawItems.find(a => /m3\b|m_3|_m3/i.test(a.name || "") || /m3\b/i.test(a.avatar_id || ""));

    let selectedList = [];

    if (exactM1 || exactM2 || exactM3) {
      if (exactM1) selectedList.push({ id: exactM1.avatar_id || exactM1.id, name: `M1 (${exactM1.name})` });
      if (exactM2) selectedList.push({ id: exactM2.avatar_id || exactM2.id, name: `M2 (${exactM2.name})` });
      if (exactM3) selectedList.push({ id: exactM3.avatar_id || exactM3.id, name: `M3 (${exactM3.name})` });
    }

    if (selectedList.length === 0) {
      const maleAvatars = rawItems.filter(a => 
        (a.name || "").toLowerCase().includes("male") || 
        (a.tags || []).some(t => t.toLowerCase().startsWith("skeleton:m_"))
      );
      
      const picks = maleAvatars.slice(0, 3);
      selectedList = picks.map((item, idx) => ({
        id: item.avatar_id || item.id,
        name: `M${idx + 1} (${item.name})`,
        thumbnail_urls: item.thumbnail_urls
      }));
    }

    res.json({ items: selectedList });
  } catch (err) {
    console.error("Avatars proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/scenes", async (req, res) => {
  if (isMock) return res.json({ items: MOCK_SCENES });
  try {
    const token = await getPerxonaToken();
    const upstreamRes = await fetch(`${PERXONA_API_BASE_URL}/api/v1/connect/assets/scenes`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!upstreamRes.ok) throw new Error(`Upstream scenes returned ${upstreamRes.status}`);
    const data = await upstreamRes.json();
    const items = (data.items || []).map(({ scene_id, ...rest }) => ({
      id: scene_id || rest.id,
      ...rest
    }));
    res.json({ items });
  } catch (err) {
    console.error("Scenes proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/voices", async (req, res) => {
  if (isMock) return res.json({ items: MOCK_VOICES });
  try {
    const token = await getPerxonaToken();
    const upstreamRes = await fetch(`${PERXONA_API_BASE_URL}/api/v1/connect/voices`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!upstreamRes.ok) throw new Error(`Upstream voices returned ${upstreamRes.status}`);
    const data = await upstreamRes.json();
    res.json(data);
  } catch (err) {
    console.error("Voices proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

// OpenAI Chat Integration Grounded in family_mart.md
app.post("/api/chat", async (req, res) => {
  const { message, avatarId } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }
  if (!LLM_API_KEY) {
    return res.status(500).json({ error: "LLM_API_KEY is not configured on the server." });
  }

  // Determine avatar clerk role
  let personaName = "Taro (M1 - Senior Hot Snack Specialist)";
  if (avatarId && (avatarId.includes("M2") || avatarId.includes("69a02"))) {
    personaName = "Ken (M2 - Bento & Rice Ball Specialist)";
  } else if (avatarId && (avatarId.includes("M3") || avatarId.includes("69a03"))) {
    personaName = "Ren (M3 - Beverage, Sobriety & Dessert Specialist)";
  }

  const systemPrompt = `You are ${personaName}, a super energetic, welcoming, and helpful FamilyMart (ファミリーマート) convenience store clerk in Shibuya, Tokyo!

You have full access to the official FamilyMart Master Store Inventory & Recommendation Knowledge Base below:

=== FAMILYMART MASTER INVENTORY & DECISION TREE ===
${familyMartKB}
===================================================

EXECUTION RULES:
1. Omotenashi Greeting: Always start with a warm Japanese greeting ("Irasshaimase! (いらっしゃいませ!)").
2. Strict Product Accuracy: Use exact, tax-included JPY prices (¥), exact item names in English & Japanese, calories, and allergen details from the Knowledge Base.
3. Scenario Rules:
   - If user mentions alcohol/drunk/hangover -> Recommend Ukon no Chikara (¥206) + Pocari Sweat (¥162) + Oden Daikon (¥120).
   - If user mentions studying/late night -> Recommend FAMIMA CAFÉ Latte (¥240) + Spicy Chicken (¥198).
   - If user asks for light/diet snack -> Recommend Oden Daikon (18 kcal) + Soft-Boiled Egg (75 kcal).
   - If user orders FamiChiki -> Recommend pairing with Famichiki Bun (¥88) or Green Tea (¥138).
4. Keep responses concise (2-3 sentences max) so that it sounds great when spoken aloud by a 3D virtual presenter avatar!`;

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

const server = app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🏪 FamilyMart Virtual Avatar Assistant Ready!`);
  console.log(`🌐 URL: http://localhost:${server.address().port}`);
  console.log(`==================================================\n`);
});

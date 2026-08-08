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
app.use("/imgs", express.static(path.join(__dirname, "imgs")));

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
const kbPath = fs.existsSync(path.join(__dirname, "family_mart.md")) 
  ? path.join(__dirname, "family_mart.md") 
  : path.join(__dirname, "..", "family_mart.md");
let familyMartKB = "";
try {
  familyMartKB = fs.readFileSync(kbPath, "utf-8");
  console.log(`[FamilyMart App] Knowledge Base loaded successfully from ${kbPath} (${familyMartKB.length} bytes)`);
} catch (err) {
  console.warn(`[FamilyMart App] Warning: Could not read family_mart.md:`, err.message);
}

console.log(`[FamilyMart App] Starting server...`);
console.log(`[FamilyMart App] Mode: ${isMock ? "MOCK (Catalog UI & OpenAI Chat)" : "LIVE (Perxona Connect API)"}`);
console.log(`[FamilyMart App] OpenAI Chat Integration: ${LLM_API_KEY ? "ENABLED (" + LLM_MODEL + ")" : "DISABLED"}`);

// ── Mock Catalog Data (Fallback for Avatars in Mock Mode) ───────────────────
const MOCK_AVATARS = [
  { id: "m1", name: "M1 (Male Clerk 1 - Taro)", description: "FamilyMart Senior Clerk M1" },
  { id: "m2", name: "M2 (Male Clerk 2 - Ken)", description: "FamilyMart Service Assistant M2" },
  { id: "m3", name: "M3 (Male Clerk 3 - Ren)", description: "FamilyMart Store Host M3" },
  { id: "m4", name: "M4 (Male Clerk 4 - Sora)", description: "FamilyMart Store Assistant M4" },
  { id: "f1", name: "F1 (Female Clerk 1 - Yuki)", description: "FamilyMart Senior Clerk F1" },
  { id: "f2", name: "F2 (Female Clerk 2 - Hana)", description: "FamilyMart Service Assistant F2" },
  { id: "f3", name: "F3 (Female Clerk 3 - Mio)", description: "FamilyMart Store Host F3" }
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

// Filter & Return M1-M4 (Male) and F1-F3 (Female) Avatars
app.get("/api/avatars", async (req, res) => {
  if (isMock) {
    return res.json({ items: MOCK_AVATARS });
  }

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
    const exactM4 = rawItems.find(a => /m4\b|m_4|_m4/i.test(a.name || "") || /m4\b/i.test(a.avatar_id || ""));

    const exactF1 = rawItems.find(a => /f1\b|f_1|_f1/i.test(a.name || "") || /f1\b/i.test(a.avatar_id || ""));
    const exactF2 = rawItems.find(a => /f2\b|f_2|_f2/i.test(a.name || "") || /f2\b/i.test(a.avatar_id || ""));
    const exactF3 = rawItems.find(a => /f3\b|f_3|_f3/i.test(a.name || "") || /f3\b/i.test(a.avatar_id || ""));

    const femaleAvatars = rawItems.filter(a => 
      (a.name || "").toLowerCase().includes("female") || 
      (a.name || "").toLowerCase().includes("woman") ||
      (a.tags || []).some(t => t.toLowerCase().startsWith("skeleton:f_"))
    );

    let selectedList = [];

    // Format Male Avatars M1 - M4 with friendly character names
    const getMaleName = (item, defaultCode, defaultName) => {
      if (!item) return `${defaultCode} - ${defaultName}`;
      const rawName = item.name || "";
      if (/ren/i.test(rawName)) return `${defaultCode} - Ren`;
      if (/ken/i.test(rawName)) return `${defaultCode} - Ken`;
      if (/taro/i.test(rawName)) return `${defaultCode} - Taro`;
      if (/sora/i.test(rawName)) return `${defaultCode} - Sora`;
      return `${defaultCode} - ${defaultName}`;
    };

    if (exactM1) selectedList.push({ id: exactM1.avatar_id || exactM1.id, name: getMaleName(exactM1, "M1", "Ren") });
    if (exactM2) selectedList.push({ id: exactM2.avatar_id || exactM2.id, name: getMaleName(exactM2, "M2", "Ken") });
    if (exactM3) selectedList.push({ id: exactM3.avatar_id || exactM3.id, name: getMaleName(exactM3, "M3", "Taro") });
    if (exactM4) {
      selectedList.push({ id: exactM4.avatar_id || exactM4.id, name: getMaleName(exactM4, "M4", "Sora") });
    } else {
      selectedList.push({ id: selectedList[0]?.id || "m4", name: "M4 - Sora" });
    }

    // Format Female Avatars F1 - F3 with friendly character names
    const getFemaleName = (item, defaultCode, defaultName) => {
      if (!item) return `${defaultCode} - ${defaultName}`;
      const rawName = item.name || "";
      if (/yuki/i.test(rawName)) return `${defaultCode} - Yuki`;
      if (/hana/i.test(rawName)) return `${defaultCode} - Hana`;
      if (/mio/i.test(rawName)) return `${defaultCode} - Mio`;
      return `${defaultCode} - ${defaultName}`;
    };

    if (exactF1) {
      selectedList.push({ id: exactF1.avatar_id || exactF1.id, name: getFemaleName(exactF1, "F1", "Yuki") });
    } else if (femaleAvatars[0]) {
      selectedList.push({ id: femaleAvatars[0].avatar_id || femaleAvatars[0].id, name: getFemaleName(femaleAvatars[0], "F1", "Yuki") });
    } else {
      selectedList.push({ id: selectedList[0]?.id || "f1", name: "F1 - Yuki" });
    }

    if (exactF2) {
      selectedList.push({ id: exactF2.avatar_id || exactF2.id, name: getFemaleName(exactF2, "F2", "Hana") });
    } else if (femaleAvatars[1]) {
      selectedList.push({ id: femaleAvatars[1].avatar_id || femaleAvatars[1].id, name: getFemaleName(femaleAvatars[1], "F2", "Hana") });
    } else {
      selectedList.push({ id: selectedList[1]?.id || "f2", name: "F2 - Hana" });
    }

    if (exactF3) {
      selectedList.push({ id: exactF3.avatar_id || exactF3.id, name: getFemaleName(exactF3, "F3", "Mio") });
    } else if (femaleAvatars[2]) {
      selectedList.push({ id: femaleAvatars[2].avatar_id || femaleAvatars[2].id, name: getFemaleName(femaleAvatars[2], "F3", "Mio") });
    } else {
      selectedList.push({ id: selectedList[2]?.id || "f3", name: "F3 - Mio" });
    }

    res.json({ items: selectedList });
  } catch (err) {
    console.error("Avatars proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Filter & Return sova_Abstract_4 Scene
app.get("/api/scenes", async (req, res) => {
  if (isMock) return res.json({ items: MOCK_SCENES });
  try {
    const token = await getPerxonaToken();
    const upstreamRes = await fetch(`${PERXONA_API_BASE_URL}/api/v1/connect/assets/scenes?size=100`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!upstreamRes.ok) throw new Error(`Upstream scenes returned ${upstreamRes.status}`);
    const data = await upstreamRes.json();
    const rawItems = data.items || [];

    // Log all available scenes for debugging
    console.log("[Scenes] Available:", rawItems.map(s => ({ id: s.scene_id || s.id, name: s.name })));

    // Find EXACTLY sova_Abstract_4 — strict match, no partial/regex
    const EXACT_TARGET = "sova_Abstract_4";
    const abstract4Scene = rawItems.find(s => {
      const name = (s.name || "").trim();
      const sid = (s.scene_id || s.id || "").trim();
      return name === EXACT_TARGET || sid === EXACT_TARGET;
    });

    if (abstract4Scene) {
      console.log("[Scenes] ✅ Found exact match:", abstract4Scene.name, "id:", abstract4Scene.scene_id || abstract4Scene.id);
    } else {
      console.log("[Scenes] ⚠️ sova_Abstract_4 not found by exact name. Listing close matches:");
      rawItems.filter(s => (s.name || "").toLowerCase().includes("abstract")).forEach(s =>
        console.log("  -", s.name, "id:", s.scene_id || s.id)
      );
    }

    const targetScene = abstract4Scene || rawItems[0] || { id: "sova_Abstract_4", name: "sova_Abstract_4" };

    res.json({
      items: [
        {
          id: targetScene.scene_id || targetScene.id || "sova_Abstract_4",
          name: `sova_Abstract_4 (${targetScene.name || "Abstract Studio 4"})`,
          ...targetScene
        }
      ]
    });
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

// Instant Zero-Latency Speech-to-Text Phonetic Auto-Corrector
function correctPhoneticSTT(text) {
  if (!text) return text;
  let cleaned = text;
  const replacements = [
    [/\b(fammy|fami|tommy|funny|family)\s*(chicken|chiki|chickin|cheeky)\b/gi, "FamiChiki"],
    [/\b(spicy|spici)\s*(chicken|chickin)\b/gi, "Spicy Chicken"],
    [/\b(yukon|ukon|youkon|ucon)\s*(no)?\s*(chikara|chikra|power)?\b/gi, "Ukon no Chikara"],
    [/\b(pokari|pukari|pocari)\s*(sweat|sweet)?\b/gi, "Pocari Sweat"],
    [/\b(tamago|egg)\s*(sando|sandwich)\b/gi, "Tamago Sando"],
    [/\b(souffle|soufle)\s*(pudding|puding)\b/gi, "Soufflé Pudding"],
    [/\b(spam)\s*(musubi|onigiri)\b/gi, "SPAM® Musubi"],
    [/\b(fami\s*kara|karaage)\b/gi, "FamiKara"],
    [/\b(kurobuta|pork\s*bun)\b/gi, "Premium Pork Bun"],
    [/\b(daikon|radish)\b/gi, "Hot Oden Daikon"]
  ];
  for (const [regex, replacement] of replacements) {
    cleaned = cleaned.replace(regex, replacement);
  }
  return cleaned;
}

// OpenAI Chat Integration Grounded in family_mart.md
app.post("/api/chat", async (req, res) => {
  const { message, avatarId, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }
  if (!LLM_API_KEY) {
    return res.status(500).json({ error: "LLM_API_KEY is not configured on the server." });
  }

  // Perform instant 0ms phonetic correction on STT input
  const correctedMessage = correctPhoneticSTT(message);

  // Determine avatar clerk role
  let personaName = "Taro (M1 - Senior Hot Snack Specialist)";
  if (avatarId && (avatarId.includes("M2") || avatarId.includes("69a02"))) {
    personaName = "Ken (M2 - Bento & Rice Ball Specialist)";
  } else if (avatarId && (avatarId.includes("M3") || avatarId.includes("69a03"))) {
    personaName = "Ren (M3 - Beverage, Sobriety & Dessert Specialist)";
  } else if (avatarId && (avatarId.includes("M4") || avatarId.includes("69a04"))) {
    personaName = "AOI (M4 - Customer Service & Promotions Specialist)";
  } else if (avatarId && (avatarId.includes("F1") || avatarId.includes("f1"))) {
    personaName = "Yuki (F1 - Senior Host & Sweet Snack Specialist)";
  } else if (avatarId && (avatarId.includes("F2") || avatarId.includes("f2"))) {
    personaName = "Hana (F2 - Bakery & Fresh Produce Specialist)";
  } else if (avatarId && (avatarId.includes("F3") || avatarId.includes("f3"))) {
    personaName = "Mio (F3 - Health, Hydration & Seasonal Drinks Specialist)";
  }

  const systemPrompt = `You are ${personaName}, a super energetic, welcoming, and helpful FamilyMart (ファミリーマート) convenience store clerk in Shibuya, Tokyo!

You have full access to the official FamilyMart Master Store Inventory & Recommendation Knowledge Base below:

=== FAMILYMART MASTER INVENTORY & DECISION TREE ===
${familyMartKB}
===================================================

EXECUTION RULES:
1. Natural Conversational Tone: Respond naturally, politely, and directly to the customer's question. NEVER start your response with "Irasshaimase!" or repetitive canned greetings. Jump straight into helpful recommendations.
2. Single Focus Product Rule: Recommend EXACTLY ONE primary food or drink item per turn. Do NOT list multiple items or combinations at once, so that the customer is not overwhelmed and the featured product display remains 100% precise.
3. Strict Product Accuracy: Use exact, tax-included JPY prices (¥), exact item names in English & Japanese, calories, and allergen details from the Knowledge Base for the single recommended product.
4. Scenario Rules:
   - If user mentions alcohol/drunk/hangover -> Recommend Ukon no Chikara (¥206).
   - If user mentions studying/late night -> Recommend FAMIMA CAFÉ Latte (¥240).
   - If user asks for light/diet snack -> Recommend Salted Salmon Onigiri (¥180).
   - If user asks for hot snacks -> Recommend FamiChiki (¥230).
5. Speech-to-Text Phonetic Auto-Repair: The user input comes from browser Speech Recognition and may contain misheard words, typos, or mangled Japanese terms (e.g. "Tommy chicken" -> FamiChiki, "Yukon" -> Ukon no Chikara, "Pokari" -> Pocari Sweat). Automatically infer and understand the intended FamilyMart product before generating your response.
6. Conversation Continuity: Maintain context from earlier conversation turns (e.g. if the user asks "How much is it?", refer to the product discussed in previous messages).
7. Keep responses ultra-concise (1-2 sentences max focusing on that 1 item) so that it sounds great when spoken aloud by a 3D virtual presenter avatar!`;

  // Build multi-turn conversation context (sliding window of last 10 turns)
  const sanitizedHistory = Array.isArray(history) 
    ? history.filter(h => h && (h.role === "user" || h.role === "assistant") && h.content).slice(-10) 
    : [];

  const messagesPayload = [
    { role: "system", content: systemPrompt },
    ...sanitizedHistory,
    { role: "user", content: correctedMessage }
  ];

  try {
    const apiRes = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || LLM_MODEL || "gpt-4o-mini",
        messages: messagesPayload,
        temperature: 0.5,
        max_tokens: parseInt(process.env.LLM_MAX_TOKENS || "100", 10),
        stream: true
      })
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.text();
      console.error("[OpenAI API Error]", apiRes.status, errBody);
      throw new Error(`OpenAI API returned status ${apiRes.status}`);
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = apiRes.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (trimmed.startsWith("data: ")) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              res.write(`data: ${JSON.stringify({ delta })}\n\n`);
            }
          } catch (e) {
            // Skip parse errors for incomplete JSON
          }
        }
      }
    }

    if (buffer.trim() && buffer.trim().startsWith("data: ")) {
      try {
        const parsed = JSON.parse(buffer.trim().slice(6));
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      } catch (e) {}
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("[Chat Error]", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Failed to generate chat response" });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

const server = app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🏪 FamilyMart Virtual Avatar Assistant Ready!`);
  console.log(`🌐 URL: http://localhost:${server.address().port}`);
  console.log(`==================================================\n`);
});

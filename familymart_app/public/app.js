// FamilyMart Avatar Assistant Client App

// ── DOM References ─────────────────────────────────────────────────────────
const statusBadge = document.getElementById("status-badge");
const modeBadge = document.getElementById("mode-badge");
const stageOverlay = document.getElementById("stage-overlay");
const welcomeTitle = document.getElementById("welcome-title");
const welcomeText = document.getElementById("welcome-text");
const launchBtn = document.getElementById("launch-btn");
const presenter = document.getElementById("avatar-presenter");
const speakingIndicator = document.getElementById("speaking-indicator");

const avatarSelect = document.getElementById("avatar-select");
const sceneSelect = document.getElementById("scene-select");
const swapBtn = document.getElementById("swap-btn");
const testSpeechBtn = document.getElementById("test-speech-btn");

// Dedicated Voice Presets linked directly per Avatar Clerk (M1-M4 & F1-F3)
const AVATAR_VOICE_MAP = {
  // Male Clerks
  "M1": "01KY40Z9NTKTC5DMH8TD5S77RQ", // Male - fresh and upbeat (Taro)
  "M2": "01KY40Z9NTKTC5DMH8TD5S77RT", // Male - warm and expressive (Ken)
  "M3": "01KY40Z9NTKTC5DMH8TD5S77RS", // Male - calm and approachable (Ren)
  "M4": "01KY40Z9NS5BEHECTYMBVX909M", // Male - confident and balanced (Sora)

  // Female Clerks
  "F1": "01KY40Z9NTKTC5DMH8TD5S77RR", // Female - brightly casual (Yuki)
  "F2": "01KY40Z9NTKTC5DMH8TD5S77RN", // Female - warm and cheerful (Hana)
  "F3": "01KY40Z9NTKTC5DMH8TD5S77RP", // Female - steady and approachable (Mio)
};

function getVoiceIdForAvatar() {
  if (!avatarSelect) return "01KY40Z9NS5BEHECTYMBVX909M";
  const selectedText = avatarSelect.options[avatarSelect.selectedIndex]?.text || "";
  const selectedVal = avatarSelect.value || "";

  for (const [key, voiceId] of Object.entries(AVATAR_VOICE_MAP)) {
    if (selectedText.includes(key) || selectedVal.toLowerCase().includes(key.toLowerCase())) {
      return voiceId;
    }
  }

  return "01KY40Z9NS5BEHECTYMBVX909M";
}

const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatLog = document.getElementById("chat-log");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const handsfreeToggle = document.getElementById("handsfree-toggle");
const chipBtns = document.querySelectorAll(".chip");

const backdropSelect = document.getElementById("backdrop-select");
const stageContainer = document.getElementById("stage-container");
const stageBackground = document.querySelector(".stage-background");

function applyStageBackdrop() {
  if (!stageBackground || !stageContainer) return;
  const mode = backdropSelect?.value || "familymart_store";

  if (mode === "plain_white") {
    stageBackground.style.display = "none";
    stageContainer.style.backgroundColor = "#ffffff";
  } else {
    stageBackground.style.display = "block";
    stageBackground.style.backgroundImage = "url('/familymart_bg.jpg')";
    stageContainer.style.backgroundColor = "transparent";
  }
}

if (backdropSelect) {
  backdropSelect.addEventListener("change", applyStageBackdrop);
}

function makePresenterCanvasTransparent() {
  try {
    const shadow = presenter?.shadowRoot;
    if (shadow) {
      const canvas = shadow.querySelector("canvas");
      if (canvas) canvas.style.backgroundColor = "transparent";
      const divs = shadow.querySelectorAll("div, section, main");
      divs.forEach(d => { if (d) d.style.backgroundColor = "transparent"; });
    }
  } catch (e) {
    console.error("Transparent shadow override:", e);
  }
}

// ── State Variables ────────────────────────────────────────────────────────
let appConfig = null;
let requestedRevision = 0;
let initializedRevision = 0;
let isInitializing = false;
let isTokenRefreshing = false;
let chatHistory = []; // Multi-turn conversation memory store
let defaultSceneId = ""; // Resolved sceneId for Perxona SDK

// ── Web Speech Recognition (Speech-to-Text) ───────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let speechSilenceTimer = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true; // Keep listening continuously so brief pauses don't cut off mid-sentence
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    isListening = true;
    micBtn.classList.add("listening");
    micBtn.innerHTML = "🔴 Listening... (Click to Send)";
    chatInput.placeholder = "Listening to your voice... Speak freely!";
  };

  recognition.onresult = (e) => {
    let interimTranscript = "";
    let finalTranscript = "";

    for (let i = e.resultIndex; i < e.results.length; ++i) {
      if (e.results[i].isFinal) {
        finalTranscript += e.results[i][0].transcript;
      } else {
        interimTranscript += e.results[i][0].transcript;
      }
    }

    const currentText = finalTranscript || interimTranscript;
    if (currentText) {
      chatInput.value = currentText;
    }

    // Reset silence timer on every new spoken word/token
    if (speechSilenceTimer) clearTimeout(speechSilenceTimer);
    
    // Wait for 1.8 seconds of complete silence after speaking before auto-sending
    speechSilenceTimer = setTimeout(() => {
      if (isListening) {
        console.log("[STT] 1.8s silence detected. Finalizing speech input...");
        recognition.stop();
      }
    }, 1800);
  };

  recognition.onerror = (e) => {
    console.error("STT Error:", e.error);
    stopMicListening();
    if (e.error !== "no-speech" && e.error !== "aborted") {
      showError(`Voice input error: ${e.error}`);
    }
  };

  recognition.onend = () => {
    stopMicListening();
    const query = chatInput.value.trim();
    if (query) {
      sendChatMessage(query);
    }
  };
} else {
  if (micBtn) {
    micBtn.title = "Web Speech API is not supported in this browser (Use Chrome/Edge/Safari)";
  }
}

function stopMicListening() {
  if (speechSilenceTimer) clearTimeout(speechSilenceTimer);
  isListening = false;
  micBtn.classList.remove("listening");
  micBtn.innerHTML = "🎤 Speak";
  chatInput.placeholder = "Speak or type a question...";
}

if (micBtn) {
  micBtn.addEventListener("click", () => {
    if (!recognition) {
      alert("Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      chatInput.value = "";
      try {
        recognition.start();
      } catch (err) {
        console.error("Mic start error:", err);
      }
    }
  });
}

// ── Helper API Request ──────────────────────────────────────────────────────
async function apiRequest(endpoint, options = {}) {
  const res = await fetch(endpoint, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Dynamic Engine Loader ──────────────────────────────────────────────────
function loadPresenterScript(url) {
  return new Promise((resolve, reject) => {
    if (window.customElements.get("sv-presenter")) {
      return resolve();
    }
    const script = document.createElement("script");
    script.type = "module";
    script.src = url;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Failed to load presenter engine script"));
    document.head.appendChild(script);
  });
}

// ── Initialize App ─────────────────────────────────────────────────────────
async function initApp() {
  try {
    appConfig = await apiRequest("/api/config");
    modeBadge.textContent = "Live Perxona Mode";
    modeBadge.className = "badge badge-status";

    // Load presenter engine script
    await loadPresenterScript(appConfig.presenterUrl);

    // Fetch Catalogs (Pre-selects M4 by default)
    await loadCatalogs();

    // Enable buttons
    swapBtn.disabled = false;
    testSpeechBtn.disabled = false;

    // Auto-launch M4 avatar immediately without waiting!
    await initializePresenterTarget();
  } catch (err) {
    console.error("App init error:", err);
    showError(`Init Error: ${err.message}`);
  }
}

// Global one-time interaction listener to satisfy browser audio autoplay policies seamlessly
function setupGlobalAudioUnlock() {
  const unlock = async () => {
    try {
      await presenter.resumeAudioPlayback?.();
      stageOverlay.classList.add("hidden");
      presenter.hidden = false;
      console.log("[Audio] Browser audio context unlocked seamlessly.");
    } catch (e) {}
  };
  window.addEventListener("click", unlock, { once: true });
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}
setupGlobalAudioUnlock();

function showError(msg) {
  statusBadge.textContent = `❌ ${msg}`;
  statusBadge.style.backgroundColor = "#ef4444";
  statusBadge.style.color = "#ffffff";
}

// ── Populate Catalog Selects ──────────────────────────────────────────────
async function loadCatalogs() {
  try {
    const [avatarsRes, scenesRes] = await Promise.all([
      apiRequest("/api/avatars"),
      apiRequest("/api/scenes"),
    ]);

    if (scenesRes.items && scenesRes.items[0]) {
      defaultSceneId = scenesRes.items[0].id || scenesRes.items[0].scene_id || "";
    }

    if (avatarSelect) {
      populateSelect(avatarSelect, avatarsRes.items, "avatar_id");

      // Pre-select M4 as default avatar!
      const m4Option = Array.from(avatarSelect.options).find(opt => opt.text.includes("M4"));
      if (m4Option) {
        avatarSelect.value = m4Option.value;
      }
    }
  } catch (err) {
    showError(`Catalog load error: ${err.message}`);
  }
}

function populateSelect(selectEl, items = [], defaultPrefix) {
  selectEl.innerHTML = "";
  items.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id || item[defaultPrefix];
    opt.textContent = item.name || item.id;
    selectEl.appendChild(opt);
  });
}

// ── Presenter Events & State Machine ───────────────────────────────────────
presenter.addEventListener("PRESENTER_STATUS", (e) => {
  const status = e.detail?.status || "Uninitialized";
  console.log("PRESENTER_STATUS:", status);

  if (status === "Ready") {
    statusBadge.textContent = "✓ Ready";
    statusBadge.style.backgroundColor = "#00A040";
    statusBadge.style.color = "#ffffff";
    stageOverlay.classList.add("hidden");
    presenter.hidden = false;
    
    // Ensure transparent WebGL canvas & apply active backdrop!
    makePresenterCanvasTransparent();
    applyStageBackdrop();
  } else {
    statusBadge.textContent = status;
    statusBadge.style.backgroundColor = "#FFD100";
    statusBadge.style.color = "#1e293b";
  }
});

presenter.addEventListener("CONNECT_TOKEN_EXPIRED", async () => {
  if (isTokenRefreshing) return;
  isTokenRefreshing = true;
  statusBadge.textContent = "Refreshing Token...";
  try {
    const { connect_token } = await apiRequest("/api/connect-token");
    presenter.refreshConnectToken(connect_token);
    statusBadge.textContent = "Token Refreshed";
  } catch (err) {
    console.error("Token refresh failed:", err);
    showError(`Token Refresh Error: ${err.message}`);
  } finally {
    isTokenRefreshing = false;
  }
});

// ── Audio Unlock & Launch ──────────────────────────────────────────────────
launchBtn.addEventListener("click", async () => {
  try {
    launchBtn.disabled = true;
    launchBtn.textContent = "Launching...";

    // Unlock browser audio context
    await presenter.resumeAudioPlayback?.();

    // Trigger target initialization directly
    await initializePresenterTarget();
  } catch (err) {
    console.error("Launch error:", err);
    showError(`Launch error: ${err.message}`);
    launchBtn.disabled = false;
    launchBtn.textContent = "🔊 Enter Store & Launch Avatar";
  }
});

// ── Dynamic Target Swap ────────────────────────────────────────────────────
async function initializePresenterTarget() {
  requestedRevision++;
  if (isInitializing) return;

  isInitializing = true;
  try {
    while (initializedRevision < requestedRevision) {
      const currentRev = requestedRevision;
      const targetVoiceId = getVoiceIdForAvatar();

      const target = {
        avatarId: avatarSelect?.value || "m4",
        sceneId: defaultSceneId || "01KPW5DZGANX5NJY9CMNBD9SHK",
        voiceId: targetVoiceId,
      };

      if (!target.avatarId) {
        statusBadge.textContent = "Please select avatar";
        initializedRevision = currentRev;
        break;
      }

      statusBadge.textContent = "Initializing Target...";
      const { connect_token } = await apiRequest("/api/connect-token");

      console.log("Calling presenter.initialize() with:", { connect_token, target });
      await presenter.initialize(connect_token, target);
      initializedRevision = currentRev;
    }
  } catch (err) {
    console.error("Initialization failed:", err);
    initializedRevision = requestedRevision;
    showError(`Presenter Init Failed: ${err.message}`);
    appendChatMessage(`⚠️ Presenter Init Error: ${err.message}`, "system");
  } finally {
    isInitializing = false;
    launchBtn.disabled = false;
    launchBtn.textContent = "🔊 Enter Store & Launch Avatar";
  }
}

swapBtn.addEventListener("click", () => {
  initializePresenterTarget();
});

// ── Test Speech Button ────────────────────────────────────────────────────
testSpeechBtn.addEventListener("click", () => {
  speakText("Welcome to FamilyMart! How can I help you today?");
});

async function speakText(text) {
  if (!text) return;
  try {
    speakingIndicator.classList.remove("hidden");
    
    // Synchronize product image card update with avatar speech timing (~450ms delay)
    setTimeout(() => {
      checkAndDisplayProductImage(text);
    }, 450);

    await presenter.present?.(text);
  } catch (err) {
    console.error("Speech error:", err);
    showError(`Speech Error: ${err.message}`);
  } finally {
    speakingIndicator.classList.add("hidden");
  }
}

// ── OpenAI Chatbot Integration ────────────────────────────────────────────
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = chatInput.value.trim();
  if (!query) return;

  chatInput.value = "";
  await sendChatMessage(query);
});

chipBtns.forEach((chip) => {
  chip.addEventListener("click", () => {
    const prompt = chip.dataset.prompt;
    if (prompt) sendChatMessage(prompt);
  });
});

async function sendChatMessage(message) {
  appendChatMessage(message, "user");
  sendBtn.disabled = true;

  // Add user message to conversation memory store
  chatHistory.push({ role: "user", content: message });

  // 1. Immediate visual feedback: Trigger thinking/nodding state on the 3D presenter
  presenter.setThinking?.(true);

  // Create empty bubble for streaming response
  const assistantBubble = createAssistantMessageBubble();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message, 
        avatarId: avatarSelect.value,
        history: chatHistory.slice(-10) // Send sliding window of recent conversation turns
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Chat HTTP ${response.status}: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";
    let sentenceBuffer = "";
    let isFirstSentence = true;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (trimmed.startsWith("data: ")) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            if (parsed.error) throw new Error(parsed.error);
            const delta = parsed.delta || "";
            if (delta) {
              fullText += delta;
              sentenceBuffer += delta;
              assistantBubble.innerHTML = `<strong>Taro-san:</strong> ${escapeHtml(fullText)}`;
              chatLog.scrollTop = chatLog.scrollHeight;

              // Check if a sentence punctuation boundary is reached
              const match = sentenceBuffer.match(/^([^。！？!?\n]+[。！？!?\n]+)(.*)/s);
              if (match) {
                const completedSentence = match[1].trim();
                sentenceBuffer = match[2];

                if (completedSentence) {
                  if (isFirstSentence) {
                    presenter.setThinking?.(false);
                    isFirstSentence = false;
                  }
                  // Stream sentence to 3D avatar speech engine immediately!
                  await speakText(completedSentence);
                }
              }
            }
          } catch (e) {
            // Ignore partial parse
          }
        }
      }
    }

    // Present any remaining text in buffer
    if (sentenceBuffer.trim()) {
      if (isFirstSentence) presenter.setThinking?.(false);
      await speakText(sentenceBuffer.trim());
    }

    // Save AI response to conversation memory store
    if (fullText.trim()) {
      chatHistory.push({ role: "assistant", content: fullText.trim() });
    }

  } catch (err) {
    console.error("Chat error:", err);
    presenter.setThinking?.(false);
    showError(`Chat Error: ${err.message}`);
    appendChatMessage(`Sorry, FamilyMart assistant error: ${err.message}`, "system");
  } finally {
    presenter.setThinking?.(false);
    sendBtn.disabled = false;

    // Continuous Live Conversation: Auto-resume microphone after avatar finishes speaking!
    if (handsfreeToggle && handsfreeToggle.checked && recognition) {
      setTimeout(() => {
        try {
          if (!isListening) {
            chatInput.value = "";
            recognition.start();
            console.log("[Continuous Voice] Auto-resumed microphone for next question!");
          }
        } catch (err) {
          // Ignore if already listening
        }
      }, 700);
    }
  }
}

function createAssistantMessageBubble() {
  const msgDiv = document.createElement("div");
  msgDiv.className = "chat-message message-assistant";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.innerHTML = `<strong>Taro-san:</strong> 💬 <em>Thinking...</em>`;

  msgDiv.appendChild(bubble);
  chatLog.appendChild(msgDiv);
  chatLog.scrollTop = chatLog.scrollHeight;
  return bubble;
}

function appendChatMessage(text, role) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `chat-message message-${role}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  
  if (role === "assistant") {
    bubble.innerHTML = `<strong>Taro-san:</strong> ${escapeHtml(text)}`;
  } else if (role === "user") {
    bubble.textContent = text;
  } else {
    bubble.textContent = text;
  }

  msgDiv.appendChild(bubble);
  chatLog.appendChild(msgDiv);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Product Image Card Showcase (Top Left) ─────────────────────────────
const PRODUCT_IMAGE_MAP = [
  {
    keywords: ["riceball", "rice ball", "onigiri", "salmon", "spam", "musubi", "bento", "おにぎり", "紅鮭"],
    image: "/imgs/riceball.jpg",
    title: "Salted Salmon Onigiri (手巻 紅鮭)",
    desc: "¥180 (Tax Incl.) • ~172 kcal"
  },
  {
    keywords: ["famichiki", "chicken", "spicy chicken", "famikara", "karaage", "hot snack", "fried chicken", "チキン", "ファミチキ"],
    image: "/imgs/chicken.jpg",
    title: "FamiChiki (ファミチキ)",
    desc: "¥230 (Tax Incl.) • ~251 kcal"
  },
  {
    keywords: ["sandwich", "sando", "tamago", "egg", "ham", "bun", "bread", "サンド"],
    image: "/imgs/sandwhich.jpeg",
    title: "Tamago Sando (たまごサンド)",
    desc: "¥248 (Tax Incl.) • ~305 kcal"
  },
  {
    keywords: ["green tea", "tea", "oi ocha", "ayataka", "unsweetened", "緑茶", "お茶"],
    image: "/imgs/green_tea.jpg",
    title: "Suntory Green Tea (緑茶)",
    desc: "¥138 (Tax Incl.) • 0 kcal"
  },
  {
    keywords: ["coffee", "latte", "famima cafe", "espresso", "caffeine", "カフェラテ", "コーヒー"],
    image: "/imgs/blackcoffee.jpg",
    title: "FAMIMA CAFÉ Latte (カフェラテ)",
    desc: "¥180 (Medium) • ~90 kcal"
  },
  {
    keywords: ["pocari", "water", "hydrate", "hydration", "ukon", "hangover", "turmeric", "electrolyte", "ポカリ", "ウコン"],
    image: "/imgs/mineralwater.jpg",
    title: "Pocari Sweat / Hydration (飲料)",
    desc: "¥162 (Tax Incl.) • ~125 kcal"
  }
];

function checkAndDisplayProductImage(text) {
  if (!text) return;
  const lower = text.toLowerCase();

  for (const item of PRODUCT_IMAGE_MAP) {
    if (item.keywords.some(kw => lower.includes(kw))) {
      showProductCard(item.image, item.title, item.desc);
      return;
    }
  }
}

function showProductCard(imgSrc, title, desc) {
  const card = document.getElementById("product-card-overlay");
  const imgEl = document.getElementById("product-card-img");
  const titleEl = document.getElementById("product-card-title");
  const descEl = document.getElementById("product-card-desc");

  if (card && imgEl && titleEl && descEl) {
    if (imgEl.src.includes(imgSrc)) return;
    
    card.classList.add("item-updating");
    setTimeout(() => {
      imgEl.src = imgSrc;
      titleEl.textContent = title;
      descEl.textContent = desc;
      card.classList.remove("item-updating");
    }, 150);
  }
}

const productCardClose = document.getElementById("product-card-close");
if (productCardClose) {
  productCardClose.addEventListener("click", () => {
    const card = document.getElementById("product-card-overlay");
    if (card) card.classList.add("hidden");
  });
}

// Start application
initApp();

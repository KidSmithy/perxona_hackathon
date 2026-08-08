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
const voiceSelect = document.getElementById("voice-select");
const swapBtn = document.getElementById("swap-btn");
const testSpeechBtn = document.getElementById("test-speech-btn");

const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatLog = document.getElementById("chat-log");
const sendBtn = document.getElementById("send-btn");
const chipBtns = document.querySelectorAll(".chip");

// ── State Variables ────────────────────────────────────────────────────────
let appConfig = null;
let requestedRevision = 0;
let initializedRevision = 0;
let isInitializing = false;
let isTokenRefreshing = false;

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

    // Fetch Catalogs
    await loadCatalogs();

    // Enable buttons
    swapBtn.disabled = false;
    testSpeechBtn.disabled = false;
  } catch (err) {
    console.error("App init error:", err);
    showError(`Init Error: ${err.message}`);
  }
}

function showError(msg) {
  statusBadge.textContent = `❌ ${msg}`;
  statusBadge.style.backgroundColor = "#ef4444";
  statusBadge.style.color = "#ffffff";
}

// ── Populate Catalog Selects ──────────────────────────────────────────────
async function loadCatalogs() {
  try {
    const [avatarsRes, scenesRes, voicesRes] = await Promise.all([
      apiRequest("/api/avatars"),
      apiRequest("/api/scenes"),
      apiRequest("/api/voices"),
    ]);

    populateSelect(avatarSelect, avatarsRes.items, "avatar_id");
    populateSelect(sceneSelect, scenesRes.items, "scene_id");
    populateSelect(voiceSelect, voicesRes.items, "voice_id");
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

// ── Dynamic Target Swap with Revision Guard ───────────────────────────────
async function initializePresenterTarget() {
  requestedRevision++;
  if (isInitializing) return;

  isInitializing = true;
  try {
    while (initializedRevision !== requestedRevision) {
      const currentRev = requestedRevision;
      const target = {
        avatarId: avatarSelect.value,
        sceneId: sceneSelect.value,
        voiceId: voiceSelect.value || undefined,
      };

      statusBadge.textContent = "Initializing Target...";
      const { connect_token } = await apiRequest("/api/connect-token");

      console.log("Calling presenter.initialize() with:", { connect_token, target });
      await presenter.initialize(connect_token, target);
      initializedRevision = currentRev;
    }
  } catch (err) {
    console.error("Initialization failed:", err);
    showError(`Presenter Init Failed: ${err.message}`);
    appendChatMessage(`⚠️ Presenter Init Error: ${err.message}`, "system");
  } finally {
    isInitializing = false;
    launchBtn.disabled = false;
    launchBtn.textContent = "🔊 Enter Store & Launch Avatar";
    if (initializedRevision !== requestedRevision) {
      initializePresenterTarget();
    }
  }
}

swapBtn.addEventListener("click", () => {
  initializePresenterTarget();
});

// ── Test Speech Button ────────────────────────────────────────────────────
testSpeechBtn.addEventListener("click", () => {
  speakText("いらっしゃいませ! Welcome to FamilyMart! How can I help you today?");
});

async function speakText(text) {
  if (!text) return;
  try {
    speakingIndicator.classList.remove("hidden");
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

  try {
    const data = await apiRequest("/api/chat", {
      method: "POST",
      body: { message, avatarId: avatarSelect.value },
    });

    const reply = data.reply || "いらっしゃいませ!";
    appendChatMessage(reply, "assistant");

    // Speak response
    speakText(reply);
  } catch (err) {
    console.error("Chat error:", err);
    showError(`Chat Error: ${err.message}`);
    appendChatMessage(`Sorry, FamilyMart assistant error: ${err.message}`, "system");
  } finally {
    sendBtn.disabled = false;
  }
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

// Start application
initApp();

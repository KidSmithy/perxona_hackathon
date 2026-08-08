# Standalone MediaPipe Hand Gesture Kiosk Test

This guide provides a zero-dependency, standalone local prototype for testing real-time hand gesture recognition using Google MediaPipe Tasks Vision. It allows you to test camera access, gesture detection logic, and avatar swapping state changes locally without requiring a Perxona API key or backend connection.

---

## 1. Quick Start Instructions

1. Save the code block below into an `index.html` file on your local machine.
2. Serve the file using a simple local web server (e.g., VS Code Live Server, or `npx serve`, or `python3 -m http-server 8000`).
   > *Note: Modern browsers block webcam access when opening HTML files via `file://`. Running via `http://localhost` is required for camera permissions.*
3. Open your browser to the local URL, grant webcam permissions, and test gestures in front of your camera:
   - **Victory / Peace sign (✌️):** Triggers **VTuber Clerk** mode.
   - **Open Palm (🖐️):** Triggers **Classic Clerk** mode.
   - **Thumbs Up (👍):** Triggers **Cyber Robot** mode.

---

## 2. Complete Source Code (`index.html`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Konbini Gesture Recognition Test</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #121212;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }

    h1 {
      margin-bottom: 8px;
      font-size: 24px;
    }

    p {
      color: #a0a0a0;
      margin-top: 0;
      margin-bottom: 20px;
    }

    .container {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
    }

    .webcam-card, .avatar-card {
      background: #1e1e1e;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    video {
      border-radius: 8px;
      transform: scaleX(-1); /* Mirror camera display */
      background-color: #000;
    }

    #kiosk-mock {
      width: 320px;
      height: 240px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: bold;
      color: white;
      border-radius: 8px;
      transition: background-color 0.3s ease, transform 0.2s ease;
      text-align: center;
      padding: 10px;
      box-sizing: border-box;
    }

    /* Avatar State Styles */
    .vtuber { background: linear-gradient(135deg, #ff4081, #7c4dff); }
    .classic { background: linear-gradient(135deg, #00838f, #00acc1); }
    .mecha { background: linear-gradient(135deg, #2e7d32, #66bb6a); }

    .status-badge {
      margin-top: 12px;
      font-size: 14px;
      background: rgba(255, 255, 255, 0.2);
      padding: 4px 12px;
      border-radius: 12px;
    }

    .gesture-guide {
      margin-top: 24px;
      background: #1e1e1e;
      padding: 16px 24px;
      border-radius: 12px;
      max-width: 680px;
      width: 100%;
    }

    .gesture-guide ul {
      margin: 8px 0 0 0;
      padding-left: 20px;
      color: #cccccc;
    }

    .gesture-guide li {
      margin-bottom: 6px;
    }
  </style>

  <!-- MediaPipe Vision Bundle CDN -->
  <script type="module">
    import { GestureRecognizer, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_bundle.js";

    let gestureRecognizer;
    let video;
    let currentAgent = "agent_classic_01";
    let isProcessing = false;

    const MOCK_AVATARS = {
      "Victory": { id: "agent_vtuber_01", label: "VTuber Clerk", emoji: "✌️", class: "vtuber" },
      "Open_Palm": { id: "agent_classic_01", label: "Classic Clerk", emoji: "🖐️", class: "classic" },
      "Thumb_Up": { id: "agent_mecha_01", label: "Cyber Robot", emoji: "👍", class: "mecha" }
    };

    async function initGestureTracking() {
      const statusText = document.getElementById("status-text");
      statusText.textContent = "Loading MediaPipe Model...";

      // Resolve WASM assets
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
      
      // Load pre-trained Gesture Recognizer Task
      gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task"
        },
        runningMode: "VIDEO"
      });

      statusText.textContent = "Requesting Webcam Access...";
      
      video = document.getElementById("webcam");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      video.srcObject = stream;
      
      video.addEventListener("loadeddata", () => {
        statusText.textContent = "Gesture Detection Active";
        predictLoop();
      });
    }

    function predictLoop() {
      if (video.currentTime > 0) {
        const results = gestureRecognizer.recognizeForVideo(video, Date.now());
        
        if (results.gestures.length > 0) {
          const detectedGesture = results.gestures[0][0].categoryName;
          
          if (MOCK_AVATARS[detectedGesture] && MOCK_AVATARS[detectedGesture].id !== currentAgent) {
            updateMockAvatar(MOCK_AVATARS[detectedGesture]);
          }
        }
      }
      requestAnimationFrame(predictLoop);
    }

    function updateMockAvatar(avatarData) {
      currentAgent = avatarData.id;
      const display = document.getElementById("kiosk-mock");
      const currentGestureText = document.getElementById("current-gesture");
      
      display.innerHTML = `<div>${avatarData.emoji}</div><div>${avatarData.label}</div>`;
      display.className = avatarData.class;
      currentGestureText.textContent = `Active ID: ${avatarData.id}`;
      
      console.log("Agent Swapped to:", avatarData.id);
    }

    window.addEventListener("DOMContentLoaded", initGestureTracking);
  </script>
</head>
<body>

  <h1>Konbini AI Kiosk - Touchless Avatar Swap Test</h1>
  <p>Standalone local gesture detection prototype using MediaPipe Tasks Vision</p>

  <div class="container">
    <!-- Camera View -->
    <div class="webcam-card">
      <video id="webcam" autoplay playsinline width="320" height="240"></video>
      <div id="status-text" class="status-badge">Initializing...</div>
    </div>

    <!-- Mock Avatar Output -->
    <div class="avatar-card">
      <div id="kiosk-mock" class="classic">
        <div>🖐️</div>
        <div>Classic Clerk</div>
      </div>
      <div id="current-gesture" class="status-badge">Active ID: agent_classic_01</div>
    </div>
  </div>

  <div class="gesture-guide">
    <h3>Supported Hand Gestures:</h3>
    <ul>
      <li><strong>Victory / Peace Sign (✌️):</strong> Swaps avatar to <code>agent_vtuber_01</code> (VTuber Clerk)</li>
      <li><strong>Open Palm (🖐️):</strong> Swaps avatar to <code>agent_classic_01</code> (Classic Clerk)</li>
      <li><strong>Thumbs Up (👍):</strong> Swaps avatar to <code>agent_mecha_01</code> (Cyber Robot)</li>
    </ul>
  </div>

</body>
</html>
```

---

## 3. How to Connect to Perxona SDK Once You Receive API Keys

Once your Perxona API credentials and SDK setup are ready, transition this prototype by replacing the `updateMockAvatar` function with a DOM swap function that injects Perxona's `<sv-agent>` web component:

```javascript
// 1. Add the Perxona Web Component script to <head>
// <script type="module" src="https://cdn.perxona.ai/widget/v1/sv-agent.js"></script>

// 2. Replace updateMockAvatar() with Perxona Component DOM mounting
function updatePerxonaAgent(avatarData) {
  currentAgent = avatarData.id;
  const container = document.getElementById("kiosk-mock-container");
  
  // Dynamic DOM swap to render Perxona 3D Avatar
  container.innerHTML = `
    <sv-agent 
      agent-id="${avatarData.id}"
      storyboard-id="stry_konbini_night_shift"
      conversation-mode="inputText"
      theme="dark"
      style="width: 100%; height: 100%;">
    </sv-agent>
  `;
  
  console.log("Perxona Agent Swapped to:", avatarData.id);
}
```

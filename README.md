# Perxona Hackathon Repository

This repository contains applications and prototypes integrating the **Perxona Connect API**, 3D Virtual Avatar Presenters (`<sv-presenter>`), and AI Chatbots.

---

## 🏪 1. FamilyMart Virtual Avatar Assistant (`familymart_app/`)

A standalone full-stack web application featuring a FamilyMart convenience store background, an OpenAI-powered AI store clerk (Taro-san), dynamic avatar/scene swapping, and real-time error handling.

### How to Run:
```bash
# 1. Change directory to familymart_app
cd familymart_app

# 2. Install dependencies
npm install

# 3. Start the application
npm start
```
Open **`http://localhost:8085`** in your browser.

> See [`familymart_app/README.md`](familymart_app/README.md) for detailed `.env` key configurations.

---

## ✌️ 2. Gesture Recognition Kiosk Test (`index.html`)

`index.html` is a standalone prototype for testing real-time hand gesture recognition (Google MediaPipe Tasks Vision) and avatar-swap state changes — no backend required.

### How to Run:
```bash
npx serve .
# or: python3 -m http.server 8000
```
Open `http://localhost:3000` (or printed port) and allow camera access.

### Gestures:
- **Victory / Peace (✌️)** → VTuber Clerk (`agent_vtuber_01`)
- **Open Palm (🖐️)** → Classic Clerk (`agent_classic_01`)
- **Thumbs Up (👍)** → Cyber Robot (`agent_mecha_01`)
Open the printed `http://localhost:...` URL and allow camera access — `file://` won't work,
`getUserMedia` requires a secure context (localhost counts).

### Gesture

The only supported gesture is motion, not a hand pose: **swipe your open hand left or right** in
front of the camera to cycle backward/forward through:

`agent_classic_01` (Classic Clerk) → `agent_vtuber_01` (VTuber Clerk) → `agent_mecha_01` (Cyber
Robot) → wraps around

Swipe detection tracks palm x-position over a short rolling time window rather than classifying a
specific hand shape, so it works with any hand pose and stays consistent across camera frame
rates. The debug panel's "Movement" bar shows live how close the current motion is to the swipe
threshold before one actually fires.

### What's different from the guide's code block

`index.html` replaces the guide's static pose-gesture swapping (Victory/Open Palm/Thumbs Up →
direct avatar jump) with motion-based swipe-to-cycle instead, and hardens the rest: GPU delegate
with automatic CPU fallback, per-frame runtime-error recovery (the raw MediaPipe call can throw
after a successful init), a pinned MediaPipe version instead of `@latest`, a debug panel (live FPS,
live movement-vs-threshold readout, landmark overlay), and manual override buttons to test the
avatar-cycle UI without a camera. Tunable constants live at the top of the `<script
type="module">` block.

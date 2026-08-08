# 🏪 FamilyMart Virtual Avatar Assistant — Project Summary & Gesture Integration Plan

---

## 📌 Executive Summary

This project is an interactive, 3D Virtual Convenience Store Assistant application built for **FamilyMart Japan**. It combines:
1. **Perxona Connect API (`<sv-presenter>`)** for 3D avatar rendering, motion playback, and lipsync.
2. **OpenAI (`gpt-4o-mini`)** for intelligent conversational response generation.
3. **Master Store Inventory (`family_mart.md`)** for grounded domain knowledge (prices, calories, allergens, omotenashi greetings, and scenario decision trees).
4. **Web Speech API** for a seamless, hands-free **Voice-to-Voice** loop.
5. **Touchless Left/Right Gesture Control** for simple avatar swapping via camera gestures.

---

## 🛠️ Phase 1: Completed Achievements & Features

### 1. Standalone Application Architecture (`familymart_app/`)
- Built a clean Node.js + Express web application located at [`familymart_app/`](file:///C:/Users/Rald999/Documents/GitHub/perxona_hackathon/familymart_app).
- Generated a realistic **FamilyMart Shibuya Store Interior Background** stage ([`public/familymart_bg.jpg`](file:///C:/Users/Rald999/Documents/GitHub/perxona_hackathon/familymart_app/public/familymart_bg.jpg)).
- Designed a modern glassmorphic interface with FamilyMart brand colors: Emerald Green (`#00A040`), Vivid Blue (`#0070C0`), and Yellow (`#FFD100`).
- Configured hot-reloading dev mode via `npm run dev` (`node --watch server.mjs`).

### 2. Perxona Connect API Integration & Proxy Routing
- **Authentication**: Proxies login requests to `POST /api/v1/connect/auth/login` to retrieve Bearer JWT tokens.
- **Catalog Filtering**: Filtered `/api/avatars` to present **only M1, M2, and M3** male clerk avatars in the UI dropdown.
- **Auto Token Refresh**: Implemented listener for `CONNECT_TOKEN_EXPIRED` to handle 401 expiration gracefully.
- **Audio Autoplay Unlock**: Built an interactive stage overlay calling `presenter.resumeAudioPlayback()` on user gesture.
- **Rate Limit Safeguards**: Fixed infinite initialization retry loops to prevent HTTP 429 rate-limiting.

### 3. Knowledge Base Grounding (`family_mart.md`)
- Integrated the full master catalog ([`family_mart.md`](file:///C:/Users/Rald999/Documents/GitHub/perxona_hackathon/family_mart.md)) directly into the server's OpenAI system prompt.
- **Avatar Role Division**:
  - **M1 (Taro)**: *Senior Hot Snack & Famichiki Specialist* (Category A & B).
  - **M2 (Ken)**: *Bento, Onigiri & Fresh Bakery Specialist* (Category C & D).
  - **M3 (Ren)**: *Beverage, Sobriety & Dessert Specialist* (Category E & F).
- **Scenario Decision Trees**:
  - *Alcohol / Hangover*: Suggests Ukon no Chikara (¥206) + Pocari Sweat (¥162) + Oden Daikon (¥120).
  - *All-Nighter / Study*: Suggests FAMIMA CAFÉ Latte (¥240) + Spicy Chicken (¥198).
  - *Low-Calorie*: Suggests Oden Daikon (18 kcal) + Soft-Boiled Egg (75 kcal).
  - *FamiChiki Pairing*: Suggests pairing with Famichiki Bun (¥88) or Green Tea (¥138).

### 4. Full Voice-to-Voice Loop 🎙️ ➡️ 🧠 ➡️ 🗣️
- Added Web Speech API Speech-to-Text (`SpeechRecognition`) with an animated microphone button (`🎤 Speak`).
- **Complete Pipeline**:
  1. User speaks into microphone $\rightarrow$ Transcribed to text in real-time.
  2. Text sent to OpenAI `gpt-4o-mini` $\rightarrow$ Generates grounded response using `family_mart.md`.
  3. Response piped into `presenter.present(reply)` $\rightarrow$ 3D avatar speaks response aloud with lipsync.

---

## 🖐️ Phase 2: Touchless Left / Right Gesture Navigation Plan

The avatar swapping mechanism uses **simple Left and Right hand gestures** for intuitive, touchless navigation between M1, M2, and M3.

### 1. Gesture Navigation Matrix

| Hand Gesture | Action | Avatar Transition |
| :--- | :--- | :--- |
| **👉 Gesture Right / Swipe Right** | Next Avatar | **M1 $\rightarrow$ M2 $\rightarrow$ M3** |
| **👈 Gesture Left / Swipe Left** | Previous Avatar | **M3 $\leftarrow$ M2 $\leftarrow$ M1** |

### 2. Integration Architecture & Workflow

```
 ┌──────────────────────┐      ┌─────────────────────────┐      ┌──────────────────────────┐
 │ WebCam Video Stream  │ ───► │ MediaPipe Gesture Vision│ ───► │ Debounce & Cooldown Guard│
 └──────────────────────┘      └─────────────────────────┘      └────────────┬─────────────┘
                                                                             │ Left / Right Event
                                                                             ▼
 ┌──────────────────────┐      ┌─────────────────────────┐      ┌──────────────────────────┐
 │ 3D Avatar Render Stage│ ◄─── │ presenter.initialize()  │ ◄─── │ Cycle Avatar Index +/- 1 │
 └──────────────────────┘      └─────────────────────────┘      └──────────────────────────┘
```

### 3. Key Technical Implementation Steps

1. **Include MediaPipe Tasks Vision CDN**:
   Add `@mediapipe/tasks-vision` module script to `familymart_app/public/index.html`.

2. **Array Carousel State**:
   Maintain an array of active avatars `['M1_ID', 'M2_ID', 'M3_ID']` and an active index `currentIndex`.

3. **Gesture Direction Trigger**:
   - On **Gesture Right** $\rightarrow$ `currentIndex = (currentIndex + 1) % avatars.length`
   - On **Gesture Left** $\rightarrow$ `currentIndex = (currentIndex - 1 + avatars.length) % avatars.length`

4. **Multi-Frame Stability & Cooldown**:
   - Require **8 consecutive matching frames** to detect intent.
   - Apply a **3-second cooldown timer** (`cooldown = 3000ms`) after each swap to prevent rapid rate-limit triggers.

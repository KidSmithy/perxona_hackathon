# FamilyMart 🏪 Virtual Avatar Assistant

A standalone full-stack web application integrating **Perxona Connect API** (`<sv-presenter>` 3D Web Component) and **OpenAI (`gpt-4o-mini`)** to create an interactive virtual assistant for a FamilyMart convenience store in Shibuya, Tokyo.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18 or higher installed on your machine.

### 2. Environment Configuration
Navigate to the `familymart_app` directory and create/verify the `.env` configuration file:

```bash
cd familymart_app
```

Check or edit `.env`:
```env
# Server Port
PORT=8085

# Perxona Region API Base URL & Presenter Engine
PERXONA_API_BASE_URL=https://console.perxona.ai/asia
PRESENTER_URL=https://cdn.perxona.ai/asia/prod/latest/widget/entry/presenter.js

# Perxona Account Credentials (Required for 3D avatar rendering & TTS playback)
PERXONA_CONNECT_EMAIL=your_perxona_email@example.com
PERXONA_CONNECT_PASSWORD=your_perxona_password

# OpenAI Chat Integration (Required for AI assistant text responses)
LLM_API_KEY=sk-proj-your-openai-api-key
LLM_PROVIDER=openai
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

### 3. Install & Start Server

```bash
# Install dependencies
npm install

# Start server in watch mode (auto-restarts on code changes)
npm run dev

# Start server in production mode
npm start
```

Open your browser at **`http://localhost:8085`**.

---

## ✨ Features & Architecture

- **🏪 FamilyMart Convenience Store Stage**: Custom Japanese convenience store background stage with high-aesthetic glassmorphism controls.
- **🗣️ OpenAI Powered AI Clerk (Taro-san)**: System-prompted assistant that greets customers with *"Irasshaimase!"* and recommends Famichiki, bento, and cold drinks.
- **🔄 Dynamic Target Swapping**: Select and hot-swap avatars, store scenes, and voice presets dynamically with revision tracking to prevent race conditions.
- **🔊 Audio Unlock Workflow**: Includes a start overlay button invoking `presenter.resumeAudioPlayback()` to satisfy browser autoplay policies.
- **⚠️ Real-time Error Diagnostics**: Displays live status badges (`PRESENTER_STATUS`) and posts explicit error messages to the chat log if credentials or API calls fail.
- **🛡️ Auto Token Refresh**: Listens for `CONNECT_TOKEN_EXPIRED` to seamlessly refresh access tokens.

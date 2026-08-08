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

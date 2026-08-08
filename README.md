# perxona_hackathon

## Gesture Recognition Kiosk Test

`index.html` is a standalone, zero-dependency prototype for testing real-time hand gesture
recognition (Google MediaPipe Tasks Vision) and the avatar-swap state changes it should drive —
no Perxona API key or backend required. See [`gesture_test_standalone_guide.md`](gesture_test_standalone_guide.md)
for the original spec, including how to wire in the real Perxona `<sv-agent>` component once API
credentials are available.

### Run it

```bash
npx serve .
# or: python3 -m http.server 8000
```

Open the printed `http://localhost:...` URL and allow camera access — `file://` won't work,
`getUserMedia` requires a secure context (localhost counts).

### Gestures

| Gesture             | Swaps To                          |
| -------------------- | ---------------------------------- |
| Victory / Peace (✌️) | `agent_vtuber_01` — VTuber Clerk   |
| Open Palm (🖐️)       | `agent_classic_01` — Classic Clerk |
| Thumbs Up (👍)        | `agent_mecha_01` — Cyber Robot     |

### What's different from the guide's code block

`index.html` hardens the guide's original snippet: a confidence threshold + multi-frame stability
debounce before swapping (kills flicker between similar gestures), a debug panel (live FPS, top-3
gesture candidates with scores, stability meter, landmark overlay), GPU delegate with automatic
CPU fallback, per-frame runtime-error recovery (the raw MediaPipe call can throw after a
successful init), a pinned MediaPipe version instead of `@latest`, and manual override buttons to
test the avatar-swap UI without a camera. Tunable constants live at the top of the `<script
type="module">` block.

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

# Contributing to Norby 🗺️

We are thrilled that you want to contribute to **Norby**! To maintain a fast, secure, and premium social discovery platform, we hold our code, documentation, and performance to high standards. 

Please read this guide to understand our contribution process.

> [!TIP]
> ### 🎁 Bounty Rewards Program
> **Meaningful contributions will be rewarded up to ₹250!**
> High-quality, clean pull requests detailing bug fixes, new features, performance improvements, or documentation updates that get merged are eligible for rewards. Note: only meaningful and functional changes count.

---

## 🧭 Branch Naming Conventions

All branches must be prefixed according to the nature of the contribution:
* **Bug Fixes**: `bugfix/issue-description` (e.g. `bugfix/safari-gps-lockup`)
* **Features**: `feature/feature-name` (e.g. `feature/webrtc-mute-controls`)
* **Documentation**: `docs/update-description` (e.g. `docs/websocket-ref`)
* **Refactoring/Performance**: `perf/optimize-description` (e.g. `perf/redis-hmget-sync`)

---

## 🐛 Bug Reports

If you encounter an issue or bug, please open a **Bug Report** on GitHub with the following details:
1. **Description**: Clear summary of what is happening vs what was expected.
2. **Environment**: Device, OS version, and browser (e.g., iPhone 15, iOS 17.4, Safari Mobile).
3. **Steps to Reproduce**: Detailed list of steps to trigger the bug.
4. **Console/Server Logs**: Attach relevant frontend browser console errors or backend logs.
   * *Example*: Browser permissions query errors, WebSocket close codes (`1006`), or Redis connection timeouts.

---

## 🛠️ Bug Fix Guidelines

When fixing a bug:
1. **Targeted Changes**: Keep changes focused. Avoid bundling unrelated improvements or reformatting entire files.
2. **Cross-Browser Verification**: If the fix involves geolocation or WebRTC, test it on both Desktop (Chrome/Firefox) and Mobile (Safari/iOS, Chrome/Android).
3. **Preserve Caches & Storage Namespaces**: Ensure local storage and Redis namespaces (`norby:*`) are preserved unless changing the schema is specifically required.
4. **Local Verification**: Verify the fix builds locally:
   ```bash
   npm run verify
   ```

---

## ✨ Feature Contributions

Norby is built to be extremely fast and lightweight. New features must satisfy these constraints:

### 1. Performance Limits
* **WebSocket Latency**: Sync and message handlers must execute in **under 1ms** on the WebSocket server. Avoid adding heavy, blocking database commands (like nested checks) inside client sync loops.
* **Layout and Rendering**: The frontend must maintain **60 FPS** during map interactions.
* **GPU-Composited Animations**: Any loaders, drawers, or hover effects must use GPU-accelerated CSS properties (`transform: translate/scale`, `opacity`) accompanied by `will-change` hints. **Never animate layout reflow properties** (like `left`, `top`, `margin`, `width`, or `height`).

### 2. Code Quality
* **Type Safety**: No TypeScript ignore flags (`// @ts-ignore` or `any` types) unless wrapping un-typed external modules.
* **Security & Sanitization**: Any public user-facing strings (names, bios, messages) must pass through the `sanitizeInput` HTML entity encoding before reaching Redis or websocket distribution.
* **Responsive Layouts**: Design with mobile-first viewport constraints. Use CSS backdrop blurs, HSL Tailored palettes, and responsive glassmorphic cards.

---

## 📝 Documentation (Docs)

* **Inline Documentation**: Document complex algorithms (like coordinate offset hashing or stasis modes) with clear JSDoc comments.
* **Markdown Guides**: If you alter a WebSocket payload or add a new Redis channel, update the **WebSocket Protocol Reference** inside `README.md`.
* **Clarity**: Keep guide text concise, clear, and direct.

---

## 🚀 Pull Request (PR) Checklist

Before submitting your PR for review:
- [ ] Local verification passes with `npm run verify`.

> Tip: use `npm run typecheck` for a faster TypeScript-only check during development, but run the full `npm run verify` before submitting your PR.
- [ ] No raw credentials or private keys are committed in configuration files.
- [ ] JSDoc comments accompany new utility functions or hooks.
- [ ] The PR description clearly explains the **What**, **Why**, and **How** of the change.

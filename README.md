# 🎙️ Discord Clone

A real-time chat, community, and voice/video platform built as a graduation project — inspired by Discord, built from the ground up.

---

## ✨ What It Does

This app brings people together in real time, with the core experience you'd expect from a modern communication platform:

- 💬 **Live Messaging** — instant, real-time chat that updates for everyone the moment a message is sent
- 🏰 **Servers & Communities** — create and join servers to organize your groups and communities
- 📂 **Channels** — split conversations into topic-based text channels within each server
- 📩 **Direct Messages** — private one-on-one conversations outside of server channels
- 🎥 **Voice & Video Calls** — peer-to-peer voice and video calling powered by WebRTC

Everything is reactive by design — no refreshing, no polling, just live updates the instant something happens.

---

## 🛠️ Built With

| Layer | Technology |
|---|---|
| 🎨 Frontend | **React** |
| 💅 Styling | **Tailwind CSS** |
| ⚡ Backend & Realtime | **Convex** |
| 📞 Voice/Video | **WebRTC** |

Convex powers the real-time backend — data syncs live across every connected client, making chat, presence, and calls feel instant.

---

## 🌐 Documented v1 Limitation: NAT Traversal

Our voice/video calling uses **WebRTC** to establish direct **peer-to-peer** connections between users.

In this v1, we rely on a **STUN server** to help peers discover their public network address — but we do **not** yet run a **TURN relay server**.

**What this means:**
- ✅ Calls work seamlessly between peers on open networks or behind simple home routers (the vast majority of real-world cases)
- ⚠️ Calls may fail to connect between peers behind **symmetric NATs** or **restrictive corporate/campus firewalls**, since STUN alone cannot punch through every NAT configuration

This is a well-understood, **intentional scope boundary** for v1 — not a bug. A TURN server (e.g. via Coturn or a managed provider) would relay media traffic as a fallback whenever a direct P2P path can't be established, guaranteeing connectivity in 100% of network conditions. It's the clear next step on our roadmap. 🚀

---

<p align="center">Made with ❤️ as a graduation project</p>

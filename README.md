# 🎮 Capsa, Uno & Monopoly Game Suite

Welcome to the **Capsa, Uno & Monopoly Game Suite**! This is a modern, high-fidelity, and feature-rich web-based gaming platform that supports both **Local Solo Play (against smart AI bots)** and **Real-Time Online Multiplayer (via WebSockets)**. 

The suite is built with a highly responsive, custom-designed aesthetic featuring glowing glassmorphism interfaces, smooth interactive layouts, particle backgrounds, and a procedural sound effects generator.

---

## 🚀 Key Technical Highlights

- **Modern Frontend**: Engineered with **React 19**, **TypeScript**, and **Vite** for blazing-fast performance and HMR (Hot Module Replacement).
- **Real-Time Multiplayer Server**: Powered by a robust **Express** and **Socket.io** backend.
- **Procedural Sound Engine**: Includes a custom Web Audio API-based `SoundSynthesizer` that dynamically synthesizes game audio (card rustles, gavel strikes, money chimes, win fanfares, countdown beeps) from pure mathematical waveforms—requiring **zero external audio asset requests** and eliminating load latency!
- **Dynamic Avatar Creator**: An interactive, vector-based custom SVG avatar constructor enabling players to configure skin colors, hair styles, outfits, and facial expressions.
- **Smart AI Bots**: Built-in intelligent bot scripts capable of making logical decisions, evaluating Monopoly trades, executing tactical Uno jump-ins, and playing optimal Capsa combinations.
- **Resilient Room State & Reconnections**: Automatic game persistence, reconnection timers (TTL), and host transfer logic so games survive connection drops.

---

## 🛠️ Tech Stack & Directory Structure

### Tech Stack
- **Client**: React 19, TypeScript, Vite, CSS3 (Custom variables, glassmorphism, keyframe animations)
- **Server**: Node.js, Express, Socket.io (WebSocket client-server sync)
- **Audio**: Web Audio API (procedural synthesis)

### Project Directory Structure
```
capsa/
├── server/                     # Socket.io Game Server
│   ├── games/                  # Backend Game Engines & Rule Validators
│   │   ├── capsa.js            # Capsa Banting engine
│   │   ├── monopoly.js         # Monopoly "Get Rich" engine
│   │   └── uno.js              # Uno engine
│   ├── server.js               # Express & Socket.io server entry point
│   └── package.json            # Server dependencies
├── src/                        # React Frontend Client
│   ├── assets/                 # Static visual assets
│   ├── components/             # Reusable UI Components
│   │   ├── AvatarCreator.tsx   # Custom SVG avatar system
│   │   ├── GameTable.tsx       # Capsa gameplay UI
│   │   ├── UnoTable.tsx        # Uno gameplay UI
│   │   ├── MonopolyTable.tsx   # Monopoly "Get Rich" Board & gameplay UI
│   │   ├── Confetti.tsx        # Victory particle system
│   │   └── FallingBackground.tsx # Interactive background effects
│   ├── utils/                  # Clientside Logic & Utilities
│   │   ├── audio.ts            # Dynamic Web Audio Synthesizer
│   │   ├── gameLogic.ts        # Capsa combination & bot calculations
│   │   ├── unoLogic.ts         # Uno card scoring & bot tactics
│   │   └── monopolyLogic.ts    # Monopoly tiles, bot trading & roll calculations
│   ├── App.tsx                 # Core client router & state coordinator
│   ├── index.css               # Main visual tokens & variables
│   └── main.tsx                # Client entry point
├── package.json                # Client script configurations
└── tsconfig.json               # TypeScript configuration settings
```

---

## ⚙️ Installation & Setup Guide

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 2. Install Dependencies
Run the following command in the project root. This will automatically install the client dependencies and trigger a `postinstall` script to set up the server packages as well:
```bash
npm install
```

### 3. Running Locally in Development Mode
You will need two terminals to run the client and the server simultaneously.

**Terminal 1 (Start the Socket.io Server):**
```bash
npm start
```
*Runs on [http://localhost:3001](http://localhost:3001) by default.*

**Terminal 2 (Start the Vite Dev Client):**
```bash
npm run dev
```
*Runs on [http://localhost:5173](http://localhost:5173) by default.*

### 4. Custom Environment Variables
You can configure custom endpoints by adding a `.env` file in the project root:
- `VITE_SERVER_URL`: Overrides the multiplayer backend socket URL (defaults to `http://localhost:3001`).

---

## 🎲 Game Rulesets

### 1. Capsa Banting (Big Two)
A popular Eastern trick-taking card game where players compete to empty their hands first.
- **Card Hierarchy**: 2 is the highest rank, 3 is the lowest rank. Suits ordered ascending: **Diamonds (♦) < Clubs (♣) < Hearts (♥) < Spades (♠)**.
- **First Move**: The player holding the **3 of Diamonds (3♦)** must make the first play, and the play must include the 3♦.
- **Valid Combinations**: Singles, Pairs, Triples, and 5-Card Hands (Straight, Flush, Full House, Four of a Kind, Straight Flush).
- **Passing**: If you pass, you cannot play again until the round resets (when all other players pass and the last player gets to lead).
- **Bomb Rules**: Optional rules for four-of-a-kind (Single Bomb) and straight flushes to cut/beat high ranks.

### 2. Uno
Classic card-shedding game with customizable options.
- **Jump-In Rule**: If a player holds the *exact matching card* (same color and value) currently on top of the pile, they can play it immediately even if it is not their turn.
- **Stacking**: Allows players to stack `+2` or `+4` cards to pass the accumulated draw count to the next player.
- **Special Card Actions**: 
  - **7-Swap**: Playing a 7 allows you to swap your entire hand with any player.
  - **0-Rotate**: Playing a 0 rotates all hands in the current direction of play.
- **Call Uno**: Players must call Uno when they have 1 card left. Other players can challenge them if they fail to call it.

### 3. Monopoly "Get Rich" Mode
An action-packed, fast-paced variant of the classic property board game designed to speed up gameplay.
- **Dice Power Bar**: Hold the roll button and release! The fluctuating power bar determines your roll weight:
  - **Low (1-33%)**: Forces a sum of `2-4`.
  - **Medium (34-66%)**: Forces a sum of `5-8`.
  - **High (67-100%)**: Forces a sum of `9-12`.
- **Instant Buildings**: Landed properties can be instantly built up to **4 houses** on a single turn without needing the complete color set. To build a **Hotel** (5th level), the owner must land on the 4-house property once more.
- **Forced Acquisitions**: Land on an opponent's property? After paying rent, if you have enough cash, you can **force-buy** the property from them for its current asset value. (Hotels are protected from forced buys).
- **Consumable Cards**: 
  - **Angel Card**: Held to exempt you from paying rent once, or to protect your property from a forced buyout.
  - **Odd/Even Card**: Used before rolling to force the dice outcome to be Odd or Even.
- **Airport (Free Parking)**: Allows players to pay a flat fee to **fly to any tile** on the board immediately.
- **Festival (Go to Jail)**: Select one of your properties to **double its rent** for the next 3 turns.

---

## 🎨 Design System & Aesthetics
- **Theme**: Premium dark mode featuring deep space overlays, vibrant accent gradients, and neon shadows.
- **Glassmorphism**: Elegant translucent panels (`backdrop-filter: blur()`) paired with micro-borders.
- **Micro-Animations**: Hover scales, particle trails, sliding menus, bouncing dice, and smooth card dealing animations create an alive, responsive environment.
- **Font Face**: Sleek modern typography (Outfit / Inter) with strict typographic hierarchies.

---

## 📜 License
This project is licensed under the MIT License. Feel free to modify and deploy!

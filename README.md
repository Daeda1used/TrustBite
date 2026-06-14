# TrustBite

TrustBite is a lightweight XRPL demo for expert-led restaurant reviews. It shows how verified experts, merchant challenges, review governance, and reward payments can be modeled with XRPL Devnet wallets and on-ledger transactions.

The app is intentionally local-first. Runtime files such as generated wallets, sessions, review state, and other demo data are stored under `data/` and are excluded from Git.

## Features

- Visitor, expert, merchant, and admin demo views
- XRPL Devnet wallet bootstrap and balance refresh
- Wallet-signature login flows for experts, merchants, and admins
- Expert credential issuing and review publishing workflow
- Merchant review challenges and bounty-style expert assignments
- Local JSON storage for demo state

## Tech Stack

- Node.js
- Plain HTML, CSS, and JavaScript
- XRPL JavaScript SDK

## Local Setup

```bash
npm install
npm start
```

Open `http://127.0.0.1:4100` in your browser.

Optional environment variables:

```bash
PORT=4100
XRPL_SERVER=wss://s.devnet.rippletest.net:51233
```

## Deployment

This demo runs as a Node.js HTTP server and can be deployed to any platform that supports Node.js apps.

1. Install dependencies with `npm install`.
2. Set `PORT` to the port provided by the host.
3. Keep `XRPL_SERVER` pointed at XRPL Devnet or Testnet.
4. Start the app with `npm start`.

Do not commit generated files from `data/`, `.env`, logs, or local wallet/session data.

# MindBloom

MindBloom is an AI-guided student wellbeing companion covering physical, emotional, mental, and academic balance. It's a static frontend (HTML/CSS/vanilla JS) paired with a small Vercel serverless function that proxies chat requests to OpenAI.

## Features

- **Dashboard** — daily overview and greeting
- **Bloom AI Chat** — a supportive chat companion (`pages/chat.html`)
- **Journal** — personal reflection and entries
- **Wellbeing** — physical health tracking and a breathing exercise
- **Smart Planner** — task and schedule management
- **Analytics** — trends across habits and mood
- **Settings** and account pages (sign in, sign up, password reset)

## Project structure

```
index.html            Entry splash screen
pages/                 App pages (dashboard, chat, journal, planner, analytics, settings, auth)
scripts/               Vanilla JS modules, one per feature area
styles/                Global styles, variables, and per-page stylesheets
assets/                Icons and static assets
api/chat.js            Vercel serverless function that proxies chat requests to OpenAI
manifest.json          PWA manifest
service-worker.js      Offline/caching support
```

## Running locally

This project has no build step — it's plain HTML/CSS/JS. Serve the root folder with any static file server, for example:

```bash
npx serve .
```

Then open the printed local URL in your browser.

### Chat feature (optional)

The Bloom AI Chat page calls `api/chat.js`, a Vercel serverless function. To run it locally with the [Vercel CLI](https://vercel.com/docs/cli):

```bash
npm i -g vercel
vercel dev
```

Set an `OPENAI_API_KEY` environment variable (e.g. in a local `.env` file, which is already gitignored) before starting `vercel dev` — the function reads it server-side and never exposes it to the browser.

## Deployment

The app is designed to deploy on [Vercel](https://vercel.com): the static files are served directly, and `api/chat.js` is picked up automatically as a serverless endpoint. Set `OPENAI_API_KEY` in the Vercel project's Environment Variables before deploying.

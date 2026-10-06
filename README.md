# REMI

![REMI — Know what deserves a closer look](assets/remi-open-source-banner.jpeg)

**Open sourced October 6, 2026.**

REMI is an interactive real estate intelligence platform showcase, with guest access to market insights, property research, and neighborhood maps across Austin and Denver. Built with React, TypeScript, and Vite.

This repository contains the frontend showcase. Live data services and backend integrations require separately configured services.

## Reference deployment

https://remi-showcase-amesbqajy-mine-e68a.vercel.app

## Run locally

Use Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:3001), then choose the existing guest access option on the login page. Guest access uses fictional demonstration data.

## Build

```sh
npm run build
npm run preview
```

## Environment and integrations

No environment file is required to build the showcase. The source retains its existing placeholder defaults and guest access behavior. Authentication, backend requests, voice, and provider integrations require separate services and valid configuration; this copy does not provision them.

`.env.example` lists optional variables with placeholders. Copy it to `.env.local` only when configuring your own services, and replace or remove placeholder entries. Vite exposes `VITE_*` values in browser bundles: never put private API keys or Supabase service-role keys in them. Use only browser-safe credentials with appropriate restrictions.

Environment files, dependencies, build output, caches, and deployment metadata are excluded from Git. No Vercel Git integration is configured by this preparation.

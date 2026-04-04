# Student Emotional Analytics

A realtime platform for analyzing student emotional signals and written reflections. Includes a React + Vite frontend and a Node/Express server that integrates with AI services (Gemini), Firebase (optional), and SMTP for notifications.

Quick start

- Copy environment template and fill secrets:

```bash
cp .envexample .env
# edit .env and fill values
```

- Install dependencies

```bash
npm install
```

- Run in development

```bash
npm run dev
```

Build

```bash
npm run build
```

Environment

See `.envexample` for available variables. Do NOT commit your `.env` file — it's ignored by git.

Repository layout

- `server.ts` — Express server and API
- `App.tsx`, `index.tsx` — Frontend app (Vite + React + TypeScript)
- `components/` — React UI components
- `services/` — API wrappers (Gemini, Firebase, storage)
- `functions/` — Cloud functions (if used)

License

This project is licensed under the MIT License — see the `LICENSE` file.

Contributing

Please open issues or pull requests. For local development, follow the Quick start steps above.

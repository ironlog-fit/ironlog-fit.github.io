# IronLog

A personal training, habit and nutrition tracker. Static site, no backend, no build step — everything runs in your browser and your data stays on your device (`localStorage`).

It was inspired by the feature set of apps like EliteEngine (workout logging, a habit tracker, macro tracking, an XP/rank system, and an AI coach), but it's an independent project built from scratch — no shared code, design assets, or branding, and no affiliation with School of Elites or Teekay.

## Features

- **Train** — build workout templates, log sets/reps/weight during a session, automatic personal-record tracking, a 90s rest timer, and session history.
- **Habits** — a daily checklist with per-habit streaks.
- **Fuel** — daily calorie/macro targets, a quick-add list of common foods, manual meal entry, and an optional AI macro estimator.
- **Dashboard** — an XP/rank gauge (Bronze → Apex), today's snapshot, and a 7-day workout streak strip.
- **Coach** (optional) — a simple AI chat that can see your stats for the day, so it can give specific answers instead of generic advice.
- **Backup** — export/import your data as a JSON file from Settings.

## Running it

Nothing to install, no server required. Open `index.html` directly in a browser to try it locally. Installability (the "Install app" button, offline support) only activates once it's served over `https://` or `localhost` — that's a browser security rule for service workers, not something this app needs a server for. GitHub Pages satisfies that automatically.

## Hosting it on GitHub Pages

1. Create a new repository and push everything in this folder (`index.html`, `styles.css`, `app.js`, `manifest.json`, `sw.js`, `icons/`, `README.md`) to the root of the `main` branch.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`.
4. Save. GitHub gives you a URL like `https://yourusername.github.io/your-repo/` a minute or two later.

If you want it to stay private, keep the repository private — GitHub Pages works on private repos too if your plan supports it, or you can just run it locally / on your own device instead of publishing it.

## Installing it as an app

Once it's hosted (GitHub Pages or any `https://` host), it's an installable PWA:

- **Android / Chrome / Edge**: an "⬇ Install" button appears in the app's top bar. Tap it, confirm, and it's added to your home screen / app list, opening in its own window with no browser chrome. You can also use the browser's own menu → "Install app" / "Add to Home screen".
- **iPhone / iPad (Safari)**: iOS doesn't support automatic install prompts, so the app shows a one-time tip: tap **Share → Add to Home Screen**. That's the same result — a home-screen icon that opens full-screen.
- **Desktop Chrome/Edge**: look for the install icon in the address bar, or use the in-app "Install" button.

After the first visit, a service worker caches the app shell (the HTML/CSS/JS/icons), so **training, habits and nutrition tracking keep working offline** — no internet, no server, nothing running in the background on your machine. The one thing that still needs a live connection is the AI Coach / meal estimator, since those are real-time calls to Anthropic's servers — that was always true, installing the app doesn't change it.

## The AI features are optional — and how the key is handled

Neither AI feature has ever needed a server, Python or otherwise — they call the Anthropic API **directly from your browser**, using your own API key:

- Get a key at [console.anthropic.com](https://console.anthropic.com), then paste it into **Settings → AI Coach** in the app.
- The key is saved with `localStorage` **only on that device/browser**. It is never written into `index.html`, `app.js`, or any file you'd commit to GitHub, and it is deliberately left out of the JSON backup you export from Settings.
- Because the key lives only in your browser's storage, publishing the *code* to a public GitHub repo does not expose your key — but anyone who has access to that specific browser profile could see it in dev tools, so don't use this on a shared/public computer.
- Without a key, everything else in the app (training log, habits, nutrition tracking, XP/ranks) works exactly the same — those tabs just won't show up.
- You can change the model string in Settings (defaults to `claude-sonnet-5`) if Anthropic renames or replaces it later.

## Data & backups

Everything is stored in `localStorage`, scoped to the browser and device you're using. That means:

- Clearing your browser's site data, or switching browsers/devices, starts you fresh.
- Use **Settings → Export backup** regularly, and **Import backup** to restore or move your data.
- **Settings → Reset all data** wipes everything on that device — it asks for confirmation twice.

## Customizing

- **Templates**: seeded with a basic Push/Pull/Legs split — edit, delete, or add your own from the Train → Templates tab.
- **Habits**: seeded with six defaults — rename, remove, or add more from the Habits tab.
- **Rank thresholds, XP values, and the quick-add food list**: near the top of `app.js` (`RANKS`, `QUICK_FOODS`, XP amounts inside `finishSession`, `toggleHabit`, and `logMeal`).
- **Colors/fonts**: CSS custom properties at the top of `styles.css`.

## Notes

- No analytics, no tracking, no third-party calls except the optional direct-to-Anthropic requests described above.
- Built as a personal tool — there's no login system, since it's meant for one person's own device(s).

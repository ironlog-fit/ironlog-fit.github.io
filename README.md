# IronLog

A personal training, habit and nutrition tracker. Static site, no backend, no build step — everything runs in your browser and your data stays on your device (`localStorage`).

It was inspired by the feature set of apps like EliteEngine (workout logging, a habit tracker, macro tracking, an XP/rank system, and an AI coach), but it's an independent project built from scratch — no shared code, design assets, or branding, and no affiliation with School of Elites or Teekay.

## Features

- **Train** — build workout templates, then log a session fast: one weight per exercise (pre-filled from your last lift), tap through your sets, rest timer starts automatically. Automatic personal-record tracking and session history.
- **Habits** — a daily checklist with per-habit streaks.
- **Fuel** — daily calorie/macro targets, a quick-add list of common foods, manual meal entry, and an optional AI macro estimator.
- **Dashboard** — an XP/rank gauge (Bronze → Apex), today's snapshot, a 7-day workout streak strip, and a warning banner if your streak is about to lapse.
- **Coach** (optional) — an AI chat that can see your stats for the day. Runs free on your own device by default, or you can switch to your own Claude API key for better quality.
- **Reminders** — an optional nudge if today isn't logged yet by a time you pick.
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

After the first visit, a service worker caches the app shell (the HTML/CSS/JS/icons), so **training, habits and nutrition tracking keep working offline** — no internet, no server, nothing running in the background on your machine. The one thing that still needs a live connection is the Cloud AI option, since that's a real-time call to Anthropic's servers — the free on-device AI works offline too, once its model is downloaded.

## AI Coach & meal estimator — free by default, cloud optional

Settings → **AI Coach & meal estimator** lets you pick how it runs:

**Free · on-device (default).** Runs a small open-source language model (Llama 3.2) entirely in your browser using [WebLLM](https://github.com/mlc-ai/web-llm) and your device's GPU (WebGPU). No account, no key, no cost, and no data ever leaves your device.
- First use downloads the model (roughly 1–2GB depending on which size you pick) and caches it in the browser — after that it works offline.
- Needs a browser with WebGPU support — current Chrome or Edge (desktop or Android) work well. If your browser doesn't support it, the app tells you and you can switch to Cloud mode instead.
- Being honest about the trade-off: a small on-device model is genuinely weaker than Claude — good for quick coaching tips and rough macro guesses, not something to trust blindly for anything that matters. Double-check macro estimates before logging.
- You can load, switch, or unload the model from Settings any time.
- **Known limitation**: some GPU/browser/driver combinations only support 16KB of "compute workgroup storage," while most prebuilt WebLLM models need 32KB. If you hit an error mentioning `maxComputeWorkgroupStorageSize`, that's this — a real hardware/driver ceiling, not a bug in this app or something a setting can fix. The Settings screen checks for this ahead of time and tells you if your device is likely affected. Chrome or Edge (updated to a recent version) support WebGPU best; updating GPU drivers can also help. Otherwise, Cloud mode sidesteps the issue entirely since it doesn't use your GPU at all.

**Cloud · your API key (optional).** Calls the Anthropic API **directly from your browser**, using your own key:
- Get a key at [console.anthropic.com](https://console.anthropic.com), then paste it into Settings.
- The key is saved with `localStorage` **only on that device/browser**. It is never written into `index.html`, `app.js`, or any file you'd commit to GitHub, and it is deliberately left out of the JSON backup you export from Settings.
- Because the key lives only in your browser's storage, publishing the *code* to a public GitHub repo does not expose your key — but anyone with access to that specific browser profile could see it in dev tools, so don't use this on a shared/public computer.
- You can change the model string in Settings (defaults to `claude-sonnet-5`) if Anthropic renames or replaces it later.

Either way, everything else in the app (training log, habits, nutrition tracking, XP/ranks) works exactly the same without any AI set up at all — those two features just won't show up.

## Reminders

Settings → **Reminders** lets you turn on a browser notification if your workout or habits aren't done yet by a time you pick. Worth knowing upfront: this is a static app with no backend, so it can only check and notify while IronLog is open in a tab, or very soon after you reopen it that day — it genuinely cannot wake your phone up from a fully closed browser, since real "wake the device" push notifications need a push server this project intentionally doesn't have. Opening the app once in the evening is what actually triggers the check.

## Data & backups

Everything is stored in `localStorage`, scoped to the browser and device you're using. That means:

- Clearing your browser's site data, or switching browsers/devices, starts you fresh.
- Use **Settings → Export backup** regularly, and **Import backup** to restore or move your data.
- **Settings → Reset all data** wipes everything on that device — it asks for confirmation twice.

## Customizing

- **Templates**: seeded with a basic Push/Pull/Legs split — edit, delete, or add your own from the Train → Templates tab.
- **Habits**: seeded with six defaults — rename, remove, or add more from the Habits tab.
- **Rank thresholds, XP values, and the quick-add food list**: near the top of `app.js` (`RANKS`, `QUICK_FOODS`, XP amounts inside `finishSession`, `toggleHabit`, and `logMeal`).
- **Local AI models offered**: `DEFAULT_LOCAL_MODELS` in `app.js` — any model ID from [WebLLM's model list](https://webllm.mlc.ai) works.
- **Colors/fonts**: CSS custom properties at the top of `styles.css`.

## Notes

- No analytics, no tracking. The only network calls this app makes are: Google Fonts (styling), the WebLLM model download (only if you use the free local AI), and the Anthropic API (only if you use Cloud mode).
- Built as a personal tool — there's no login system, since it's meant for one person's own device(s).

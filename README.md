# IronLog

**Live at [ironlog-fit.github.io](https://ironlog-fit.github.io/)**

A personal training, habit and nutrition tracker. Static site, no backend, no build step — everything runs in your browser and your data stays on your device (`localStorage`).

It was inspired by the feature set of apps like EliteEngine (workout logging, a habit tracker, macro tracking, an XP/rank system, and an AI coach), but it's an independent project built from scratch — no shared code, design assets, or branding, and no affiliation with School of Elites or Teekay.

## Features

- **Train** — build workout templates, then log a session fast: one weight per exercise (pre-filled from your last lift), a swipe-to-scrub picker for reps on each set (tap the arrows to step by 1, drag the number to scrub through 0–100, or tap it for exact entry), rest timer starts automatically. Comes seeded with a Push/Pull/Legs split and a separate template per muscle group (Chest, Back, Shoulders, Legs, Biceps, Triceps, Abs & Core) — use whichever split you prefer, or mix both. Automatic personal-record tracking and session history.
- **Habits** — a daily checklist with per-habit streaks.
- **Fuel** — daily calorie/macro targets, a quick-add list of common foods, manual meal entry, and an optional AI macro estimator.
- **Dashboard** — an XP/rank gauge (Bronze → Apex, then into open-ended "Apex I / II / III…" prestige tiers so there's always a next number to chase), a streak "hero" card showing your current fire tier (Kindling → Ember → Forge Fire → Molten → White-Hot → Unbreakable → Legendary) with a progress bar to the next milestone, today's snapshot with mini progress bars, a 7-day workout streak rendered as a literal chain (linked when consecutive days are done), and a warning banner if your streak is about to lapse.
- **Streaks** — tapping the flame in the top bar opens a streak breakdown (current/longest/total sessions, plus each habit's own streak and tier). Crossing a streak milestone (3, 7, 14, 30, 60, 100… days) pops a small celebration with bonus XP.
- **Coach** (optional) — an AI chat that can see your stats for the day. Runs free on your own device by default, or you can switch to your own Claude API key for better quality.
- **Daily reminder** — an optional single nudge if today isn't logged yet by a time you pick, with wording that adapts to what's actually missing.
- **Habit nudges** — a second, separate notification feature focused on habits: checked at two times a day, it sends just 1 nudge if you've already been active in the app that day, or 2 (a gentle one, then a firmer one) if you haven't opened it at all.
- **Backup** — export/import your data as a JSON file from Settings.

## Running it

Nothing to install, no server required. Open `index.html` directly in a browser to try it locally. Installability (the "Install app" button, offline support) only activates once it's served over `https://` or `localhost` — that's a browser security rule for service workers, not something this app needs a server for. GitHub Pages satisfies that automatically.

## Hosting it on GitHub Pages

Already live at [ironlog-fit.github.io](https://ironlog-fit.github.io/). To host your own copy elsewhere (or fork this one):

1. Create a new repository and push everything in this folder (`index.html`, `styles.css`, `app.js`, `manifest.json`, `sw.js`, `icons/`, `README.md`) to the root of the `main` branch.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`.
4. Save. GitHub gives you a URL like `https://yourusername.github.io/your-repo/` a minute or two later.

If you want it to stay private, keep the repository private — GitHub Pages works on private repos too if your plan supports it, or you can just run it locally / on your own device instead of publishing it.

## Installing it as an app

It's a PWA at [ironlog-fit.github.io](https://ironlog-fit.github.io/), so it's installable straight from there:

- **Android / Chrome / Edge**: an "⬇ Install" button appears in the app's top bar. Tap it, confirm, and it's added to your home screen / app list, opening in its own window with no browser chrome. You can also use the browser's own menu → "Install app" / "Add to Home screen".
- **iPhone / iPad (Safari)**: iOS doesn't support automatic install prompts, so the app shows a one-time tip: tap **Share → Add to Home Screen**. That's the same result — a home-screen icon that opens full-screen.
- **Desktop Chrome/Edge**: look for the install icon in the address bar, or use the in-app "Install" button.

After the first visit, a service worker caches the app shell (the HTML/CSS/JS/icons), so **training, habits and nutrition tracking keep working offline** — no internet, no server, nothing running in the background on your machine. The one thing that still needs a live connection is the Cloud AI option, since that's a real-time call to Anthropic's servers — the free on-device AI works offline too, once its model is downloaded.

## AI Coach & meal estimator — free by default, cloud optional

Settings → **AI Coach & meal estimator** lets you pick how it runs:

**Free · on-device (default).** Runs a small open-source language model (Llama 3.2) entirely in your browser using [WebLLM](https://github.com/mlc-ai/web-llm) and your device's GPU (WebGPU) when one is available. No account, no key, no cost, and no data ever leaves your device.
- First use downloads the model (roughly 1–2GB depending on which size you pick) and caches it in the browser — after that it works offline.
- **Automatic CPU fallback**: if your browser/GPU can't run the GPU model — no WebGPU support, no compatible GPU device, or not enough compute memory (see the known limitation below) — the app automatically switches to a much smaller model that runs on your CPU via [transformers.js](https://github.com/huggingface/transformers.js), no GPU required at all. It's noticeably slower (seconds per reply instead of near-instant) and weaker, but it means local AI works on essentially any laptop, not just ones with solid WebGPU support. Settings shows you which backend actually loaded.
- Being honest about the trade-off either way: a small on-device model is genuinely weaker than Claude — good for quick coaching tips and rough macro guesses, not something to trust blindly for anything that matters. Double-check macro estimates before logging.
- You can load, switch, or unload the model from Settings any time.
- **Known limitation**: some GPU/browser/driver combinations only support 16KB of "compute workgroup storage," while most prebuilt WebLLM GPU models need 32KB, and some laptops don't expose a usable GPU to the browser at all (hardware acceleration off, outdated drivers, etc.). Both are real hardware/driver conditions, not bugs in this app — the Settings screen checks for them ahead of time and explains what it found, but either way local AI still works via the automatic CPU fallback above.

**Cloud · your API key (optional).** Calls the Anthropic API **directly from your browser**, using your own key:
- Get a key at [console.anthropic.com](https://console.anthropic.com), then paste it into Settings.
- The key is saved with `localStorage` **only on that device/browser**. It is never written into `index.html`, `app.js`, or any file you'd commit to GitHub, and it is deliberately left out of the JSON backup you export from Settings.
- Because the key lives only in your browser's storage, publishing the *code* to a public GitHub repo does not expose your key — but anyone with access to that specific browser profile could see it in dev tools, so don't use this on a shared/public computer.
- You can change the model string in Settings (defaults to `claude-sonnet-5`) if Anthropic renames or replaces it later.

Either way, everything else in the app (training log, habits, nutrition tracking, XP/ranks) works exactly the same without any AI set up at all — those two features just won't show up.

## Reminders & habit nudges

Settings has two independent notification features:

- **Daily reminder** — one browser notification if your workout or habits aren't done yet by a time you pick, worded around whatever's actually still missing (and mentioning your streak if you have one).
- **Habit nudges** — a habit-focused feature, checked at two times you pick (defaults: 13:00 and 20:30). If you've already opened IronLog and done *something* that day, you get a single nudge listing whatever habits are still open. If you haven't touched the app at all that day, you get two — a softer one at the first check, a firmer one at the second — capped at two per day either way. Both stop nudging once your habits are fully done.

Tapping either notification jumps straight to the relevant tab (Habits or Train).

Worth knowing upfront: this is a static app with no backend, so both features can only check and notify while IronLog is open in a tab, or very soon after you reopen it that day — they genuinely cannot wake your phone up from a fully closed browser, since real "wake the device" push notifications need a push server this project intentionally doesn't have. Opening the app at least once around each check time is what actually triggers it.

## No browser popups

Every confirmation, prompt, and alert (deleting a template, resetting data, naming a new habit, and so on) uses the app's own dark/brass-styled dialog instead of the browser's native `confirm()`/`prompt()`/`alert()` boxes — those always look out of place against a custom theme. The one exception is the install prompt ("⬇ Install"), which is a browser-controlled security UI that can't be restyled.

## Data & backups

Everything is stored in `localStorage`, scoped to the browser and device you're using. That means:

- Clearing your browser's site data, or switching browsers/devices, starts you fresh.
- Use **Settings → Export backup** regularly, and **Import backup** to restore or move your data.
- **Settings → Reset all data** wipes everything on that device — it asks for confirmation twice.

## Customizing

- **Templates**: seeded with a Push/Pull/Legs split plus a template per muscle group (`PPL_TEMPLATES` and `MUSCLE_TEMPLATES` in `app.js`) — edit, delete, or add your own from the Train → Templates tab. If you already had the app installed before the per-muscle templates existed, they're added automatically the next time you open it, without touching anything you've already customized or deleted.
- **Habits**: seeded with six defaults — rename, remove, or add more from the Habits tab.
- **Rank thresholds, XP values, and the quick-add food list**: near the top of `app.js` (`RANKS`, `QUICK_FOODS`, XP amounts inside `finishSession`, `toggleHabit`, and `logMeal`). Thresholds are paced for a multi-month climb rather than a quick one — Apex isn't a hard ceiling either; `APEX_PRESTIGE_STEP` controls how much XP each numbered prestige tier (Apex I, II, III…) takes beyond it.
- **Local AI models offered**: `DEFAULT_LOCAL_MODELS` in `app.js` for the GPU path, `CPU_FALLBACK_MODEL` for the CPU path — any model ID from [WebLLM's model list](https://webllm.mlc.ai) or [transformers.js-compatible ONNX models](https://huggingface.co/models?library=transformers.js) works.
- **Colors/fonts**: CSS custom properties at the top of `styles.css`.

## Notes

- No analytics, no tracking. The only network calls this app makes are: Google Fonts (styling), the WebLLM/transformers.js model download (only if you use the free local AI), and the Anthropic API (only if you use Cloud mode).
- Built as a personal tool — there's no login system, since it's meant for one person's own device(s).

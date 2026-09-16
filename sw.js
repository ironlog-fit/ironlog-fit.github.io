// IronLog service worker — caches the app shell so the tracker works
// offline once it's been opened at least once. Never touches API calls.

const CACHE_NAME = 'ironlog-shell-v2';

const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Never intercept non-GET requests (this includes the POST calls the
  // app makes to api.anthropic.com — those must always go straight to
  // the network, untouched, and Cache.put() would throw on them anyway).
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only manage caching for our own same-origin files. Cross-origin
  // requests (Google Fonts, the Anthropic API, local-AI model weights)
  // pass straight through to the network as normal fetches.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached); // offline and not cached → nothing we can do

      // Cache-first for speed and offline support; refresh the cache
      // quietly in the background when online.
      return cached || network;
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = (event.notification.data && event.notification.data.url) || './index.html';
  const targetUrl = new URL(targetPath, self.location.href).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(targetUrl).catch(() => {});
          }
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

/* ================================================================
   BACKGROUND NOTIFICATIONS (Periodic Background Sync)
   ================================================================
   The reminder/habit-nudge checks in app.js only run while a tab is
   open, because they use setTimeout + visibilitychange in page JS —
   both die the moment the tab or browser closes. There's no way
   around that with plain JS timers.

   Periodic Background Sync lets this service worker wake up on its
   own, on a schedule Chrome decides (not a fixed interval — it's
   based on how often you actually use the app), and run the same
   check without any tab open. It only works if: IronLog is
   installed as an app (not just visited as a tab), on a
   Chromium-based browser (Chrome/Edge/Samsung Internet — no Safari,
   no Firefox), and the browser accessible to it is app.js's
   register step; see app.js's tryRegisterBackgroundSync().

   The page can't be read directly from here (no access to
   localStorage from a service worker), so app.js mirrors just the
   fields needed for this decision into IndexedDB every time
   relevant state changes. That snapshot is all this has to work
   with — see buildNotifySnapshot() in app.js for its shape.
   ================================================================ */

function idbOpenNotifyDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ironlog-notify', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('kv'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  try {
    const db = await idbOpenNotifyDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly');
      const r = tx.objectStore('kv').get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  } catch (e) { return null; }
}
async function idbSet(key, value) {
  try {
    const db = await idbOpenNotifyDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { /* best-effort — no IndexedDB, nothing we can do here */ }
}

function pad2(n) { return String(n).padStart(2, '0'); }
function formatDateLocal(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function timeReached(now, timeStr) {
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  return now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
}

function bgReminderMessage(streak, workoutDone, habitsFullyDone) {
  const streakNote = streak > 0 ? ` Your ${streak}-day streak is waiting on it.` : '';
  if (!workoutDone && !habitsFullyDone) return `Nothing logged yet today.${streakNote} A quick workout or habit check keeps things moving.`;
  if (!workoutDone) return `Habits are sorted — just today's workout left.${streakNote}`;
  return `Workout's in — a few habits left to close out the day.${streakNote}`;
}
function bgHabitNudgeMessage(slot, hasActivity, remaining) {
  const names = remaining.slice(0, 2).map((h) => h.name).join(', ');
  const extra = remaining.length > 2 ? ` +${remaining.length - 2} more` : '';
  const count = remaining.length;
  const plural = count === 1 ? '' : 's';
  if (slot === 1) {
    return hasActivity
      ? `You're active today — ${count} habit${plural} left: ${names}${extra}.`
      : `Haven't opened IronLog today. ${count} habit${plural} waiting: ${names}${extra}.`;
  }
  return hasActivity
    ? `Almost there — ${count} habit${plural} left today: ${names}${extra}.`
    : `Day's winding down and nothing's logged yet. ${count} habit${plural} still open: ${names}${extra}.`;
}

async function runBackgroundNotifyCheck() {
  const snap = await idbGet('notifyState');
  if (!snap || !snap.settings) return;

  const now = new Date();
  const todayStr = formatDateLocal(now);
  const isFresh = snap.today === todayStr; // if not, the page hasn't run today — nothing logged yet
  const workoutDone = isFresh ? !!snap.workoutDone : false;
  const habitLogsToday = isFresh ? (snap.habitLogsToday || {}) : {};
  const mealsLoggedToday = isFresh ? !!snap.mealsLoggedToday : false;
  const habits = snap.habits || [];
  const remaining = habits.filter((h) => !habitLogsToday[h.id]);
  const habitsFullyDone = habits.length > 0 && remaining.length === 0;
  const hasActivity = workoutDone || mealsLoggedToday || Object.values(habitLogsToday).some(Boolean);

  const s = snap.settings;
  let changed = false;

  if (s.remindersEnabled
      && (!workoutDone || !habitsFullyDone)
      && s.reminderLastShownDate !== todayStr
      && timeReached(now, s.reminderTime || '20:00')) {
    let url = './index.html';
    if (workoutDone && !habitsFullyDone) url = './index.html#habits';
    else if (!workoutDone && habitsFullyDone) url = './index.html#train';
    await self.registration.showNotification('IronLog', {
      body: bgReminderMessage(snap.streak || 0, workoutDone, habitsFullyDone),
      icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
      tag: 'ironlog-reminder', renotify: true, vibrate: [120, 60, 120],
      data: { url },
    });
    s.reminderLastShownDate = todayStr;
    changed = true;
  }

  if (s.habitNudgesEnabled && habits.length > 0 && !habitsFullyDone) {
    let nudgeState = s.habitNudgeState;
    if (!nudgeState || nudgeState.date !== todayStr) nudgeState = { date: todayStr, count: 0, final: false };
    if (!nudgeState.final) {
      let slot = 0;
      if (nudgeState.count < 1 && timeReached(now, s.habitNudgeTime1 || '13:00')) slot = 1;
      else if (nudgeState.count < 2 && timeReached(now, s.habitNudgeTime2 || '20:30')) slot = 2;
      if (slot) {
        await self.registration.showNotification('IronLog · Habits', {
          body: bgHabitNudgeMessage(slot, hasActivity, remaining),
          icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
          tag: 'ironlog-habit-nudge', renotify: true, vibrate: [120, 60, 120],
          data: { url: './index.html#habits' },
        });
        nudgeState = slot === 1
          ? { date: todayStr, count: 1, final: hasActivity }
          : { date: todayStr, count: nudgeState.count + 1, final: true };
        s.habitNudgeState = nudgeState;
        changed = true;
      }
    }
  }

  if (changed) await idbSet('notifyState', snap);
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'ironlog-habit-check') {
    event.waitUntil(runBackgroundNotifyCheck().catch(() => {}));
  }
});

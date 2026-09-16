/* ============================================================
   IronLog — personal training / habit / nutrition tracker
   Vanilla JS, no build step, no backend. Data lives in
   localStorage on the device it's used on.
   ============================================================ */

const STORAGE_KEY = 'ironlog_state_v1';
const APIKEY_STORAGE_KEY = 'ironlog_api_key'; // kept separate from state on purpose
const MODEL_STORAGE_KEY = 'ironlog_model';

// Thresholds are paced against realistic steady-state XP for a consistent
// user (roughly 100-150 XP/day from one workout + all habits) — Silver
// lands in about a week as an early win, Gold around a month in, and Apex
// is a multi-month milestone rather than something that falls in days.
const RANKS = [
  { name: 'Bronze',   min: 0 },
  { name: 'Silver',   min: 800 },
  { name: 'Gold',     min: 2500 },
  { name: 'Platinum', min: 6000 },
  { name: 'Diamond',  min: 13000 },
  { name: 'Apex',     min: 26000 },
];
// Apex isn't a hard ceiling — every ~10,000 XP beyond it rolls into the
// next "prestige" tier (Apex II, Apex III, ...) so there's always a next
// number to chase instead of the gauge just reading "Max rank reached"
// forever once someone's put in the months to get there.
const APEX_PRESTIGE_STEP = 10000;
function toRoman(num) {
  const table = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [val, sym] of table) { while (num >= val) { out += sym; num -= val; } }
  return out || 'I';
}

// Streak "tiers" — a forge/fire theme to match the app's iron-and-brass
// identity, plus its chain-link logo mark. Purely cosmetic (colors +
// names layered over the existing streak count), no new data fields.
const STREAK_TIERS = [
  { min: 0,   name: 'No streak',   emoji: '⛓',  color: '#6b6858' },
  { min: 1,   name: 'Kindling',    emoji: '🔥', color: '#9c7a42' },
  { min: 3,   name: 'Ember',       emoji: '🔥', color: '#c08a3e' },
  { min: 7,   name: 'Forge Fire',  emoji: '🔥', color: '#d97a3b' },
  { min: 14,  name: 'Molten',      emoji: '🔥', color: '#e15c33' },
  { min: 30,  name: 'White-Hot',   emoji: '🔥', color: '#ea3f2e' },
  { min: 60,  name: 'Unbreakable', emoji: '🔥', color: '#f2542d' },
  { min: 100, name: 'Legendary',   emoji: '🔥', color: '#ffbb3d' },
];
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 150, 200, 365];

function getStreakTier(streak) {
  let tier = STREAK_TIERS[0];
  for (const t of STREAK_TIERS) if (streak >= t.min) tier = t;
  return tier;
}
function nextStreakMilestone(streak) {
  return STREAK_MILESTONES.find(m => m > streak) || null;
}

const PPL_TEMPLATES = [
  { id: 'tpl_push', name: 'Push Day', exercises: [
    { id: uid(), name: 'Bench Press', sets: 4, reps: 8 },
    { id: uid(), name: 'Overhead Press', sets: 3, reps: 10 },
    { id: uid(), name: 'Incline Dumbbell Press', sets: 3, reps: 10 },
    { id: uid(), name: 'Tricep Pushdown', sets: 3, reps: 12 },
  ]},
  { id: 'tpl_pull', name: 'Pull Day', exercises: [
    { id: uid(), name: 'Deadlift', sets: 4, reps: 6 },
    { id: uid(), name: 'Lat Pulldown', sets: 3, reps: 10 },
    { id: uid(), name: 'Barbell Row', sets: 3, reps: 10 },
    { id: uid(), name: 'Bicep Curl', sets: 3, reps: 12 },
  ]},
  { id: 'tpl_legs', name: 'Legs Day', exercises: [
    { id: uid(), name: 'Squat', sets: 4, reps: 8 },
    { id: uid(), name: 'Romanian Deadlift', sets: 3, reps: 10 },
    { id: uid(), name: 'Leg Press', sets: 3, reps: 12 },
    { id: uid(), name: 'Calf Raise', sets: 4, reps: 15 },
  ]},
];

// One template per muscle group, for anyone who prefers a classic
// "bro split" over the combined Push/Pull/Legs days above.
const MUSCLE_TEMPLATES = [
  { id: 'tpl_chest', name: 'Chest', exercises: [
    { id: uid(), name: 'Barbell Bench Press', sets: 4, reps: 8 },
    { id: uid(), name: 'Incline Dumbbell Press', sets: 3, reps: 10 },
    { id: uid(), name: 'Chest Fly', sets: 3, reps: 12 },
    { id: uid(), name: 'Cable Crossover', sets: 3, reps: 15 },
    { id: uid(), name: 'Dips', sets: 3, reps: 12 },
  ]},
  { id: 'tpl_back', name: 'Back', exercises: [
    { id: uid(), name: 'Deadlift', sets: 4, reps: 6 },
    { id: uid(), name: 'Pull-Ups', sets: 4, reps: 8 },
    { id: uid(), name: 'Barbell Row', sets: 3, reps: 10 },
    { id: uid(), name: 'Seated Cable Row', sets: 3, reps: 12 },
    { id: uid(), name: 'Face Pull', sets: 3, reps: 15 },
  ]},
  { id: 'tpl_shoulders', name: 'Shoulders', exercises: [
    { id: uid(), name: 'Overhead Press', sets: 4, reps: 8 },
    { id: uid(), name: 'Lateral Raise', sets: 3, reps: 15 },
    { id: uid(), name: 'Front Raise', sets: 3, reps: 12 },
    { id: uid(), name: 'Rear Delt Fly', sets: 3, reps: 15 },
    { id: uid(), name: 'Shrugs', sets: 3, reps: 12 },
  ]},
  { id: 'tpl_legs_iso', name: 'Legs', exercises: [
    { id: uid(), name: 'Squat', sets: 4, reps: 8 },
    { id: uid(), name: 'Romanian Deadlift', sets: 3, reps: 10 },
    { id: uid(), name: 'Leg Press', sets: 3, reps: 12 },
    { id: uid(), name: 'Leg Curl', sets: 3, reps: 12 },
    { id: uid(), name: 'Leg Extension', sets: 3, reps: 12 },
    { id: uid(), name: 'Calf Raise', sets: 4, reps: 15 },
  ]},
  { id: 'tpl_biceps', name: 'Biceps', exercises: [
    { id: uid(), name: 'Barbell Curl', sets: 4, reps: 10 },
    { id: uid(), name: 'Hammer Curl', sets: 3, reps: 12 },
    { id: uid(), name: 'Preacher Curl', sets: 3, reps: 12 },
    { id: uid(), name: 'Concentration Curl', sets: 3, reps: 12 },
  ]},
  { id: 'tpl_triceps', name: 'Triceps', exercises: [
    { id: uid(), name: 'Close-Grip Bench Press', sets: 4, reps: 8 },
    { id: uid(), name: 'Tricep Pushdown', sets: 3, reps: 12 },
    { id: uid(), name: 'Overhead Tricep Extension', sets: 3, reps: 12 },
    { id: uid(), name: 'Skull Crushers', sets: 3, reps: 10 },
  ]},
  { id: 'tpl_abs', name: 'Abs & Core', exercises: [
    { id: uid(), name: 'Hanging Leg Raise', sets: 3, reps: 15 },
    { id: uid(), name: 'Cable Crunch', sets: 3, reps: 15 },
    { id: uid(), name: 'Plank (seconds)', sets: 3, reps: 60 },
    { id: uid(), name: 'Russian Twist', sets: 3, reps: 20 },
  ]},
];

const DEFAULT_TEMPLATES = [...PPL_TEMPLATES, ...MUSCLE_TEMPLATES];

const DEFAULT_HABITS = [
  'Sleep 7+ hours', 'Stretch / mobility', 'Sunlight or a walk',
  'Drink 3L water', 'No junk food', 'Read or journal 10 min',
].map(name => ({ id: uid(), name, streak: 0, lastDate: null }));

const QUICK_FOODS = [
  { name: 'Roti (1)', calories: 90, protein: 3, carbs: 18, fat: 1 },
  { name: 'Dal (1 bowl)', calories: 180, protein: 10, carbs: 24, fat: 5 },
  { name: 'Rice (1 cup)', calories: 205, protein: 4, carbs: 45, fat: 0 },
  { name: 'Paneer (100g)', calories: 265, protein: 18, carbs: 4, fat: 20 },
  { name: 'Chicken breast (100g)', calories: 165, protein: 31, carbs: 0, fat: 4 },
  { name: '2 Eggs', calories: 155, protein: 13, carbs: 1, fat: 11 },
  { name: 'Banana', calories: 105, protein: 1, carbs: 27, fat: 0 },
  { name: 'Milk (1 glass)', calories: 150, protein: 8, carbs: 12, fat: 8 },
  { name: 'Curd (1 bowl)', calories: 150, protein: 9, carbs: 11, fat: 8 },
  { name: 'Protein shake', calories: 130, protein: 25, carbs: 4, fat: 2 },
];

function uid() { return Math.random().toString(36).slice(2, 10); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function dateStrDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function defaultState() {
  return {
    xp: 0,
    templates: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
    activeSession: null,
    history: [],
    prs: {},
    habits: JSON.parse(JSON.stringify(DEFAULT_HABITS)),
    habitLogs: {},
    nutrition: {
      targets: { calories: 2200, protein: 150, carbs: 220, fat: 70 },
      logs: {},
    },
    workoutDays: {}, // dateStr -> true
    seededMuscleTemplates: true, // brand-new installs already have everything
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // shallow-merge with defaults so new fields don't break old saves
    const merged = Object.assign(defaultState(), parsed);

    // One-time migration: give people who already had this app installed
    // the new per-muscle templates too, without touching anything they've
    // already customized or deleted. Runs once, tracked by a flag, so
    // deleting one of these afterward is respected on future loads.
    if (!parsed.seededMuscleTemplates) {
      const existingIds = new Set((merged.templates || []).map(t => t.id));
      const toAdd = MUSCLE_TEMPLATES.filter(t => !existingIds.has(t.id));
      merged.templates = [...(merged.templates || []), ...JSON.parse(JSON.stringify(toAdd))];
      merged.seededMuscleTemplates = true;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch (e) { /* will save on next action anyway */ }
    }

    return merged;
  } catch (e) {
    console.error('Failed to load state, starting fresh.', e);
    return defaultState();
  }
}

let notifySyncDebounce = null;
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state', e);
    toast('Could not save — storage may be full');
  }
  // Mirror the slice of state the service worker needs into IndexedDB
  // (debounced — saveState() can fire on every keystroke) so background
  // notification checks have something current to read. See the
  // BACKGROUND NOTIFICATIONS section further down for why this exists.
  if (notifySyncDebounce) clearTimeout(notifySyncDebounce);
  notifySyncDebounce = setTimeout(() => { syncNotifyStateToIDB(); }, 600);
}

function getApiKey() { return localStorage.getItem(APIKEY_STORAGE_KEY) || ''; }
function getModel() { return localStorage.getItem(MODEL_STORAGE_KEY) || 'claude-sonnet-5'; }

/* ---------------- Toast ---------------- */
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------------- Generic in-app modal (replaces confirm/alert/prompt) ---------------- */
function openGenericModal({ title, bodyHtml, buttons, onOpen }) {
  document.getElementById('generic-modal-title').textContent = title;
  document.getElementById('generic-modal-body').innerHTML = bodyHtml;
  const btnWrap = document.getElementById('generic-modal-buttons');
  btnWrap.innerHTML = '';
  buttons.forEach(b => {
    const btnEl = document.createElement('button');
    btnEl.type = 'button';
    btnEl.className = 'btn ' + (b.className || 'btn-outline');
    btnEl.textContent = b.text;
    btnEl.addEventListener('click', () => { closeGenericModal(); b.onClick(); });
    btnWrap.appendChild(btnEl);
  });
  document.getElementById('generic-modal').classList.remove('hidden');
  if (onOpen) setTimeout(onOpen, 0);
}

function closeGenericModal() {
  document.getElementById('generic-modal').classList.add('hidden');
}

document.getElementById('generic-modal-close').addEventListener('click', closeGenericModal);
document.getElementById('generic-modal').addEventListener('click', (e) => {
  if (e.target.id === 'generic-modal') closeGenericModal();
});

// Drop-in, promise-based replacements for the browser's native confirm/alert/prompt.
function showConfirm(message, opts = {}) {
  return new Promise((resolve) => {
    let resolved = false;
    openGenericModal({
      title: opts.title || 'Are you sure?',
      bodyHtml: `<p class="hint" style="margin:0;">${escapeHtml(message)}</p>`,
      buttons: [
        { text: opts.cancelText || 'Cancel', className: 'btn-outline', onClick: () => { resolved = true; resolve(false); } },
        { text: opts.confirmText || 'Confirm', className: opts.danger ? 'btn-danger' : 'btn-brass', onClick: () => { resolved = true; resolve(true); } },
      ],
    });
    // Closing via the × or backdrop counts as "cancel".
    const cleanup = () => { if (!resolved) resolve(false); };
    document.getElementById('generic-modal-close').addEventListener('click', cleanup, { once: true });
  });
}

function showAlert(message, opts = {}) {
  return new Promise((resolve) => {
    openGenericModal({
      title: opts.title || 'Notice',
      bodyHtml: `<p class="hint" style="margin:0;">${escapeHtml(message)}</p>`,
      buttons: [{ text: 'OK', className: 'btn-brass', onClick: () => resolve() }],
    });
  });
}

function showPrompt(message, defaultValue = '', opts = {}) {
  return new Promise((resolve) => {
    let resolved = false;
    openGenericModal({
      title: opts.title || 'Enter a value',
      bodyHtml: `<p class="hint" style="margin:0 0 10px;">${escapeHtml(message)}</p><input type="text" id="generic-modal-input" value="${escapeHtml(defaultValue)}">`,
      buttons: [
        { text: 'Cancel', className: 'btn-outline', onClick: () => { resolved = true; resolve(null); } },
        { text: 'OK', className: 'btn-brass', onClick: () => { resolved = true; resolve((document.getElementById('generic-modal-input').value || '').trim() || null); } },
      ],
      onOpen: () => document.getElementById('generic-modal-input')?.focus(),
    });
    const cleanup = () => { if (!resolved) resolve(null); };
    document.getElementById('generic-modal-close').addEventListener('click', cleanup, { once: true });
  });
}

/* ---------------- XP / Rank ---------------- */
function addXP(amount) {
  state.xp = Math.max(0, state.xp + amount);
  saveState();
  renderDashboard();
}

function getRankInfo(xp) {
  let current = RANKS[0];
  let next = RANKS[1] || null;
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].min) {
      current = RANKS[i];
      next = RANKS[i + 1] || null;
    }
  }

  const apex = RANKS[RANKS.length - 1];
  if (!next && current === apex) {
    // Past the named ladder — keep climbing through numbered prestige
    // tiers of Apex instead of flatlining at "max rank".
    const beyond = xp - apex.min;
    const tier = Math.floor(beyond / APEX_PRESTIGE_STEP) + 1;
    const intoTier = beyond % APEX_PRESTIGE_STEP;
    current = { name: `${apex.name} ${toRoman(tier)}`, min: apex.min + (tier - 1) * APEX_PRESTIGE_STEP };
    next = { name: `${apex.name} ${toRoman(tier + 1)}`, min: apex.min + tier * APEX_PRESTIGE_STEP };
    return { current, next, progress: Math.min(1, Math.max(0, intoTier / APEX_PRESTIGE_STEP)) };
  }

  let progress = 1;
  if (next) {
    progress = (xp - current.min) / (next.min - current.min);
  }
  return { current, next, progress: Math.min(1, Math.max(0, progress)) };
}

/* ---------------- Navigation ---------------- */
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === name));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.target === name));
  if (name === 'dashboard') renderDashboard();
  if (name === 'train') renderTrain();
  if (name === 'habits') renderHabits();
  if (name === 'fuel') renderFuel();
  if (name === 'coach') renderCoach();
  if (name === 'settings') renderSettings();
  window.scrollTo(0, 0);
}

document.querySelectorAll('[data-target]').forEach(el => {
  el.addEventListener('click', () => switchView(el.dataset.target));
});
document.getElementById('settings-btn').addEventListener('click', () => switchView('settings'));

/* ================================================================
   DASHBOARD
   ================================================================ */
function renderDashboard() {
  const { current, next, progress } = getRankInfo(state.xp);
  document.getElementById('rank-name').textContent = current.name;
  document.getElementById('xp-current').textContent = state.xp;
  document.getElementById('xp-next').textContent = next
    ? `${next.min - state.xp} XP to ${next.name}`
    : 'Max rank reached';

  const circumference = 314; // approx length of the arc path used in the SVG
  const fill = document.getElementById('gauge-fill');
  fill.style.strokeDashoffset = String(circumference * (1 - progress));

  // streak: consecutive days (including today or yesterday) with a workout
  const streak = computeWorkoutStreak();
  document.getElementById('streak-count').textContent = streak;
  renderStreakHero(streak);

  const t = todayStr();
  const workoutDone = !!state.workoutDays[t];
  document.getElementById('today-workout').textContent = workoutDone ? 'Done ✓' : 'Not logged';
  setTileBar('today-workout-bar', workoutDone ? 1 : 0);

  const habitsDoneToday = Object.values(state.habitLogs[t] || {}).filter(Boolean).length;
  document.getElementById('today-habits').textContent = `${habitsDoneToday} / ${state.habits.length}`;
  setTileBar('today-habits-bar', state.habits.length ? habitsDoneToday / state.habits.length : 0);

  const todayMeals = state.nutrition.logs[t] || [];
  const cal = todayMeals.reduce((s, m) => s + m.calories, 0);
  document.getElementById('today-fuel').textContent = `${cal} / ${state.nutrition.targets.calories} kcal`;
  setTileBar('today-fuel-bar', state.nutrition.targets.calories ? cal / state.nutrition.targets.calories : 0);

  renderWeekChain();
  renderStreakRiskBanner(streak);
}

function setTileBar(id, ratio) {
  const el = document.getElementById(id);
  if (!el) return;
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  el.style.width = pct + '%';
  el.classList.toggle('complete', ratio >= 1);
}

function renderStreakHero(streak) {
  const tier = getStreakTier(streak);
  const nextMilestone = nextStreakMilestone(streak);

  const flameEl = document.getElementById('streak-hero-flame');
  flameEl.textContent = tier.emoji;
  flameEl.style.color = tier.color;
  flameEl.style.filter = streak > 0 ? `drop-shadow(0 0 ${Math.min(10 + streak, 26)}px ${tier.color}aa)` : 'none';

  const topFlameEl = document.getElementById('streak-flame');
  topFlameEl.style.filter = streak > 0 ? `drop-shadow(0 0 4px ${tier.color}aa)` : 'none';

  const tierEl = document.getElementById('streak-hero-tier');
  tierEl.textContent = tier.name;
  tierEl.style.color = tier.color;
  document.getElementById('streak-hero-count').textContent = streak;

  const fillEl = document.getElementById('streak-hero-fill');
  const span = nextMilestone ? Math.max(1, nextMilestone - tier.min) : 1;
  const into = nextMilestone ? Math.min(1, Math.max(0, (streak - tier.min) / span)) : 1;
  fillEl.style.width = (into * 100) + '%';
  fillEl.style.background = tier.color;

  const nextEl = document.getElementById('streak-hero-next');
  if (streak === 0) {
    nextEl.textContent = 'Log a workout today to light the flame';
  } else if (nextMilestone) {
    const left = nextMilestone - streak;
    nextEl.textContent = `${left} day${left === 1 ? '' : 's'} to ${getStreakTier(nextMilestone).name}`;
  } else {
    nextEl.textContent = 'Max tier reached — legendary discipline';
  }
}

function renderWeekChain() {
  const strip = document.getElementById('week-strip');
  strip.innerHTML = '';
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(dateStrDaysAgo(i));
  const todayD = todayStr();

  days.forEach((d, idx) => {
    if (idx > 0) {
      const prevDone = !!state.workoutDays[days[idx - 1]];
      const curDone = !!state.workoutDays[d];
      const link = document.createElement('div');
      link.className = 'chain-link' + (prevDone && curDone ? ' linked' : '');
      strip.appendChild(link);
    }
    const done = !!state.workoutDays[d];
    const div = document.createElement('div');
    div.className = 'week-day' + (done ? ' done' : '') + (d === todayD ? ' today' : '');
    const dayLabel = new Date(d).toLocaleDateString(undefined, { weekday: 'narrow' });
    div.textContent = done ? '🔥' : dayLabel;
    strip.appendChild(div);
  });
}

function renderStreakRiskBanner(streak) {
  const banner = document.getElementById('streak-risk-banner');
  const t = todayStr();
  const hour = new Date().getHours();
  const workoutDone = !!state.workoutDays[t];
  const habitsDoneToday = Object.values(state.habitLogs[t] || {}).filter(Boolean).length;
  const habitsAllDone = state.habits.length > 0 && habitsDoneToday >= state.habits.length;

  const atRisk = streak > 0 && hour >= 18 && (!workoutDone || !habitsAllDone);
  if (!atRisk) {
    banner.classList.add('hidden');
    return;
  }
  const missing = [];
  if (!workoutDone) missing.push('a workout');
  if (!habitsAllDone) missing.push('your habits');
  const tier = getStreakTier(streak);
  banner.textContent = `⚠ Your ${streak}-day ${tier.name} streak resets at midnight — log ${missing.join(' and ')} to keep it.`;
  banner.classList.remove('hidden');
}

function computeWorkoutStreak() {
  let streak = 0;
  let d = state.workoutDays[todayStr()] ? 0 : 1; // if today not done yet, start checking from yesterday
  while (true) {
    const dateStr = dateStrDaysAgo(d);
    if (state.workoutDays[dateStr]) {
      streak++;
      d++;
    } else {
      break;
    }
  }
  return streak;
}

function computeLongestStreak() {
  const days = Object.keys(state.workoutDays).filter(d => state.workoutDays[d]).sort();
  if (days.length === 0) return 0;
  let longest = 1, run = 1;
  for (let i = 1; i < days.length; i++) {
    const diffDays = Math.round((new Date(days[i]) - new Date(days[i - 1])) / 86400000);
    run = diffDays === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return longest;
}

function openStreakModal() {
  const current = computeWorkoutStreak();
  const longest = Math.max(current, computeLongestStreak());
  const totalWorkouts = state.history.length;
  const tier = getStreakTier(current);
  const nextMilestone = nextStreakMilestone(current);
  const span = nextMilestone ? Math.max(1, nextMilestone - tier.min) : 1;
  const into = nextMilestone ? Math.min(1, Math.max(0, (current - tier.min) / span)) : 1;

  const habitsHtml = state.habits.length
    ? state.habits.map(h => {
        const hTier = getStreakTier(h.streak);
        const flame = h.streak > 0
          ? `<span class="habit-tier-flame${STREAK_MILESTONES.includes(h.streak) ? ' tier-milestone' : ''}" style="color:${hTier.color}">${hTier.emoji}</span>`
          : `<span class="habit-tier-flame" style="color:var(--muted)">·</span>`;
        return `
        <div class="modal-row">
          <span>${flame}${escapeHtml(h.name)}</span>
          <span class="modal-row-val" style="color:${h.streak > 0 ? hTier.color : 'var(--muted)'}">${h.streak} day${h.streak === 1 ? '' : 's'}</span>
        </div>`;
      }).join('')
    : '<div class="empty-state">No habits yet.</div>';

  document.getElementById('streak-modal-body').innerHTML = `
    <div class="streak-hero" style="margin-bottom:16px;">
      <div class="streak-hero-flame" style="color:${tier.color};filter:${current > 0 ? `drop-shadow(0 0 10px ${tier.color}aa)` : 'none'}">${tier.emoji}</div>
      <div class="streak-hero-info">
        <div class="streak-hero-top">
          <span class="streak-hero-tier" style="color:${tier.color}">${tier.name}</span>
          <span class="streak-hero-days">${current} day${current === 1 ? '' : 's'}</span>
        </div>
        <div class="streak-hero-track"><div class="streak-hero-fill" style="width:${into * 100}%;background:${tier.color}"></div></div>
        <div class="streak-hero-next">${nextMilestone ? `${nextMilestone - current} day${nextMilestone - current === 1 ? '' : 's'} to ${getStreakTier(nextMilestone).name}` : 'Max tier reached — legendary discipline'}</div>
      </div>
    </div>
    <div class="modal-stat-grid">
      <div class="modal-stat"><span class="modal-stat-val">${current}</span><span class="modal-stat-label">Current streak</span></div>
      <div class="modal-stat"><span class="modal-stat-val">${longest}</span><span class="modal-stat-label">Longest streak</span></div>
      <div class="modal-stat"><span class="modal-stat-val">${totalWorkouts}</span><span class="modal-stat-label">Total sessions</span></div>
    </div>
    <div class="panel-head" style="margin-top:18px;"><h2>Habit streaks</h2></div>
    ${habitsHtml}
  `;
  document.getElementById('streak-modal').classList.remove('hidden');
}

function closeStreakModal() {
  document.getElementById('streak-modal').classList.add('hidden');
}

document.getElementById('streak-pill').addEventListener('click', openStreakModal);
document.getElementById('streak-modal-close').addEventListener('click', closeStreakModal);
document.getElementById('streak-modal').addEventListener('click', (e) => {
  if (e.target.id === 'streak-modal') closeStreakModal();
});

/* ---------------- Milestone celebration ---------------- */
function celebrateStreakMilestone(streak) {
  const tier = getStreakTier(streak);
  const bonus = 20 + streak;
  addXP(bonus);
  spawnConfetti();
  document.getElementById('milestone-body').innerHTML = `
    <div class="milestone-flame" style="color:${tier.color}">${tier.emoji}</div>
    <h2 class="milestone-title">${streak}-Day Streak!</h2>
    <p class="milestone-sub">You've reached <strong style="color:${tier.color}">${tier.name}</strong>.</p>
    <p class="milestone-xp">+${bonus} bonus XP</p>
    <button class="btn btn-brass btn-block" id="milestone-close-btn">Keep going</button>
  `;
  document.getElementById('milestone-modal').classList.remove('hidden');
  document.getElementById('milestone-close-btn').addEventListener('click', closeMilestoneModal, { once: true });
}

function closeMilestoneModal() {
  document.getElementById('milestone-modal').classList.add('hidden');
  document.getElementById('milestone-confetti').innerHTML = '';
}

function spawnConfetti() {
  const wrap = document.getElementById('milestone-confetti');
  if (!wrap) return;
  wrap.innerHTML = '';
  const colors = ['#C08A3E', '#6B8F5C', '#A8503D', '#EDE8DB'];
  for (let i = 0; i < 28; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
    piece.style.animationDelay = (Math.random() * 0.4) + 's';
    wrap.appendChild(piece);
  }
}

document.getElementById('milestone-modal').addEventListener('click', (e) => {
  if (e.target.id === 'milestone-modal') closeMilestoneModal();
});

/* ================================================================
   TRAIN
   ================================================================ */
document.getElementById('train-subnav').addEventListener('click', (e) => {
  const btn = e.target.closest('.pill');
  if (!btn) return;
  document.querySelectorAll('#train-subnav .pill').forEach(p => p.classList.toggle('active', p === btn));
  document.querySelectorAll('#view-train .subview').forEach(v => v.classList.toggle('hidden', v.dataset.sub !== btn.dataset.sub));
  if (btn.dataset.sub === 'history') renderHistory();
});

function renderTrain() {
  renderSessionTab();
  renderTemplatesTab();
  renderHistory();
}

function renderSessionTab() {
  const wrap = document.getElementById('train-session');
  wrap.innerHTML = '';

  if (state.activeSession) {
    renderActiveSession(wrap);
    return;
  }

  if (state.templates.length === 0) {
    wrap.innerHTML = '<div class="empty-state">No templates yet. Create one in the Templates tab.</div>';
    return;
  }

  const heading = document.createElement('p');
  heading.className = 'hint';
  heading.textContent = 'Pick a template to start today\'s session.';
  wrap.appendChild(heading);

  state.templates.forEach(tpl => {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.innerHTML = `
      <div class="template-card-head">
        <h3>${escapeHtml(tpl.name)}</h3>
        <button class="btn btn-brass" style="flex:none;padding:8px 14px;" data-start="${tpl.id}">Start</button>
      </div>
      <div class="hint" style="margin:0;">${tpl.exercises.length} exercises</div>
    `;
    wrap.appendChild(card);
  });

  wrap.querySelectorAll('[data-start]').forEach(btn => {
    btn.addEventListener('click', () => startSession(btn.dataset.start));
  });
}

function startSession(templateId) {
  const tpl = state.templates.find(t => t.id === templateId);
  if (!tpl) return;
  state.activeSession = {
    templateId: tpl.id,
    templateName: tpl.name,
    startedAt: new Date().toISOString(),
    exercises: tpl.exercises.map(ex => ({
      name: ex.name,
      targetSets: ex.sets,
      targetReps: ex.reps,
      // Pre-fill weight from your last PR for this exercise so most of the
      // time there's nothing to type — just tap through the sets.
      weight: state.prs[ex.name] ? String(state.prs[ex.name].weight) : '',
      sets: Array.from({ length: ex.sets }, () => ({ reps: String(ex.reps), done: false })),
    })),
  };
  saveState();
  renderSessionTab();
}

function renderActiveSession(wrap) {
  const s = state.activeSession;
  const head = document.createElement('div');
  head.className = 'panel';
  head.innerHTML = `
    <div class="panel-head">
      <h2>${escapeHtml(s.templateName)}</h2>
      <button class="link-btn danger" id="cancel-session">Cancel</button>
    </div>
    <p class="hint" style="margin:0;">Log each set as you go, then finish to save it and earn XP.</p>
  `;
  wrap.appendChild(head);
  head.querySelector('#cancel-session').addEventListener('click', async () => {
    if (await showConfirm('Cancel this session? Nothing will be saved.', { confirmText: 'Cancel session', cancelText: 'Keep going', danger: true })) {
      state.activeSession = null;
      saveState();
      renderSessionTab();
    }
  });

  s.exercises.forEach((ex, exIdx) => {
    const block = document.createElement('div');
    block.className = 'session-ex-block';
    const setsHtml = ex.sets.map((set, setIdx) => `
      <div class="set-row">
        <span class="set-num">${setIdx + 1}</span>
        <div class="reps-picker" data-ex="${exIdx}" data-set="${setIdx}">
          <button type="button" class="reps-arrow" data-reps-step="-1" aria-label="Decrease reps">‹</button>
          <span class="reps-picker-value" data-reps-value tabindex="0" role="spinbutton"
                aria-label="Reps for set ${setIdx + 1}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${set.reps}">${set.reps}</span>
          <button type="button" class="reps-arrow" data-reps-step="1" aria-label="Increase reps">›</button>
        </div>
        <span class="set-unit">reps</span>
        <button class="set-done-btn ${set.done ? 'done' : ''}" data-ex="${exIdx}" data-set="${setIdx}" data-done-toggle>✓</button>
      </div>
    `).join('');
    block.innerHTML = `
      <div class="session-ex-head">
        <h3>${escapeHtml(ex.name)}</h3>
        <button class="rest-btn" data-rest>Rest 90s</button>
      </div>
      <div class="weight-row">
        <label>Weight (kg)</label>
        <input type="number" inputmode="decimal" placeholder="kg" value="${ex.weight}" data-ex="${exIdx}" data-field="weight" class="weight-input">
      </div>
      <div class="set-header">
        <span class="set-header-spacer"></span>
        <span class="set-header-label">Reps (swipe to set)</span>
        <span class="set-header-spacer"></span>
      </div>
      ${setsHtml}
    `;
    wrap.appendChild(block);

    block.querySelector('.weight-input').addEventListener('input', (e) => {
      state.activeSession.exercises[exIdx].weight = e.target.value;
      saveState();
    });
    block.querySelectorAll('.reps-picker').forEach(picker => {
      wireRepsPicker(picker, exIdx, +picker.dataset.set);
    });
    block.querySelectorAll('[data-done-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const si = +btn.dataset.set;
        const set = state.activeSession.exercises[exIdx].sets[si];
        set.done = !set.done;
        saveState();
        btn.classList.toggle('done', set.done);
        // One tap logs the set AND starts your rest — no separate reminder needed.
        if (set.done) startRestTimer(block.querySelector('[data-rest]'));
      });
    });
    block.querySelector('[data-rest]').addEventListener('click', (e) => startRestTimer(e.target));
  });

  const finishBtn = document.createElement('button');
  finishBtn.className = 'btn btn-brass btn-block';
  finishBtn.textContent = 'Finish session';
  finishBtn.addEventListener('click', finishSession);
  wrap.appendChild(finishBtn);
}

// Swipe-to-scrub reps picker: tap the arrows to step by 1, or drag
// left/right across the number to scrub through the 0–100 range fast.
// A tap on the number itself (no real drag) opens exact entry instead,
// for when you want a precise value without hunting for it by feel.
const REPS_PICKER_PX_PER_STEP = 10; // drag distance (px) per rep changed
const REPS_PICKER_MAX = 100;

function wireRepsPicker(pickerEl, exIdx, setIdx) {
  const valueEl = pickerEl.querySelector('[data-reps-value]');

  const getReps = () => Number(state.activeSession.exercises[exIdx].sets[setIdx].reps) || 0;
  const setReps = (v) => {
    const clamped = Math.max(0, Math.min(REPS_PICKER_MAX, Math.round(v)));
    state.activeSession.exercises[exIdx].sets[setIdx].reps = String(clamped);
    valueEl.textContent = clamped;
    valueEl.setAttribute('aria-valuenow', clamped);
    saveState();
    return clamped;
  };

  pickerEl.querySelectorAll('[data-reps-step]').forEach(btn => {
    btn.addEventListener('click', () => setReps(getReps() + Number(btn.dataset.repsStep)));
  });

  let dragging = false;
  let moved = false;
  let startX = 0;
  let startVal = 0;

  valueEl.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = false;
    startX = e.clientX;
    startVal = getReps();
    valueEl.classList.add('dragging');
    try { valueEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });

  valueEl.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    setReps(startVal + dx / REPS_PICKER_PX_PER_STEP);
  });

  const endDrag = async (e) => {
    if (!dragging) return;
    dragging = false;
    valueEl.classList.remove('dragging');
    if (!moved) {
      // A plain tap (no drag) — offer exact entry for precision.
      const typed = await showPrompt(`Set exact reps (0–${REPS_PICKER_MAX})`, String(getReps()));
      if (typed !== null && typed.trim() !== '' && !Number.isNaN(Number(typed))) {
        setReps(Number(typed));
      }
    }
  };
  valueEl.addEventListener('pointerup', endDrag);
  valueEl.addEventListener('pointercancel', endDrag);

  // Keyboard support for focus + arrow keys (accessibility, and desktop use).
  valueEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setReps(getReps() + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setReps(getReps() - 1); }
  });
}

function startRestTimer(btn) {
  let secs = 90;
  btn.dataset.original = btn.dataset.original || btn.textContent;
  if (btn._interval) { clearInterval(btn._interval); }
  btn.textContent = `${secs}s`;
  btn._interval = setInterval(() => {
    secs--;
    if (secs <= 0) {
      clearInterval(btn._interval);
      btn.textContent = btn.dataset.original;
      toast('Rest over');
    } else {
      btn.textContent = `${secs}s`;
    }
  }, 1000);
}

async function finishSession() {
  const s = state.activeSession;
  const alreadyLoggedToday = !!state.workoutDays[todayStr()];
  const wasIncompleteBefore = todayIsIncomplete();
  let totalVolume = 0;
  let newPRs = [];
  const historyExercises = [];

  s.exercises.forEach(ex => {
    const w = Number(ex.weight);
    const loggedSets = ex.sets.filter(set => set.done && w > 0 && Number(set.reps) > 0);
    loggedSets.forEach(set => {
      const r = Number(set.reps);
      totalVolume += w * r;
      const currentPR = state.prs[ex.name];
      if (!currentPR || w > currentPR.weight) {
        state.prs[ex.name] = { weight: w, reps: r, date: todayStr() };
        if (!newPRs.includes(ex.name)) newPRs.push(ex.name);
      }
    });
    historyExercises.push({ name: ex.name, sets: loggedSets.map(x => ({ weight: w, reps: Number(x.reps) })) });
  });

  const totalSetsLogged = historyExercises.reduce((n, e) => n + e.sets.length, 0);
  if (totalSetsLogged === 0) {
    if (!(await showConfirm('No sets were logged. Finish anyway without saving to history?', { confirmText: 'Finish anyway', cancelText: 'Keep logging' }))) return;
    state.activeSession = null;
    saveState();
    renderSessionTab();
    return;
  }

  const xpEarned = 30 + s.exercises.length * 5 + newPRs.length * 10;

  state.history.unshift({
    id: uid(),
    date: todayStr(),
    templateName: s.templateName,
    totalVolume,
    exercises: historyExercises,
    xpEarned,
    newPRs,
  });

  state.workoutDays[todayStr()] = true;
  state.activeSession = null;
  saveState();
  addXP(xpEarned);

  let msg = newPRs.length ? `Session saved — ${newPRs.length} new PR!` : 'Session saved';
  if (wasIncompleteBefore && !todayIsIncomplete()) msg += ' · 🔥 day complete';
  toast(msg);
  renderSessionTab();
  renderHistory();

  if (!alreadyLoggedToday) {
    const newStreak = computeWorkoutStreak();
    if (STREAK_MILESTONES.includes(newStreak)) celebrateStreakMilestone(newStreak);
  }
}

/* --- Templates management --- */
function renderTemplatesTab() {
  const list = document.getElementById('templates-list');
  list.innerHTML = '';
  if (state.templates.length === 0) {
    list.innerHTML = '<div class="empty-state">No templates yet.</div>';
    return;
  }
  state.templates.forEach(tpl => {
    const card = document.createElement('div');
    card.className = 'template-card';
    const exercisesHtml = tpl.exercises.map(ex => `
      <div class="exercise-row">
        <span class="ex-name">${escapeHtml(ex.name)}</span>
        <span class="ex-target">${ex.sets} × ${ex.reps}</span>
      </div>
    `).join('');
    card.innerHTML = `
      <div class="template-card-head">
        <h3>${escapeHtml(tpl.name)}</h3>
        <div class="row-actions">
          <button class="link-btn" data-show-add-ex="${tpl.id}">+ exercise</button>
          <button class="link-btn danger" data-del-tpl="${tpl.id}">delete</button>
        </div>
      </div>
      ${exercisesHtml || '<div class="hint" style="margin:0;">No exercises yet.</div>'}
      <form class="add-ex-form hidden" data-add-ex-form="${tpl.id}">
        <input type="text" placeholder="Exercise name" data-f="name" required>
        <input type="number" placeholder="Sets" value="3" min="1" data-f="sets" required>
        <input type="number" placeholder="Reps" value="10" min="1" data-f="reps" required>
        <button type="submit" class="btn btn-brass" style="flex:none;">Add</button>
      </form>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('[data-show-add-ex]').forEach(btn => {
    btn.addEventListener('click', () => {
      const form = list.querySelector(`[data-add-ex-form="${btn.dataset.showAddEx}"]`);
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) form.querySelector('input').focus();
    });
  });
  list.querySelectorAll('[data-add-ex-form]').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const tpl = state.templates.find(t => t.id === form.dataset.addExForm);
      const name = form.querySelector('[data-f="name"]').value.trim();
      const sets = Number(form.querySelector('[data-f="sets"]').value) || 3;
      const reps = Number(form.querySelector('[data-f="reps"]').value) || 10;
      if (!name) return;
      tpl.exercises.push({ id: uid(), name, sets, reps });
      saveState();
      renderTemplatesTab();
    });
  });
  list.querySelectorAll('[data-del-tpl]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!(await showConfirm('Delete this template? This can\'t be undone.', { confirmText: 'Delete', danger: true }))) return;
      state.templates = state.templates.filter(t => t.id !== btn.dataset.delTpl);
      saveState();
      renderTemplatesTab();
    });
  });
}

document.getElementById('add-template-btn').addEventListener('click', async () => {
  const name = await showPrompt('Name this template (e.g. "Upper Body")');
  if (!name) return;
  state.templates.push({ id: uid(), name, exercises: [] });
  saveState();
  renderTemplatesTab();
});

/* --- History / PRs --- */
function renderHistory() {
  const prList = document.getElementById('pr-list');
  const prEntries = Object.entries(state.prs);
  prList.innerHTML = prEntries.length
    ? prEntries.map(([name, pr]) => `
        <div class="pr-row">
          <span>${escapeHtml(name)}</span>
          <span class="pr-val">${pr.weight}kg × ${pr.reps}</span>
        </div>`).join('')
    : '<div class="empty-state">No personal records yet.</div>';

  const historyList = document.getElementById('history-list');
  historyList.innerHTML = state.history.length
    ? state.history.map(h => `
        <div class="history-row">
          <div class="history-row-head">
            <span class="name">${escapeHtml(h.templateName)}</span>
            <span>+${h.xpEarned} XP</span>
          </div>
          <div class="history-row-sub">${h.date} · ${h.totalVolume.toLocaleString()}kg total volume${h.newPRs.length ? ' · ' + h.newPRs.length + ' PR' : ''}</div>
        </div>`).join('')
    : '<div class="empty-state">No sessions logged yet.</div>';
}

/* ================================================================
   HABITS
   ================================================================ */
function renderHabits() {
  const t = todayStr();
  const todayLog = state.habitLogs[t] || {};
  const list = document.getElementById('habits-list');
  list.innerHTML = '';

  state.habits.forEach(h => {
    const done = !!todayLog[h.id];
    const tier = getStreakTier(h.streak);
    const flame = h.streak > 0
      ? `<span class="habit-tier-flame${STREAK_MILESTONES.includes(h.streak) ? ' tier-milestone' : ''}" style="color:${tier.color}">${tier.emoji}</span>`
      : `<span class="habit-tier-flame" style="color:var(--muted)">·</span>`;
    const row = document.createElement('div');
    row.className = 'habit-row';
    row.innerHTML = `
      <button class="habit-check ${done ? 'done' : ''}" data-toggle="${h.id}">✓</button>
      <div class="habit-info">
        <span class="habit-name" contenteditable="true" data-rename="${h.id}">${escapeHtml(h.name)}</span>
        <span class="habit-streak">${flame}${h.streak} day${h.streak === 1 ? '' : 's'} streak${h.streak > 0 ? ' · ' + tier.name : ''}</span>
      </div>
      <button class="habit-remove" data-remove="${h.id}">×</button>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => toggleHabit(btn.dataset.toggle));
  });
  list.querySelectorAll('[data-rename]').forEach(span => {
    span.addEventListener('blur', () => {
      const h = state.habits.find(x => x.id === span.dataset.rename);
      if (h && span.textContent.trim()) {
        h.name = span.textContent.trim();
        saveState();
      }
    });
  });
  list.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!(await showConfirm('Remove this habit? Its streak history goes with it.', { confirmText: 'Remove', danger: true }))) return;
      state.habits = state.habits.filter(h => h.id !== btn.dataset.remove);
      saveState();
      renderHabits();
    });
  });

  const doneCount = Object.values(todayLog).filter(Boolean).length;
  document.getElementById('habits-today-count').textContent = `${doneCount} / ${state.habits.length} done`;
}

function toggleHabit(id) {
  const t = todayStr();
  if (!state.habitLogs[t]) state.habitLogs[t] = {};
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;

  const wasIncompleteBefore = todayIsIncomplete();
  const wasDone = !!state.habitLogs[t][id];
  const nowDone = !wasDone;
  state.habitLogs[t][id] = nowDone;

  if (nowDone) {
    const yesterday = dateStrDaysAgo(1);
    habit.streak = (habit.lastDate === yesterday) ? habit.streak + 1 : 1;
    habit.lastDate = t;
    addXP(10);
    if (wasIncompleteBefore && !todayIsIncomplete()) toast('🔥 All done for today — streak secured');
  } else {
    // undo today's check
    habit.streak = Math.max(0, habit.streak - 1);
    habit.lastDate = habit.streak > 0 ? dateStrDaysAgo(1) : null;
    addXP(-10);
  }

  saveState();
  renderHabits();
}

document.getElementById('add-habit-btn').addEventListener('click', async () => {
  const name = await showPrompt('Name your new habit');
  if (!name) return;
  state.habits.push({ id: uid(), name, streak: 0, lastDate: null });
  saveState();
  renderHabits();
});

/* ================================================================
   FUEL (nutrition)
   ================================================================ */
function renderFuel() {
  const t = todayStr();
  const meals = state.nutrition.logs[t] || [];
  const targets = state.nutrition.targets;
  const totals = meals.reduce((acc, m) => {
    acc.calories += m.calories; acc.protein += m.protein; acc.carbs += m.carbs; acc.fat += m.fat;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const bars = document.getElementById('macro-bars');
  const rows = [
    ['Calories', totals.calories, targets.calories, 'kcal'],
    ['Protein', totals.protein, targets.protein, 'g'],
    ['Carbs', totals.carbs, targets.carbs, 'g'],
    ['Fat', totals.fat, targets.fat, 'g'],
  ];
  bars.innerHTML = rows.map(([label, val, target, unit]) => {
    const pct = target > 0 ? Math.min(100, (val / target) * 100) : 0;
    const over = val > target;
    return `
      <div class="macro-bar-row">
        <div class="macro-bar-label">
          <span class="name">${label}</span>
          <span>${val} / ${target}${unit}</span>
        </div>
        <div class="macro-bar-track"><div class="macro-bar-fill ${over ? 'over' : ''}" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');

  const chips = document.getElementById('quick-food-chips');
  chips.innerHTML = QUICK_FOODS.map((f, i) => `<button class="food-chip" data-quick="${i}">${escapeHtml(f.name)}</button>`).join('');
  chips.querySelectorAll('[data-quick]').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = QUICK_FOODS[+btn.dataset.quick];
      logMeal(f);
    });
  });

  const logList = document.getElementById('meal-log-list');
  logList.innerHTML = meals.length
    ? meals.map(m => `
        <div class="meal-row">
          <div>
            <div class="meal-name">${escapeHtml(m.name)}</div>
            <div class="meal-macros">${m.calories}kcal · P${m.protein} C${m.carbs} F${m.fat}</div>
          </div>
          <button class="meal-remove" data-remove-meal="${m.id}">×</button>
        </div>`).join('')
    : '<div class="empty-state">Nothing logged yet today.</div>';

  logList.querySelectorAll('[data-remove-meal]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.nutrition.logs[t] = (state.nutrition.logs[t] || []).filter(m => m.id !== btn.dataset.removeMeal);
      saveState();
      renderFuel();
    });
  });

  document.getElementById('ai-estimate-panel').classList.toggle('hidden', getAiMode() === 'cloud' && !getApiKey());
}

function logMeal(food) {
  const t = todayStr();
  if (!state.nutrition.logs[t]) state.nutrition.logs[t] = [];
  state.nutrition.logs[t].push({
    id: uid(),
    name: food.name,
    calories: Number(food.calories) || 0,
    protein: Number(food.protein) || 0,
    carbs: Number(food.carbs) || 0,
    fat: Number(food.fat) || 0,
  });
  saveState();
  addXP(5);
  toast(`Logged ${food.name}`);
  renderFuel();
}

document.getElementById('manual-food-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const food = {
    name: document.getElementById('mf-name').value.trim() || 'Meal',
    calories: document.getElementById('mf-cal').value,
    protein: document.getElementById('mf-protein').value,
    carbs: document.getElementById('mf-carbs').value,
    fat: document.getElementById('mf-fat').value,
  };
  logMeal(food);
  e.target.reset();
});

document.getElementById('ai-estimate-btn').addEventListener('click', async () => {
  const desc = document.getElementById('ai-food-desc').value.trim();
  const statusEl = document.getElementById('ai-estimate-status');
  if (!desc) { statusEl.textContent = 'Describe what you ate first.'; return; }
  if (getAiMode() === 'cloud' && !getApiKey()) { statusEl.textContent = 'Add an API key in Settings first.'; return; }

  statusEl.textContent = getAiMode() === 'local' ? 'Estimating… (loading the model the first time can take a while)' : 'Estimating…';
  try {
    const result = await getMacroEstimate(desc);
    document.getElementById('mf-name').value = result.name || desc;
    document.getElementById('mf-cal').value = Math.round(result.calories || 0);
    document.getElementById('mf-protein').value = Math.round(result.protein || 0);
    document.getElementById('mf-carbs').value = Math.round(result.carbs || 0);
    document.getElementById('mf-fat').value = Math.round(result.fat || 0);
    statusEl.textContent = 'Estimated — review the numbers below, then add.';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Could not estimate: ' + friendlyAiError(err);
  }
});

/* ================================================================
   COACH
   ================================================================ */
let coachHistory = []; // in-memory only, resets on refresh

function renderCoach() {
  const mode = getAiMode();
  const ready = mode === 'local' || !!getApiKey();
  const emptyEl = document.getElementById('coach-empty');
  emptyEl.querySelector('p').textContent = mode === 'cloud'
    ? 'Add your own Anthropic API key in Settings to turn on the AI coach. It runs straight from your browser to Anthropic\'s API — nothing passes through a third-party server, and the key never leaves your device.'
    : 'Switch on the free on-device coach in Settings — it downloads a small model straight to this browser, no key or account needed.';
  emptyEl.classList.toggle('hidden', ready);
  document.getElementById('coach-chat-wrap').classList.toggle('hidden', !ready);
  if (ready) renderCoachLog();
}

function renderCoachLog() {
  const log = document.getElementById('coach-log');
  log.innerHTML = coachHistory.map(m =>
    `<div class="msg ${m.role === 'user' ? 'user' : 'coach'}">${escapeHtml(m.content)}</div>`
  ).join('') || '<div class="msg system">Ask about training, nutrition or how to stay consistent. Your coach can see today\'s stats.</div>';
  log.scrollTop = log.scrollHeight;
}

document.getElementById('coach-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('coach-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  coachHistory.push({ role: 'user', content: text });
  renderCoachLog();

  const thinkingId = 'thinking-' + uid();
  const log = document.getElementById('coach-log');
  const loadingMsg = getAiMode() === 'local' ? 'Thinking… (first message loads the model, can take a while)' : '…';
  log.insertAdjacentHTML('beforeend', `<div class="msg coach" id="${thinkingId}">${escapeHtml(loadingMsg)}</div>`);
  log.scrollTop = log.scrollHeight;

  try {
    const bubble = document.getElementById(thinkingId);
    const reply = await getCoachReply(coachHistory, (partial) => {
      if (bubble) { bubble.textContent = partial || loadingMsg; log.scrollTop = log.scrollHeight; }
    });
    coachHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    console.error(err);
    coachHistory.push({ role: 'assistant', content: 'Something went wrong: ' + friendlyAiError(err) });
  }
  document.getElementById(thinkingId)?.remove();
  renderCoachLog();
});

function buildCoachSystemPrompt() {
  const t = todayStr();
  const { current } = getRankInfo(state.xp);
  const habitsDone = Object.values(state.habitLogs[t] || {}).filter(Boolean).length;
  const meals = state.nutrition.logs[t] || [];
  const cal = meals.reduce((s, m) => s + m.calories, 0);
  const protein = meals.reduce((s, m) => s + m.protein, 0);
  const lastSession = state.history[0];

  return `You are a blunt, encouraging personal training coach inside a personal fitness app called IronLog. `
    + `Keep replies short and practical (a few sentences, not an essay) unless asked for detail. `
    + `Current stats for the user today: rank ${current.name}, ${state.xp} total XP, ${habitsDone}/${state.habits.length} habits done today, `
    + `${cal}/${state.nutrition.targets.calories} kcal and ${protein}/${state.nutrition.targets.protein}g protein logged today. `
    + (lastSession ? `Last workout: ${lastSession.templateName} on ${lastSession.date}. ` : 'No workouts logged yet. ')
    + `You are not a doctor — for medical concerns, tell the user to see one.`;
}

/* ---------------- Claude API calls (bring-your-own-key, direct from browser) ---------------- */
async function callClaudeRaw(system, messages) {
  const apiKey = getApiKey();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: getModel(),
      max_tokens: 1024,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`API error ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await res.json();
  const textBlock = (data.content || []).find(c => c.type === 'text');
  return textBlock ? textBlock.text : '';
}

async function callClaudeChat(history) {
  const system = buildCoachSystemPrompt();
  const messages = history.map(m => ({ role: m.role, content: m.content }));
  return callClaudeRaw(system, messages);
}

async function callClaudeJSON(system, userText) {
  const raw = await callClaudeRaw(system, [{ role: 'user', content: userText }]);
  const cleaned = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

/* ---------------- Local AI (WebLLM, free, on-device) ---------------- */
const AI_MODE_KEY = 'ironlog_ai_mode';
const LOCAL_MODEL_KEY = 'ironlog_local_model_id';
const DEFAULT_LOCAL_MODELS = [
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Small & fast (~0.9GB download)' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Balanced (~2.2GB download)' },
  { id: 'Llama-3-8B-Instruct-q4f32_1-MLC', label: 'Best quality (~6GB, needs a strong GPU)' },
];

function getAiMode() { return localStorage.getItem(AI_MODE_KEY) || 'local'; }
function setAiMode(mode) { localStorage.setItem(AI_MODE_KEY, mode); }
function getLocalModelId() { return localStorage.getItem(LOCAL_MODEL_KEY) || DEFAULT_LOCAL_MODELS[0].id; }
function hasWebGPU() { return 'gpu' in navigator; }

// Most prebuilt WebLLM models need a GPU/driver/browser combo that supports
// at least 32KB of compute workgroup storage. Below that, model loading
// fails with a cryptic native error — so we check ahead of time and explain
// it in plain terms instead of just surfacing that error.
const NEEDED_WORKGROUP_STORAGE = 32768;

async function checkGpuCapability() {
  if (!hasWebGPU()) return { ok: false, reason: 'unsupported' };
  let adapter;
  try {
    adapter = await navigator.gpu.requestAdapter();
  } catch (e) {
    return { ok: false, reason: 'no-adapter', error: e };
  }
  if (!adapter) return { ok: false, reason: 'no-adapter' };
  const storage = adapter.limits.maxComputeWorkgroupStorageSize;
  if (storage < NEEDED_WORKGROUP_STORAGE) return { ok: false, reason: 'low-limits', storage };
  // Finding an adapter isn't enough — actually creating a device is where
  // "adapter exists but the browser/OS/driver can't really use it" shows up.
  try {
    const device = await adapter.requestDevice();
    device.destroy?.();
  } catch (e) {
    return { ok: false, reason: 'device-failed', error: e };
  }
  return { ok: true, storage };
}

function gpuCapabilityMessage(check) {
  switch (check.reason) {
    case 'unsupported':
      return 'This browser has no WebGPU API at all, so local AI will automatically use a slower CPU model instead. Chrome or Edge (desktop or Android) support WebGPU and would run it faster.';
    case 'no-adapter':
    case 'device-failed':
      return 'Your browser can\'t get a working GPU device here (often hardware acceleration being off, outdated GPU drivers, or a laptop routing the browser to the wrong GPU — chrome://gpu can confirm), so local AI will automatically use a slower CPU model instead. Fixing the GPU access would make it noticeably faster.';
    case 'low-limits':
      return `This device's GPU/browser only supports ${check.storage} of the compute memory most GPU models need (they typically need ${NEEDED_WORKGROUP_STORAGE}), so local AI will automatically use a slower CPU model instead. Updating GPU drivers or trying Chrome/Edge can sometimes unlock the faster GPU path.`;
    default:
      return 'Could not check WebGPU support on this device — local AI will fall back to a CPU model automatically if the GPU path doesn\'t work.';
  }
}

// Turns the native, technical errors WebLLM/WebGPU throw into something a
// person can actually act on.
function friendlyAiError(err) {
  const msg = String((err && err.message) || err);
  if (/maxComputeWorkgroupStorageSize|exceeds limit/i.test(msg)) {
    return 'This device\'s GPU/browser doesn\'t support enough compute memory to run this model — a hardware/driver limit, not something this app can override. Try Chrome or Edge, update your GPU drivers, try a smaller model, or switch to Cloud mode in Settings.';
  }
  if (/unable to find a compatible gpu|no.{0,10}adapter/i.test(msg)) {
    return 'No working GPU device was found. In Chrome/Edge, check chrome://gpu for a diagnosis — this is usually hardware acceleration being off, outdated drivers, or a laptop with no WebGPU-capable GPU exposed to the browser. Cloud mode in Settings works regardless of GPU.';
  }
  if (/webgpu/i.test(msg)) {
    return 'This browser doesn\'t support WebGPU, which local AI needs. Try Chrome or Edge, or switch to Cloud mode in Settings.';
  }
  if (/out of memory|oom/i.test(msg)) {
    return 'Ran out of memory loading this model. Try a smaller model, close other tabs/apps, or switch to Cloud mode.';
  }
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Could not download the model — check your internet connection and try again. Local AI (GPU or CPU) needs to download the model at least once; Cloud mode needs a much smaller connection since it doesn\'t download anything.';
  }
  return msg;
}

let webllmLib = null;
let localEngine = null;
let localEngineModelId = null;
let modelOptionsPopulated = false;

async function loadWebLLMLib() {
  if (!webllmLib) webllmLib = await import('https://esm.run/@mlc-ai/web-llm');
  return webllmLib;
}

async function populateLocalModelOptions() {
  if (modelOptionsPopulated) return;
  modelOptionsPopulated = true;
  const select = document.getElementById('local-model-select');
  select.innerHTML = DEFAULT_LOCAL_MODELS.map(m => `<option value="${m.id}">${m.label}</option>`).join('');
  select.value = getLocalModelId();
  try {
    const webllm = await loadWebLLMLib();
    const known = new Set(DEFAULT_LOCAL_MODELS.map(m => m.id));
    const extra = (webllm.prebuiltAppConfig?.model_list || [])
      .map(m => m.model_id)
      .filter(id => id && !known.has(id));
    if (extra.length) {
      const group = document.createElement('optgroup');
      group.label = 'More models';
      extra.forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = id;
        group.appendChild(opt);
      });
      select.appendChild(group);
      select.value = getLocalModelId();
    }
  } catch (e) {
    console.warn('Could not fetch the full local model list (offline?)', e);
  }
}

async function ensureLocalEngine(onProgress) {
  if (!hasWebGPU()) throw new Error('This browser doesn\'t support WebGPU — try Chrome or Edge, or switch to Cloud mode.');
  const modelId = getLocalModelId();
  if (localEngine && localEngineModelId === modelId) return localEngine;
  const webllm = await loadWebLLMLib();
  if (localEngine) {
    try { await localEngine.unload(); } catch (e) { /* ignore */ }
    localEngine = null;
  }
  localEngine = await webllm.CreateMLCEngine(modelId, { initProgressCallback: onProgress });
  localEngineModelId = modelId;
  return localEngine;
}

async function unloadLocalEngineNow() {
  if (localEngine) {
    try { await localEngine.unload(); } catch (e) { /* ignore */ }
  }
  localEngine = null;
  localEngineModelId = null;
  cpuGenerator = null; // just drop the reference; the runtime frees it on GC
}

/* ---------------- CPU/WASM fallback (transformers.js) ----------------
   WebLLM needs WebGPU, which plenty of laptops either don't expose to the
   browser or don't support well enough (see checkGpuCapability above).
   transformers.js runs on the CPU via WASM by default — no GPU required
   at all — so when the GPU path fails, we fall back to it automatically
   instead of just telling the person to switch to Cloud mode. It's slower
   and the model is smaller/weaker, but it works on essentially any device. */
const CPU_FALLBACK_MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';

let transformersLib = null;
let cpuGenerator = null;

async function loadTransformersLib() {
  if (!transformersLib) transformersLib = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4');
  return transformersLib;
}

async function ensureCpuFallbackEngine(onProgress) {
  if (cpuGenerator) return cpuGenerator;
  const { pipeline } = await loadTransformersLib();
  cpuGenerator = await pipeline('text-generation', CPU_FALLBACK_MODEL, {
    dtype: 'q4',
    progress_callback: onProgress,
  });
  return cpuGenerator;
}

function extractGeneratedText(output) {
  const generated = output?.[0]?.generated_text;
  if (Array.isArray(generated)) return generated[generated.length - 1]?.content || '';
  return String(generated || '');
}

async function callCpuChat(history, onToken) {
  const generator = await ensureCpuFallbackEngine();
  if (onToken) onToken('Thinking on CPU — this is noticeably slower than GPU or Cloud…');
  const messages = [
    { role: 'system', content: buildCoachSystemPrompt() },
    ...history.map(m => ({ role: m.role, content: m.content })),
  ];
  const output = await generator(messages, { max_new_tokens: 300 });
  return extractGeneratedText(output).trim();
}

async function callCpuJSON(system, userText) {
  const generator = await ensureCpuFallbackEngine();
  const output = await generator([
    { role: 'system', content: system },
    { role: 'user', content: userText },
  ], { max_new_tokens: 200 });
  const raw = extractGeneratedText(output);
  const cleaned = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

// Tries the GPU engine first; if that fails for any GPU-shaped reason,
// silently drops to the CPU model instead of surfacing the error.
async function ensureLocalOrFallback(onProgress) {
  try {
    const engine = await ensureLocalEngine(onProgress);
    return { engine, backend: 'gpu' };
  } catch (gpuErr) {
    console.warn('GPU local AI failed, falling back to CPU:', gpuErr);
    if (onProgress) onProgress({ progress: 0, text: 'No usable GPU — switching to a CPU model (slower, first download can take a while)…' });
    const generator = await ensureCpuFallbackEngine((p) => {
      if (!onProgress) return;
      const pct = typeof p?.progress === 'number' ? p.progress / 100 : undefined;
      onProgress({ progress: pct, text: [p?.status, p?.file].filter(Boolean).join(' ') || 'Downloading CPU model…' });
    });
    return { engine: generator, backend: 'cpu' };
  }
}

async function callLocalChat(history, onToken) {
  try {
    const engine = await ensureLocalEngine();
    const messages = [
      { role: 'system', content: buildCoachSystemPrompt() },
      ...history.map(m => ({ role: m.role, content: m.content })),
    ];
    const stream = await engine.chat.completions.create({ messages, stream: true });
    let full = '';
    for await (const chunk of stream) {
      full += chunk.choices?.[0]?.delta?.content || '';
      if (onToken) onToken(full);
    }
    return full;
  } catch (gpuErr) {
    console.warn('GPU coach reply failed, falling back to CPU:', gpuErr);
    return callCpuChat(history, onToken);
  }
}

async function callLocalJSON(system, userText) {
  try {
    const engine = await ensureLocalEngine();
    const res = await engine.chat.completions.create({
      messages: [{ role: 'system', content: system }, { role: 'user', content: userText }],
    });
    const raw = res.choices[0].message.content;
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (gpuErr) {
    console.warn('GPU macro estimate failed, falling back to CPU:', gpuErr);
    return callCpuJSON(system, userText);
  }
}

const MACRO_SYSTEM_PROMPT = 'You are a nutrition estimator. Given a short description of a meal (possibly in Hinglish, and possibly Indian food), reply with ONLY a JSON object — no prose, no markdown fences — in this exact shape: {"name": string, "calories": number, "protein": number, "carbs": number, "fat": number}. Give a single best estimate for the whole meal as described.';

async function getCoachReply(history, onToken) {
  if (getAiMode() === 'local') return callLocalChat(history, onToken);
  return callClaudeChat(history);
}

async function getMacroEstimate(desc) {
  if (getAiMode() === 'local') return callLocalJSON(MACRO_SYSTEM_PROMPT, desc);
  return callClaudeJSON(MACRO_SYSTEM_PROMPT, desc);
}

/* ================================================================
   SETTINGS
   ================================================================ */
function renderSettings() {
  renderAiModeUI();
  populateLocalModelOptions();
  const webgpuWarningEl = document.getElementById('webgpu-warning');
  webgpuWarningEl.textContent = 'Checking this device\'s GPU support…';
  checkGpuCapability().then((check) => {
    webgpuWarningEl.textContent = check.ok ? '' : gpuCapabilityMessage(check);
  });

  document.getElementById('api-key-input').value = getApiKey();
  document.getElementById('model-input').value = getModel();
  document.getElementById('key-status').textContent = getApiKey() ? 'A key is saved on this device.' : 'No key saved.';

  const targets = state.nutrition.targets;
  document.getElementById('target-cal').value = targets.calories;
  document.getElementById('target-protein').value = targets.protein;
  document.getElementById('target-carbs').value = targets.carbs;
  document.getElementById('target-fat').value = targets.fat;

  document.getElementById('reminder-time-input').value = getReminderTime();
  renderReminderStatus();

  document.getElementById('habit-nudge-time1').value = getHabitNudgeTime1();
  document.getElementById('habit-nudge-time2').value = getHabitNudgeTime2();
  renderHabitNudgeStatus();
}

function renderAiModeUI() {
  const mode = getAiMode();
  document.querySelectorAll('#ai-mode-nav .pill').forEach(p => p.classList.toggle('active', p.dataset.aiMode === mode));
  document.getElementById('ai-local-panel').classList.toggle('hidden', mode !== 'local');
  document.getElementById('ai-cloud-panel').classList.toggle('hidden', mode !== 'cloud');
}

document.getElementById('ai-mode-nav').addEventListener('click', (e) => {
  const btn = e.target.closest('.pill');
  if (!btn) return;
  setAiMode(btn.dataset.aiMode);
  renderAiModeUI();
});

document.getElementById('local-model-select').addEventListener('change', (e) => {
  localStorage.setItem(LOCAL_MODEL_KEY, e.target.value);
  document.getElementById('local-model-status').textContent = 'Model changed — click "Load model" to download and switch to it.';
});

document.getElementById('load-local-model-btn').addEventListener('click', async () => {
  const statusEl = document.getElementById('local-model-status');
  const wrap = document.getElementById('local-model-progress-wrap');
  const fill = document.getElementById('local-model-progress-fill');
  wrap.classList.remove('hidden');
  fill.style.width = '0%';
  statusEl.textContent = 'Starting…';
  try {
    const { backend } = await ensureLocalOrFallback((p) => {
      if (typeof p.progress === 'number') fill.style.width = Math.round(p.progress * 100) + '%';
      statusEl.textContent = p.text || 'Loading…';
    });
    statusEl.textContent = backend === 'gpu'
      ? 'Ready — running on your GPU, loaded and cached on this device.'
      : 'Ready — running on CPU (no usable GPU found here, so responses will be noticeably slower).';
    toast('Local model ready');
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Could not load: ' + friendlyAiError(err);
  }
});

document.getElementById('unload-local-model-btn').addEventListener('click', async () => {
  await unloadLocalEngineNow();
  document.getElementById('local-model-progress-wrap').classList.add('hidden');
  document.getElementById('local-model-status').textContent = 'Unloaded.';
  toast('Local model unloaded');
});

document.getElementById('save-key-btn').addEventListener('click', () => {
  const key = document.getElementById('api-key-input').value.trim();
  const model = document.getElementById('model-input').value.trim() || 'claude-sonnet-5';
  if (key) localStorage.setItem(APIKEY_STORAGE_KEY, key);
  else localStorage.removeItem(APIKEY_STORAGE_KEY);
  localStorage.setItem(MODEL_STORAGE_KEY, model);
  toast('Saved');
  renderSettings();
});

document.getElementById('save-targets-btn').addEventListener('click', () => {
  state.nutrition.targets = {
    calories: Number(document.getElementById('target-cal').value) || 0,
    protein: Number(document.getElementById('target-protein').value) || 0,
    carbs: Number(document.getElementById('target-carbs').value) || 0,
    fat: Number(document.getElementById('target-fat').value) || 0,
  };
  saveState();
  toast('Targets saved');
});

document.getElementById('export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ironlog-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup downloaded (API key not included)');
});

document.getElementById('import-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const imported = JSON.parse(reader.result);
      state = Object.assign(defaultState(), imported);
      saveState();
      toast('Backup imported');
      switchView('dashboard');
    } catch (err) {
      await showAlert('That file could not be read as a valid backup.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('reset-btn').addEventListener('click', async () => {
  if (!(await showConfirm('This deletes all workouts, habits, nutrition logs and XP on this device. This cannot be undone.', { title: 'Reset all data?', confirmText: 'Continue', danger: true }))) return;
  if (!(await showConfirm('Really sure? Consider exporting a backup first.', { title: 'Last chance', confirmText: 'Reset everything', danger: true }))) return;
  state = defaultState();
  saveState();
  toast('All data reset');
  switchView('dashboard');
});

/* ---------------- utils ---------------- */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ================================================================
   PWA: install prompt + service worker
   ================================================================ */
const IOS_TIP_DISMISSED_KEY = 'ironlog_ios_tip_dismissed';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}

let deferredInstallPrompt = null;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!isStandalone()) installBtn.classList.remove('hidden');
});

installBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') toast('Installed');
  deferredInstallPrompt = null;
  installBtn.classList.add('hidden');
});

window.addEventListener('appinstalled', () => {
  installBtn.classList.add('hidden');
  toast('IronLog installed');
});

// iOS has no beforeinstallprompt — show a one-time manual tip instead.
if (isIOS() && !isStandalone() && !localStorage.getItem(IOS_TIP_DISMISSED_KEY)) {
  document.getElementById('ios-install-tip').classList.remove('hidden');
}
document.getElementById('ios-tip-dismiss').addEventListener('click', () => {
  document.getElementById('ios-install-tip').classList.add('hidden');
  localStorage.setItem(IOS_TIP_DISMISSED_KEY, '1');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.error('Service worker registration failed:', err));
  });
  let hasReloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hasReloaded) return;
    hasReloaded = true;
    window.location.reload();
  });
}

/* ================================================================
   NOTIFICATIONS (best-effort — only fires while the app is open,
   or shortly after it's reopened; there's no push server here)
   ================================================================ */
const REMINDERS_ENABLED_KEY = 'ironlog_reminders_enabled';
const REMINDER_TIME_KEY = 'ironlog_reminder_time';
const REMINDER_LAST_SHOWN_KEY = 'ironlog_reminder_last_shown';

const HABIT_NUDGES_ENABLED_KEY = 'ironlog_habit_nudges_enabled';
const HABIT_NUDGE_TIME1_KEY = 'ironlog_habit_nudge_time1';
const HABIT_NUDGE_TIME2_KEY = 'ironlog_habit_nudge_time2';
const HABIT_NUDGE_STATE_KEY = 'ironlog_habit_nudge_state'; // {date, count, final}

function remindersEnabled() { return localStorage.getItem(REMINDERS_ENABLED_KEY) === '1'; }
function getReminderTime() { return localStorage.getItem(REMINDER_TIME_KEY) || '20:00'; }
function habitNudgesEnabled() { return localStorage.getItem(HABIT_NUDGES_ENABLED_KEY) === '1'; }
function getHabitNudgeTime1() { return localStorage.getItem(HABIT_NUDGE_TIME1_KEY) || '13:00'; }
function getHabitNudgeTime2() { return localStorage.getItem(HABIT_NUDGE_TIME2_KEY) || '20:30'; }

function renderReminderStatus() {
  const statusEl = document.getElementById('reminders-status');
  const btn = document.getElementById('enable-reminders-btn');
  const supported = 'Notification' in window;
  if (supported && remindersEnabled() && Notification.permission === 'granted') {
    statusEl.textContent = `On — one nudge around ${getReminderTime()} on days you haven't finished.${bgSyncStatusNote()}`;
    btn.textContent = 'Disable reminders';
  } else {
    statusEl.textContent = supported ? 'Off.' : 'Notifications aren\'t supported in this browser.';
    btn.textContent = 'Enable reminders';
    btn.disabled = !supported;
  }
}

document.getElementById('enable-reminders-btn').addEventListener('click', async () => {
  if (remindersEnabled()) {
    localStorage.setItem(REMINDERS_ENABLED_KEY, '0');
    renderReminderStatus();
    toast('Reminders off');
    return;
  }
  if (!('Notification' in window)) {
    toast('This browser doesn\'t support notifications');
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    toast('Notifications were blocked in the browser');
    renderReminderStatus();
    return;
  }
  localStorage.setItem(REMINDERS_ENABLED_KEY, '1');
  renderReminderStatus();
  toast('Reminders on');
  scheduleTodayReminder();
  await syncNotifyStateToIDB();
  await tryRegisterBackgroundSync();
  renderReminderStatus();
});

document.getElementById('reminder-time-input').addEventListener('change', (e) => {
  localStorage.setItem(REMINDER_TIME_KEY, e.target.value || '20:00');
  renderReminderStatus();
  scheduleTodayReminder();
  syncNotifyStateToIDB();
});

function todayIsIncomplete() {
  const t = todayStr();
  const workoutDone = !!state.workoutDays[t];
  const habitsDoneToday = Object.values(state.habitLogs[t] || {}).filter(Boolean).length;
  const habitsAllDone = state.habits.length > 0 && habitsDoneToday >= state.habits.length;
  return !workoutDone || !habitsAllDone;
}

function todayHasActivity() {
  const t = todayStr();
  const workoutDone = !!state.workoutDays[t];
  const anyHabitDone = Object.values(state.habitLogs[t] || {}).some(Boolean);
  const anyMeal = (state.nutrition.logs[t] || []).length > 0;
  return workoutDone || anyHabitDone || anyMeal;
}

function habitsRemainingToday() {
  const t = todayStr();
  const log = state.habitLogs[t] || {};
  return state.habits.filter(h => !log[h.id]);
}

function habitsFullyDoneToday() {
  return state.habits.length > 0 && habitsRemainingToday().length === 0;
}

// Shared notification sender for every kind of nudge this app sends.
async function showAppNotification(title, body, { tag, url } = {}) {
  const opts = {
    body,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: tag || 'ironlog',
    renotify: true,
    vibrate: [120, 60, 120],
    data: { url: url || './index.html' },
  };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, opts);
      return;
    }
  } catch (e) { /* fall through to plain Notification */ }
  try { new Notification(title, opts); } catch (e) { console.warn('Could not show notification', e); }
}

/* ---- Daily reminder: one combined ping about workout + habits ---- */
function buildReminderMessage(streak) {
  const t = todayStr();
  const workoutDone = !!state.workoutDays[t];
  const habitsDone = habitsFullyDoneToday();
  const streakNote = streak > 0 ? ` Your ${streak}-day streak is waiting on it.` : '';

  if (!workoutDone && !habitsDone) {
    return `Nothing logged yet today.${streakNote} A quick workout or habit check keeps things moving.`;
  }
  if (!workoutDone) {
    return `Habits are sorted — just today's workout left.${streakNote}`;
  }
  return `Workout's in — a few habits left to close out the day.${streakNote}`;
}

async function sendReminderNotification() {
  const streak = computeWorkoutStreak();
  const t = todayStr();
  const workoutDone = !!state.workoutDays[t];
  const habitsDone = habitsFullyDoneToday();
  const body = buildReminderMessage(streak);
  let url = './index.html';
  if (workoutDone && !habitsDone) url = './index.html#habits';
  else if (!workoutDone && habitsDone) url = './index.html#train';
  await showAppNotification('IronLog', body, { tag: 'ironlog-reminder', url });
}

function maybeSendReminder() {
  if (!('Notification' in window)) return;
  if (!remindersEnabled() || Notification.permission !== 'granted') return;
  const [h, m] = getReminderTime().split(':').map(Number);
  const now = new Date();
  const reminderReached = now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
  if (!reminderReached) return;
  if (localStorage.getItem(REMINDER_LAST_SHOWN_KEY) === todayStr()) return; // once a day
  if (!todayIsIncomplete()) return; // already done, nothing to nudge about
  sendReminderNotification();
  localStorage.setItem(REMINDER_LAST_SHOWN_KEY, todayStr());
}

let reminderTimeoutId = null;
function scheduleTodayReminder() {
  if (reminderTimeoutId) clearTimeout(reminderTimeoutId);
  if (!remindersEnabled()) return;
  const [h, m] = getReminderTime().split(':').map(Number);
  const target = new Date();
  target.setHours(h, m, 0, 0);
  const ms = target.getTime() - Date.now();
  if (ms > 0 && ms < 24 * 60 * 60 * 1000) {
    reminderTimeoutId = setTimeout(maybeSendReminder, ms);
  }
}

/* ---- Habit nudges: 1 nudge/day if you've already been active,
   2 (a gentle one, then a firmer one) if you haven't touched the
   app at all — checked at two times during the day ---- */
function getHabitNudgeState() {
  try {
    const raw = JSON.parse(localStorage.getItem(HABIT_NUDGE_STATE_KEY) || 'null');
    if (raw && raw.date === todayStr()) return raw;
  } catch (e) { /* fall through to a fresh state */ }
  return { date: todayStr(), count: 0, final: false };
}
function setHabitNudgeState(s) {
  localStorage.setItem(HABIT_NUDGE_STATE_KEY, JSON.stringify(s));
}

function buildHabitNudgeMessage(slot, hasActivity) {
  const remaining = habitsRemainingToday();
  const names = remaining.slice(0, 2).map(h => h.name).join(', ');
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

async function sendHabitNudgeNotification(slot, hasActivity) {
  const body = buildHabitNudgeMessage(slot, hasActivity);
  await showAppNotification('IronLog · Habits', body, { tag: 'ironlog-habit-nudge', url: './index.html#habits' });
}

// Rule of thumb: a day where you've already shown up gets one nudge
// about what's left; a day with zero activity gets chased harder — a
// soft nudge at check 1, then a firmer one at check 2 if you're still
// dark by then. Capped at 2 sends/day either way.
function maybeSendHabitNudge(slot) {
  if (!('Notification' in window)) return;
  if (!habitNudgesEnabled() || Notification.permission !== 'granted') return;
  if (state.habits.length === 0) return;

  const timeStr = slot === 1 ? getHabitNudgeTime1() : getHabitNudgeTime2();
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const reached = now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
  if (!reached) return;
  if (habitsFullyDoneToday()) return; // nothing to nudge about

  const nudgeState = getHabitNudgeState();
  if (nudgeState.final) return; // today's quota already decided/sent

  if (slot === 1) {
    if (nudgeState.count >= 1) return;
    const hasActivity = todayHasActivity();
    sendHabitNudgeNotification(1, hasActivity);
    // Already active today → that's the one nudge this day gets.
    // Not active yet → leave the door open for a second, firmer nudge.
    setHabitNudgeState({ date: todayStr(), count: 1, final: hasActivity });
  } else {
    if (nudgeState.count >= 2) return;
    const hasActivity = todayHasActivity();
    sendHabitNudgeNotification(2, hasActivity);
    setHabitNudgeState({ date: todayStr(), count: nudgeState.count + 1, final: true });
  }
}

let habitNudgeTimeoutIds = [];
function scheduleHabitNudges() {
  habitNudgeTimeoutIds.forEach(clearTimeout);
  habitNudgeTimeoutIds = [];
  if (!habitNudgesEnabled()) return;
  [[1, getHabitNudgeTime1()], [2, getHabitNudgeTime2()]].forEach(([slot, timeStr]) => {
    const [h, m] = timeStr.split(':').map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);
    const ms = target.getTime() - Date.now();
    if (ms > 0 && ms < 24 * 60 * 60 * 1000) {
      habitNudgeTimeoutIds.push(setTimeout(() => maybeSendHabitNudge(slot), ms));
    }
  });
}

function renderHabitNudgeStatus() {
  const statusEl = document.getElementById('habit-nudges-status');
  const toggle = document.getElementById('habit-nudges-toggle');
  const supported = 'Notification' in window;
  const on = supported && habitNudgesEnabled() && Notification.permission === 'granted';
  toggle.classList.toggle('on', on);
  toggle.setAttribute('aria-checked', on ? 'true' : 'false');
  if (!supported) {
    statusEl.textContent = 'Notifications aren\'t supported in this browser.';
  } else if (on) {
    statusEl.textContent = `On — 1 nudge if you've already been active today, 2 if you haven't (around ${getHabitNudgeTime1()} and ${getHabitNudgeTime2()}).${bgSyncStatusNote()}`;
  } else {
    statusEl.textContent = 'Off.';
  }
}

document.getElementById('habit-nudges-toggle').addEventListener('click', async () => {
  if (habitNudgesEnabled()) {
    localStorage.setItem(HABIT_NUDGES_ENABLED_KEY, '0');
    renderHabitNudgeStatus();
    scheduleHabitNudges();
    toast('Habit nudges off');
    return;
  }
  if (!('Notification' in window)) {
    toast('This browser doesn\'t support notifications');
    return;
  }
  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      toast('Notifications were blocked in the browser');
      renderHabitNudgeStatus();
      return;
    }
  }
  localStorage.setItem(HABIT_NUDGES_ENABLED_KEY, '1');
  renderHabitNudgeStatus();
  toast('Habit nudges on');
  scheduleHabitNudges();
  await syncNotifyStateToIDB();
  await tryRegisterBackgroundSync();
  renderHabitNudgeStatus();
});

document.getElementById('habit-nudge-time1').addEventListener('change', (e) => {
  localStorage.setItem(HABIT_NUDGE_TIME1_KEY, e.target.value || '13:00');
  renderHabitNudgeStatus();
  scheduleHabitNudges();
  syncNotifyStateToIDB();
});
document.getElementById('habit-nudge-time2').addEventListener('change', (e) => {
  localStorage.setItem(HABIT_NUDGE_TIME2_KEY, e.target.value || '20:30');
  renderHabitNudgeStatus();
  scheduleHabitNudges();
  syncNotifyStateToIDB();
});

/* ---------------- Background notifications (Periodic Background Sync) ----------------
   Everything above only fires while a tab is open — setTimeout and
   visibilitychange both die the moment the tab or browser closes, so
   with just that, a closed app genuinely never notifies. Periodic
   Background Sync lets the service worker itself wake up on a
   schedule the browser decides (not exact, and only on Chromium
   browsers, and only once IronLog is installed as an app — see
   README) and run the same check with no tab open at all.

   A service worker can't read localStorage, so the fields it needs
   are mirrored into IndexedDB every time relevant state changes;
   see runBackgroundNotifyCheck() in sw.js for the other half of this. */
const BG_SYNC_STATUS_KEY = 'ironlog_bg_sync_status'; // 'on' | 'off' | unset

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

function buildNotifySnapshot() {
  const t = todayStr();
  return {
    today: t,
    workoutDone: !!state.workoutDays[t],
    habits: state.habits.map(h => ({ id: h.id, name: h.name })),
    habitLogsToday: Object.assign({}, state.habitLogs[t] || {}),
    mealsLoggedToday: (state.nutrition.logs[t] || []).length > 0,
    streak: computeWorkoutStreak(),
    settings: {
      remindersEnabled: remindersEnabled(),
      reminderTime: getReminderTime(),
      reminderLastShownDate: localStorage.getItem(REMINDER_LAST_SHOWN_KEY) || '',
      habitNudgesEnabled: habitNudgesEnabled(),
      habitNudgeTime1: getHabitNudgeTime1(),
      habitNudgeTime2: getHabitNudgeTime2(),
      habitNudgeState: getHabitNudgeState(),
    },
  };
}
async function syncNotifyStateToIDB() {
  await idbSet('notifyState', buildNotifySnapshot());
}

// If the service worker fired something while the app was closed, pull
// its updated "already sent today" bookkeeping back into localStorage
// so the foreground checks below don't turn around and send it again.
async function reconcileNotifyStateFromIDB() {
  const snap = await idbGet('notifyState');
  if (!snap || !snap.settings) return;
  const s = snap.settings;
  if (s.reminderLastShownDate && s.reminderLastShownDate > (localStorage.getItem(REMINDER_LAST_SHOWN_KEY) || '')) {
    localStorage.setItem(REMINDER_LAST_SHOWN_KEY, s.reminderLastShownDate);
  }
  if (s.habitNudgeState && s.habitNudgeState.date === todayStr()) {
    const local = getHabitNudgeState();
    if (s.habitNudgeState.date === local.date
        && (s.habitNudgeState.count > local.count || (s.habitNudgeState.final && !local.final))) {
      setHabitNudgeState(s.habitNudgeState);
    }
  }
}

function isInstalledPWA() {
  return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
}
function backgroundSyncStatus() { return localStorage.getItem(BG_SYNC_STATUS_KEY) || 'unknown'; }

// Best-effort — succeeds only on Chromium browsers with IronLog installed
// as an app and enough engagement history for the browser to trust it.
// Fails silently everywhere else; the foreground checks keep working
// regardless either way.
async function tryRegisterBackgroundSync() {
  let ok = false;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if ('periodicSync' in reg) {
        await reg.periodicSync.register('ironlog-habit-check', { minInterval: 6 * 60 * 60 * 1000 });
        ok = true;
      }
    }
  } catch (e) { ok = false; }
  localStorage.setItem(BG_SYNC_STATUS_KEY, ok ? 'on' : 'off');
  return ok;
}

function bgSyncStatusNote() {
  if (backgroundSyncStatus() === 'on') {
    return ' Background checks are on for this device, so this can fire even with IronLog fully closed — timing isn\'t exact, the browser decides when to run it.';
  }
  if (isInstalledPWA()) {
    return ' Background checks aren\'t available yet on this install — otherwise this only fires while a tab is open or shortly after you reopen it.';
  }
  return ' Install IronLog as an app (browser menu → Install app) for a chance at background checks — otherwise this only fires while a tab is open.';
}

if ('Notification' in window) {
  reconcileNotifyStateFromIDB().finally(() => {
    maybeSendReminder();
    maybeSendHabitNudge(1);
    maybeSendHabitNudge(2);
  });
  scheduleTodayReminder();
  scheduleHabitNudges();
  syncNotifyStateToIDB();
  if (remindersEnabled() || habitNudgesEnabled()) {
    tryRegisterBackgroundSync().then(() => {
      renderReminderStatus();
      renderHabitNudgeStatus();
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      reconcileNotifyStateFromIDB().finally(() => {
        maybeSendReminder();
        maybeSendHabitNudge(1);
        maybeSendHabitNudge(2);
      });
      syncNotifyStateToIDB();
    }
  });
}

/* ---------------- init ---------------- */
// Notification taps can deep-link straight to the relevant tab (via a
// URL like index.html#habits) — but that hash otherwise just sits in
// the address bar forever, since nothing else here ever sets or reads
// it. Left alone, every later launch of that same tab/PWA window would
// keep reopening to whatever tab the last notification pointed at,
// instead of the dashboard. So: honor it once, then clear it.
const initialHash = (location.hash || '').replace('#', '');
const validHashViews = ['train', 'habits', 'fuel', 'coach', 'settings'];
switchView(validHashViews.includes(initialHash) ? initialHash : 'dashboard');
if (initialHash) {
  history.replaceState(null, '', location.pathname + location.search);
}


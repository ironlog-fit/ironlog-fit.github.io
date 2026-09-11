/* ============================================================
   IronLog — personal training / habit / nutrition tracker
   Vanilla JS, no build step, no backend. Data lives in
   localStorage on the device it's used on.
   ============================================================ */

const STORAGE_KEY = 'ironlog_state_v1';
const APIKEY_STORAGE_KEY = 'ironlog_api_key'; // kept separate from state on purpose
const MODEL_STORAGE_KEY = 'ironlog_model';

const RANKS = [
  { name: 'Bronze',   min: 0 },
  { name: 'Silver',   min: 500 },
  { name: 'Gold',     min: 1200 },
  { name: 'Platinum', min: 2500 },
  { name: 'Diamond',  min: 4500 },
  { name: 'Apex',     min: 7000 },
];

const DEFAULT_TEMPLATES = [
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
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // shallow-merge with defaults so new fields don't break old saves
    return Object.assign(defaultState(), parsed);
  } catch (e) {
    console.error('Failed to load state, starting fresh.', e);
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state', e);
    toast('Could not save — storage may be full');
  }
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

  const t = todayStr();
  document.getElementById('today-workout').textContent = state.workoutDays[t] ? 'Done ✓' : 'Not logged';

  const habitsDoneToday = Object.values(state.habitLogs[t] || {}).filter(Boolean).length;
  document.getElementById('today-habits').textContent = `${habitsDoneToday} / ${state.habits.length}`;

  const todayMeals = state.nutrition.logs[t] || [];
  const cal = todayMeals.reduce((s, m) => s + m.calories, 0);
  document.getElementById('today-fuel').textContent = `${cal} / ${state.nutrition.targets.calories} kcal`;

  const strip = document.getElementById('week-strip');
  strip.innerHTML = '';
  for (let i = 6; i >= 0; i--) {
    const d = dateStrDaysAgo(i);
    const div = document.createElement('div');
    div.className = 'week-day' + (state.workoutDays[d] ? ' done' : '');
    const dayLabel = new Date(d).toLocaleDateString(undefined, { weekday: 'narrow' });
    div.textContent = dayLabel;
    strip.appendChild(div);
  }
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
      sets: Array.from({ length: ex.sets }, () => ({ weight: '', reps: '', done: false })),
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
  head.querySelector('#cancel-session').addEventListener('click', () => {
    if (confirm('Cancel this session? Nothing will be saved.')) {
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
        <input type="number" placeholder="kg" value="${set.weight}" data-ex="${exIdx}" data-set="${setIdx}" data-field="weight">
        <input type="number" placeholder="reps (target ${ex.targetReps})" value="${set.reps}" data-ex="${exIdx}" data-set="${setIdx}" data-field="reps">
        <button class="set-done-btn ${set.done ? 'done' : ''}" data-ex="${exIdx}" data-set="${setIdx}" data-done-toggle>✓</button>
      </div>
    `).join('');
    block.innerHTML = `
      <div class="session-ex-head">
        <h3>${escapeHtml(ex.name)}</h3>
        <button class="rest-btn" data-rest>Rest 90s</button>
      </div>
      ${setsHtml}
    `;
    wrap.appendChild(block);

    block.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', () => {
        const exi = +input.dataset.ex, si = +input.dataset.set, field = input.dataset.field;
        state.activeSession.exercises[exi].sets[si][field] = input.value;
        saveState();
      });
    });
    block.querySelectorAll('[data-done-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const exi = +btn.dataset.ex, si = +btn.dataset.set;
        const set = state.activeSession.exercises[exi].sets[si];
        set.done = !set.done;
        saveState();
        btn.classList.toggle('done', set.done);
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

function finishSession() {
  const s = state.activeSession;
  let totalVolume = 0;
  let newPRs = [];
  const historyExercises = [];

  s.exercises.forEach(ex => {
    const loggedSets = ex.sets.filter(set => set.done && Number(set.weight) > 0 && Number(set.reps) > 0);
    loggedSets.forEach(set => {
      const w = Number(set.weight), r = Number(set.reps);
      totalVolume += w * r;
      const currentPR = state.prs[ex.name];
      if (!currentPR || w > currentPR.weight) {
        state.prs[ex.name] = { weight: w, reps: r, date: todayStr() };
        if (!newPRs.includes(ex.name)) newPRs.push(ex.name);
      }
    });
    historyExercises.push({ name: ex.name, sets: loggedSets.map(x => ({ weight: Number(x.weight), reps: Number(x.reps) })) });
  });

  const totalSetsLogged = historyExercises.reduce((n, e) => n + e.sets.length, 0);
  if (totalSetsLogged === 0) {
    if (!confirm('No sets were logged. Finish anyway without saving to history?')) return;
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

  toast(newPRs.length ? `Session saved — ${newPRs.length} new PR!` : 'Session saved');
  renderSessionTab();
  renderHistory();
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
          <button class="link-btn" data-add-ex="${tpl.id}">+ exercise</button>
          <button class="link-btn danger" data-del-tpl="${tpl.id}">delete</button>
        </div>
      </div>
      ${exercisesHtml || '<div class="hint" style="margin:0;">No exercises yet.</div>'}
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('[data-add-ex]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tpl = state.templates.find(t => t.id === btn.dataset.addEx);
      const name = prompt('Exercise name?');
      if (!name) return;
      const sets = Number(prompt('Target sets?', '3')) || 3;
      const reps = Number(prompt('Target reps?', '10')) || 10;
      tpl.exercises.push({ id: uid(), name, sets, reps });
      saveState();
      renderTemplatesTab();
    });
  });
  list.querySelectorAll('[data-del-tpl]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Delete this template?')) return;
      state.templates = state.templates.filter(t => t.id !== btn.dataset.delTpl);
      saveState();
      renderTemplatesTab();
    });
  });
}

document.getElementById('add-template-btn').addEventListener('click', () => {
  const name = prompt('Template name (e.g. "Upper Body")?');
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
    const row = document.createElement('div');
    row.className = 'habit-row';
    row.innerHTML = `
      <button class="habit-check ${done ? 'done' : ''}" data-toggle="${h.id}">✓</button>
      <div class="habit-info">
        <span class="habit-name" contenteditable="true" data-rename="${h.id}">${escapeHtml(h.name)}</span>
        <span class="habit-streak">${h.streak} day streak</span>
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
    btn.addEventListener('click', () => {
      if (!confirm('Remove this habit?')) return;
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

  const wasDone = !!state.habitLogs[t][id];
  const nowDone = !wasDone;
  state.habitLogs[t][id] = nowDone;

  if (nowDone) {
    const yesterday = dateStrDaysAgo(1);
    habit.streak = (habit.lastDate === yesterday) ? habit.streak + 1 : 1;
    habit.lastDate = t;
    addXP(10);
  } else {
    // undo today's check
    habit.streak = Math.max(0, habit.streak - 1);
    habit.lastDate = habit.streak > 0 ? dateStrDaysAgo(1) : null;
    addXP(-10);
  }

  saveState();
  renderHabits();
}

document.getElementById('add-habit-btn').addEventListener('click', () => {
  const name = prompt('New habit name?');
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

  document.getElementById('ai-estimate-panel').classList.toggle('hidden', !getApiKey());
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
  const apiKey = getApiKey();
  if (!apiKey) { statusEl.textContent = 'Add an API key in Settings first.'; return; }

  statusEl.textContent = 'Estimating…';
  try {
    const result = await callClaudeJSON(
      'You are a nutrition estimator. Given a short description of a meal (possibly in Hinglish, and possibly Indian food), reply with ONLY a JSON object — no prose, no markdown fences — in this exact shape: {"name": string, "calories": number, "protein": number, "carbs": number, "fat": number}. Give a single best estimate for the whole meal as described.',
      desc
    );
    document.getElementById('mf-name').value = result.name || desc;
    document.getElementById('mf-cal').value = Math.round(result.calories || 0);
    document.getElementById('mf-protein').value = Math.round(result.protein || 0);
    document.getElementById('mf-carbs').value = Math.round(result.carbs || 0);
    document.getElementById('mf-fat').value = Math.round(result.fat || 0);
    statusEl.textContent = 'Estimated — review the numbers below, then add.';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Could not estimate: ' + err.message;
  }
});

/* ================================================================
   COACH
   ================================================================ */
let coachHistory = []; // in-memory only, resets on refresh

function renderCoach() {
  const hasKey = !!getApiKey();
  document.getElementById('coach-empty').classList.toggle('hidden', hasKey);
  document.getElementById('coach-chat-wrap').classList.toggle('hidden', !hasKey);
  if (hasKey) renderCoachLog();
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
  log.insertAdjacentHTML('beforeend', `<div class="msg system" id="${thinkingId}">…</div>`);
  log.scrollTop = log.scrollHeight;

  try {
    const reply = await callClaudeChat(coachHistory);
    coachHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    console.error(err);
    coachHistory.push({ role: 'assistant', content: 'Something went wrong reaching the API: ' + err.message });
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

/* ================================================================
   SETTINGS
   ================================================================ */
function renderSettings() {
  document.getElementById('api-key-input').value = getApiKey();
  document.getElementById('model-input').value = getModel();
  document.getElementById('key-status').textContent = getApiKey() ? 'A key is saved on this device.' : 'No key saved — AI Coach and meal estimation are off.';

  const targets = state.nutrition.targets;
  document.getElementById('target-cal').value = targets.calories;
  document.getElementById('target-protein').value = targets.protein;
  document.getElementById('target-carbs').value = targets.carbs;
  document.getElementById('target-fat').value = targets.fat;
}

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
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      state = Object.assign(defaultState(), imported);
      saveState();
      toast('Backup imported');
      switchView('dashboard');
    } catch (err) {
      alert('That file could not be read as a valid backup.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('reset-btn').addEventListener('click', () => {
  if (!confirm('This deletes all workouts, habits, nutrition logs and XP on this device. This cannot be undone. Continue?')) return;
  if (!confirm('Really sure? Consider exporting a backup first.')) return;
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

/* ---------------- init ---------------- */
renderDashboard();

/* ============================================
   AI DAILY PLANNER v3 — Full Application
   ============================================ */
const app = (() => {
  // =================== STATE ===================
  const S = {
    goals: [], habits: [], schedule: [], scheduleCompleted: {},
    calMonth: new Date().getMonth(), calYear: new Date().getFullYear(),
    currentView: 'dashboard', goalView: 'list', selPriority: 'medium', selDifficulty: 'medium',
    streak: 0, bestStreak: 0, lastActiveDate: null, scheduledDates: {},
    theme: localStorage.getItem('planai_theme') || 'dark',
    pomo: { mode: 'work', running: false, timeLeft: 25 * 60, sessions: 0, totalMin: 0, linkedGoal: '' },
    analytics: { dailyCompleted: {}, dailyFocus: {}, totalCreated: 0, totalCompleted: 0 },
    expandedGoals: {}, soundEnabled: true,
    xp: 0, level: 0, productivityScores: {},
    notificationsEnabled: false, focusMode: false,
    focusTimer: { taskId: null, taskTitle: '', running: false, timeLeft: 25 * 60, interval: null }
  };
  let pomoInterval = null;
  const ambientState = { ctx: null, source: null, gain: null, type: null };
  let notifCheckInterval = null;

  // =================== FIREBASE SETUP ===================
  const firebaseConfig = {
    apiKey: "AIzaSyBtHxv_L9P5DuMh1JyWZJhjDnYKBbNrSQw",
    authDomain: "plan-ai-tan.vercel.app",
    projectId: "plan-ai-b624f",
    storageBucket: "plan-ai-b624f.firebasestorage.app",
    messagingSenderId: "413233057634",
    appId: "1:413233057634:web:8b18cd8f2a9a0e66d9e63b",
    measurementId: "G-7P2T0F8HLF"
  };
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  let currentUser = null;

  auth.onAuthStateChanged(user => {
    const overlay = document.getElementById('authOverlay');
    if (user) {
      currentUser = user;
      if (overlay) overlay.classList.add('auth-hidden');
    } else {
      currentUser = null;
      if (overlay) overlay.classList.remove('auth-hidden');
    }
  });

  function signInWithGoogle() {

    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(e => {
        console.error(e);
        toast("Google Auth Error: " + e.message, 'error');
    });
  }
  function signOut() { auth.signOut(); }



  // =================== QUOTES (30+ for variety) ===================
  const QUOTES = [
    { t: "The secret of getting ahead is getting started.", a: "Mark Twain" },
    { t: "Either you run the day, or the day runs you.", a: "Jim Rohn" },
    { t: "Focus on being productive instead of busy.", a: "Tim Ferriss" },
    { t: "The key is not to prioritize what's on your schedule, but to schedule your priorities.", a: "Stephen Covey" },
    { t: "Your future is created by what you do today, not tomorrow.", a: "Robert Kiyosaki" },
    { t: "Don't count the days, make the days count.", a: "Muhammad Ali" },
    { t: "Small daily improvements over time lead to stunning results.", a: "Robin Sharma" },
    { t: "Action is the foundational key to all success.", a: "Pablo Picasso" },
    { t: "The only way to do great work is to love what you do.", a: "Steve Jobs" },
    { t: "Well begun is half done.", a: "Aristotle" },
    { t: "You don't need more time, you need more focus.", a: "Anonymous" },
    { t: "Productivity is never an accident.", a: "Paul J. Meyer" },
    { t: "Success is the sum of small efforts repeated day in and day out.", a: "Robert Collier" },
    { t: "The way to get started is to quit talking and begin doing.", a: "Walt Disney" },
    { t: "It always seems impossible until it's done.", a: "Nelson Mandela" },
    { t: "Do what you can, with what you have, where you are.", a: "Theodore Roosevelt" },
    { t: "Discipline is choosing between what you want now and what you want most.", a: "Abraham Lincoln" },
    { t: "Time is what we want most, but what we use worst.", a: "William Penn" },
    { t: "The bad news is time flies. The good news is you're the pilot.", a: "Michael Altshuler" },
    { t: "A year from now you may wish you had started today.", a: "Karen Lamb" },
    { t: "You are never too old to set another goal or dream a new dream.", a: "C.S. Lewis" },
    { t: "Start where you are. Use what you have. Do what you can.", a: "Arthur Ashe" },
    { t: "What we fear doing most is usually what we most need to do.", a: "Tim Ferriss" },
    { t: "Hard work beats talent when talent doesn't work hard.", a: "Tim Notke" },
    { t: "Motivation is what gets you started. Habit is what keeps you going.", a: "Jim Ryun" },
    { t: "Every accomplishment starts with the decision to try.", a: "John F. Kennedy" },
    { t: "The best time to plant a tree was 20 years ago. The second best time is now.", a: "Chinese Proverb" },
    { t: "It is not the mountain we conquer, but ourselves.", a: "Edmund Hillary" },
    { t: "We become what we repeatedly do.", a: "Sean Covey" },
    { t: "Progress, not perfection.", a: "Anonymous" },
    { t: "Your only limit is your mind.", a: "Anonymous" }
  ];

  // =================== HELPERS ===================
  const genId = () => 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };
  const fmtDate = d => d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const durLabel = m => m < 60 ? `${m}min` : (m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`);

  // Day-of-year for truly daily quote rotation
  function dayOfYear() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86400000);
  }

  // =================== SOUNDS ===================
  function playSound(type) {
    if (!S.soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (type === 'check') {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.setValueAtTime(600, ctx.currentTime); o.frequency.setValueAtTime(800, ctx.currentTime + 0.08);
        g.gain.setValueAtTime(0.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        o.start(); o.stop(ctx.currentTime + 0.25);
      } else if (type === 'complete') {
        [523, 659, 784].forEach((f, i) => {
          const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.12);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.4);
          o.start(ctx.currentTime + i * 0.12); o.stop(ctx.currentTime + i * 0.12 + 0.4);
        });
      } else if (type === 'timer') {
        [880, 0, 880, 0, 880].forEach((f, i) => {
          if (!f) return;
          const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
          o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.2);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.15);
          o.start(ctx.currentTime + i * 0.2); o.stop(ctx.currentTime + i * 0.2 + 0.15);
        });
      }
    } catch (e) { }
  }

  // =================== CONFETTI ===================
  function launchConfetti() {
    const c = document.getElementById('confettiCanvas');
    if (!c) return;
    c.style.display = 'block';
    const ctx = c.getContext('2d');
    c.width = window.innerWidth; c.height = window.innerHeight;
    const colors = ['#6366f1', '#a855f7', '#22d3ee', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#fbbf24'];
    const ps = Array.from({ length: 180 }, () => ({
      x: Math.random() * c.width, y: Math.random() * -c.height * 0.5,
      vx: (Math.random() - 0.5) * 8, vy: Math.random() * 4 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 7 + 3, rot: Math.random() * 360, rs: (Math.random() - 0.5) * 12, opacity: 1
    }));
    let frame = 0;
    function animate() {
      ctx.clearRect(0, 0, c.width, c.height);
      let active = false;
      ps.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.rot += p.rs;
        if (frame > 200) p.opacity -= 0.01;
        if (p.y < c.height + 20 && p.opacity > 0) active = true;
        ctx.save(); ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });
      frame++;
      if (active && frame < 350) requestAnimationFrame(animate);
      else c.style.display = 'none';
    }
    animate();
    playSound('complete');
  }

  // =================== ANIMATED COUNTERS ===================
  function animateValue(el, target, suffix = '', dur = 800) {
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    if (start === target) { el.textContent = target + suffix; return }
    const t0 = performance.now();
    function step(now) {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(start + (target - start) * ease) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // =================== PERSISTENCE ===================
  function save() {
    localStorage.setItem('planai_data', JSON.stringify({
      goals: S.goals, habits: S.habits, schedule: S.schedule, scheduleCompleted: S.scheduleCompleted,
      streak: S.streak, bestStreak: S.bestStreak, lastActiveDate: S.lastActiveDate, scheduledDates: S.scheduledDates,
      analytics: S.analytics, pomo: { sessions: S.pomo.sessions, totalMin: S.pomo.totalMin },
      xp: S.xp, level: S.level, productivityScores: S.productivityScores
    }));
    if (S.geminiApiKey) localStorage.setItem('planai_gemini_key', S.geminiApiKey);
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem('planai_data'));
      S.geminiApiKey = localStorage.getItem('planai_gemini_key') || '';
      if (!d) return;
      if (d.goals) S.goals = d.goals;
      if (d.habits) S.habits = d.habits;
      if (d.schedule) S.schedule = d.schedule;
      if (d.scheduleCompleted) S.scheduleCompleted = d.scheduleCompleted;
      if (typeof d.streak === 'number') S.streak = d.streak;
      if (typeof d.bestStreak === 'number') S.bestStreak = d.bestStreak;
      if (d.lastActiveDate) S.lastActiveDate = d.lastActiveDate;
      if (d.scheduledDates) S.scheduledDates = d.scheduledDates;
      if (d.analytics) S.analytics = { ...S.analytics, ...d.analytics };
      if (d.pomo) { S.pomo.sessions = d.pomo.sessions || 0; S.pomo.totalMin = d.pomo.totalMin || 0 }
      if (typeof d.xp === 'number') S.xp = d.xp;
      if (typeof d.level === 'number') S.level = d.level;
      if (d.productivityScores) S.productivityScores = d.productivityScores;
    } catch (e) { }
  }

  // =================== SETTINGS & AI CONFIG ===================
  function showSettings() {
    const modal = document.getElementById('settingsModal');
    const input = document.getElementById('geminiApiKeyInput');
    if (input) input.value = S.geminiApiKey || '';
    if (modal) modal.classList.add('show');
  }
  function closeSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.remove('show');
  }
  function saveSettings() {
    const input = document.getElementById('geminiApiKeyInput');
    if (input) {
      S.geminiApiKey = input.value.trim();
      save();
      toast('Settings saved successfully!', 'success');
      closeSettings();
    }
  }

  async function generateDailyReflection() {
    const modal = document.getElementById('reflectionModal');
    const content = document.getElementById('reflectionContent');
    if (modal) modal.classList.add('show');
    if (content) content.innerHTML = '<div style="text-align:center;padding:20px;">✨ Analyzing your day with AI...</div>';

    const stats = calculateProductivityScore();
    const prompt = `Analyze my productivity for today.
    Stats:
    - Total Score: ${stats.total}/100
    - Goals: ${stats.goalScore}/40
    - Focus: ${stats.focusScore}/20
    - Habits: ${stats.habitScore}/20
    - Streak: ${stats.streakScore}/10
    
    Current Goals: ${S.goals.map(g => g.title).join(', ')}

    Provide a reflective summary:
    1. Acknowledge specific wins.
    2. Identify one area for improvement.
    3. Give 3 actionable tips for tomorrow.
    Format with structured headings and emojis.`;

    const reflection = await callGemini(prompt, "You are a world-class productivity auditor.");
    if (reflection && content) {
      content.innerHTML = reflection.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    }
  }

  function closeReflection() {
    const modal = document.getElementById('reflectionModal');
    if (modal) modal.classList.remove('show');
  }

  async function callGemini(prompt, systemInstruction = "") {

    if (!S.geminiApiKey) {
      toast('Please set Gemini API key in Settings!', 'error');
      showSettings();
      return null;
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${S.geminiApiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: (systemInstruction ? systemInstruction + "\n\n" : "") + prompt }] }]
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.candidates[0].content.parts[0].text;
    } catch (e) {
      console.error('Gemini error:', e);
      toast('AI Error: ' + e.message, 'error');
      return null;
    }
  }


  // =================== TOASTS ===================
  function toast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    t.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
    c.appendChild(t); setTimeout(() => t.remove(), 3000);
  }

  // =================== STREAK ===================
  function updateStreak() {
    const td = today();
    if (S.lastActiveDate === td) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const ys = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    S.streak = S.lastActiveDate === ys ? S.streak + 1 : 1;
    if (S.streak > S.bestStreak) S.bestStreak = S.streak;
    S.lastActiveDate = td; save();
  }

  // =================== THEME (FIXED) ===================
  function applyTheme(t) {
    S.theme = t;
    document.documentElement.setAttribute('data-theme', t);
    document.body.style.background = t === 'light' ? '#f0f0fa' : '#06060f';
    localStorage.setItem('planai_theme', t);
    const icon = document.getElementById('themeIcon');
    const label = document.getElementById('themeLabel');
    if (icon) icon.textContent = t === 'dark' ? '🌙' : '☀️';
    if (label) label.textContent = t === 'dark' ? 'Dark' : 'Light';
  }
  function toggleTheme() {
    applyTheme(S.theme === 'dark' ? 'light' : 'dark');
    toast(`Switched to ${S.theme} mode`, 'info');
  }

  // =================== VIEW SWITCHING ===================
  function switchView(v) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === v));
    document.querySelectorAll('.mobile-nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === v));
    document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === `${v}-view`));
    
    const titles = { dashboard: 'Dashboard', goals: 'My Goals', schedule: 'AI Schedule', habits: 'Habit Tracker', calendar: 'Calendar', analytics: 'Analytics', pomodoro: 'Pomodoro Timer' };
    document.getElementById('viewTitle').textContent = titles[v] || v;
    S.currentView = v;
    
    closeMobileMenu();
    
    if (v === 'dashboard') renderDashboard();
    if (v === 'goals') renderGoals();
    if (v === 'schedule') renderSchedule();
    if (v === 'habits') renderHabits();
    if (v === 'calendar') renderCalendar();
    if (v === 'analytics') renderAnalytics();
    if (v === 'pomodoro') renderPomoTaskSelect();
    
    // Scroll to top on mobile
    if (window.innerWidth <= 768) window.scrollTo(0, 0);
  }

  function openMobileMenu() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('show');
  }

  function closeMobileMenu() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
  }

  // =================== WEATHER ===================
  async function fetchWeather() {
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
      const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`);
      const d = await resp.json();
      const w = d.current_weather;
      const codes = { 0: '☀️ Clear', 1: '🌤️ Mostly Clear', 2: '⛅ Partly Cloudy', 3: '☁️ Overcast', 45: '🌫️ Foggy', 48: '🌫️ Fog', 51: '🌦️ Light Drizzle', 53: '🌧️ Drizzle', 55: '🌧️ Heavy Drizzle', 61: '🌧️ Light Rain', 63: '🌧️ Rain', 65: '🌧️ Heavy Rain', 71: '🌨️ Light Snow', 73: '🌨️ Snow', 75: '🌨️ Heavy Snow', 80: '🌦️ Rain Showers', 81: '🌧️ Rain Showers', 82: '⛈️ Heavy Showers', 95: '⛈️ Thunderstorm' };
      const desc = codes[w.weathercode] || '🌡️ --';
      document.getElementById('weatherIcon').textContent = desc.split(' ')[0];
      document.getElementById('weatherTemp').textContent = `${Math.round(w.temperature)}°C`;
      document.getElementById('weatherDesc').textContent = desc.split(' ').slice(1).join(' ') + ` · Wind ${w.windspeed} km/h`;
      document.getElementById('weatherWidget').style.display = '';
    } catch (e) { document.getElementById('weatherWidget').style.display = 'none' }
  }

  // =================== DASHBOARD ===================
  function renderDashboard() {
    const done = S.goals.filter(g => g.completed);
    const totalMin = S.goals.reduce((s, g) => s + g.duration, 0);
    const pct = S.goals.length ? Math.round(done.length / S.goals.length * 100) : 0;

    animateValue(document.getElementById('statTotalGoals'), S.goals.length);
    animateValue(document.getElementById('statCompleted'), done.length);
    animateValue(document.getElementById('statStreak'), S.streak);
    const ftEl = document.getElementById('statFocusTime');
    if (ftEl) ftEl.textContent = durLabel(totalMin);

    // Progress bar (compact)
    const pctEl = document.getElementById('progressPct');
    const fillEl = document.getElementById('progressFill');
    if (pctEl) pctEl.textContent = pct + '%';
    if (fillEl) fillEl.style.width = pct + '%';

    // Daily quote using day-of-year for true daily rotation
    const qi = dayOfYear() % QUOTES.length;
    document.getElementById('dailyQuote').textContent = `"${QUOTES[qi].t}"`;
    document.getElementById('quoteAuthor').textContent = `— ${QUOTES[qi].a}`;

    // Schedule preview
    const tl = document.getElementById('dashboardTimeline');
    if (S.schedule.length) {
      tl.innerHTML = S.schedule.slice(0, 6).map(it => {
        const cc = S.scheduleCompleted[it.id] ? 'completed' : '';
        const bc = it.isBreak ? 'break' : '';
        return `<div class="mini-timeline-item ${cc} ${bc}"><span class="time">${it.startFormatted}</span><span class="task-name">${it.categoryEmoji || ''} ${it.title}</span></div>`;
      }).join('') + (S.schedule.length > 6 ? `<div style="text-align:center;padding:4px;font-size:11px;color:var(--text-secondary)">+${S.schedule.length - 6} more</div>` : '');
    } else {
      tl.innerHTML = '<div class="empty-state" style="padding:20px"><div class="empty-icon" style="font-size:28px">🗓️</div><p style="font-size:12px">Generate a schedule in AI Schedule</p></div>';
    }

    // Insights
    const ins = AIScheduler.getInsights(S.goals);
    document.getElementById('insightsList').innerHTML = (ins.length ? ins : ['🎯 Your day is well-balanced!']).map(t => `<div style="padding:8px 12px;background:var(--bg-surface);border-radius:var(--radius-md);font-size:12px;margin-bottom:4px">${t}</div>`).join('');
    renderProductivityScore();
    renderXPBar();
    renderAnalyticsMini();
    renderSuggestions();
    renderBurnoutAlert();
    renderStreakDisplay();
    renderGarden();
  }

  // =================== PRODUCTIVITY GARDEN ============
  function renderGarden() {
    const el = document.getElementById('gardenPlot');
    const stats = document.getElementById('gardenStats');
    const motto = document.getElementById('gardenMotto');
    if (!el || !stats) return;

    const slotCount = Math.max(5, Math.floor(S.xp / 20) + 3);
    const plants = {
      work: ['🌳', '🌲', '🌿', '🪵'],
      health: ['🌻', '🌷', '🌸', '🍀'],
      personal: ['🏠', '🏡', '🌵', '🪴'],
      learning: ['📚', '📖', '🧪', '🧬']
    };

    const completed = S.goals.filter(g => g.completed).slice(-slotCount);
    let html = '';
    
    for (let i = 0; i < slotCount; i++) {
        if (i < completed.length) {
            const g = completed[i];
            const pList = plants[g.category] || plants.work;
            const p = pList[i % pList.length];
            html += `<div class="garden-slot new-plant" title="${g.title}">${p}</div>`;
        } else {
            html += `<div class="garden-slot" style="opacity: 0.15; filter: grayscale(1)">🌱</div>`;
        }
    }
    
    el.innerHTML = html;
    const tier = S.level < 2 ? 'Seedling' : S.level < 4 ? 'Sprout' : S.level < 6 ? 'Garden' : 'Oasis';
    stats.textContent = `${tier} (${S.streak} Day Streak)`;
    
    const mottos = [
        "Small steps lead to big growth.",
        "Consistency is the secret to a lush life.",
        "Your productivity is blooming! ✨",
        "Deep focus creates deep roots."
    ];
    motto.textContent = mottos[dayOfYear() % mottos.length];
  }


  // =================== ANALYTICS MINI-PANEL ===================
  function renderAnalyticsMini() {
    const td = today();
    const totalTasks = S.goals.length;
    const completedTasks = S.goals.filter(g => g.completed).length;
    const pct = totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0;
    const focusMin = (S.analytics.dailyFocus[td] || 0) + S.pomo.totalMin;

    const pctEl = document.getElementById('analyticsMiniPct');
    const totalEl = document.getElementById('analyticsMiniTotal');
    const focusEl = document.getElementById('analyticsMiniFocus');
    const doneEl = document.getElementById('analyticsMiniDone');

    if (pctEl) pctEl.textContent = pct + '%';
    if (totalEl) totalEl.textContent = totalTasks;
    if (focusEl) focusEl.textContent = focusMin >= 60 ? Math.floor(focusMin / 60) + 'h ' + (focusMin % 60) + 'm' : focusMin + 'm';
    if (doneEl) doneEl.textContent = completedTasks;
  }

  // =================== SMART SUGGESTIONS ===================
  function renderSuggestions() {
    const td = today();
    const completedTasks = S.goals.filter(g => g.completed).length;
    const focusMin = (S.analytics.dailyFocus[td] || 0) + S.pomo.totalMin;
    const suggestions = AIScheduler.getSuggestions({
      goals: S.goals,
      completedCount: completedTasks,
      totalCount: S.goals.length,
      focusMinutes: focusMin,
      habits: S.habits
    });
    const el = document.getElementById('suggestionsList');
    if (el) {
      el.innerHTML = suggestions.map(s =>
        `<div class="suggestion-item">${s}</div>`
      ).join('');
    }
  }

  // =================== BURNOUT DETECTION ===================
  function renderBurnoutAlert() {
    const burnout = AIScheduler.detectBurnout(S.schedule, S.goals);
    let el = document.getElementById('burnoutAlert');
    if (!el) {
      el = document.createElement('div');
      el.id = 'burnoutAlert';
      const panel = document.getElementById('analyticsMiniPanel');
      if (panel) panel.parentNode.insertBefore(el, panel);
    }
    if (burnout.isBurnout || burnout.warnings.length > 0) {
      const levelClass = burnout.level === 'high' ? 'burnout-high' : burnout.level === 'moderate' ? 'burnout-moderate' : '';
      el.className = `burnout-alert ${levelClass}`;
      el.innerHTML = `
        <div class="burnout-header">
          <span class="burnout-icon">${burnout.level === 'high' ? '🔥' : burnout.level === 'moderate' ? '⚠️' : '💡'}</span>
          <span class="burnout-title">${burnout.level === 'high' ? 'High Burnout Risk' : burnout.level === 'moderate' ? 'Moderate Burnout Risk' : 'Workload Check'}</span>
          <button class="burnout-dismiss" onclick="this.closest('.burnout-alert').style.display='none'">✕</button>
        </div>
        <div class="burnout-body">
          ${burnout.warnings.map(w => `<div class="burnout-warning">${w}</div>`).join('')}
          ${burnout.suggestions.map(s => `<div class="burnout-suggestion">💡 ${s}</div>`).join('')}
        </div>
      `;
      el.style.display = '';
    } else {
      if (el) el.style.display = 'none';
    }
  }

  // =================== STREAK DISPLAY ===================
  function renderStreakDisplay() {
    const el = document.getElementById('streakDisplay');
    if (!el) return;
    const milestones = [3, 7, 14, 30, 60, 100];
    const next = milestones.find(m => m > S.streak) || S.streak + 10;
    const pct = Math.min(Math.round(S.streak / next * 100), 100);
    const isHot = S.streak >= 7;
    el.innerHTML = `
      <div class="streak-visual ${isHot ? 'streak-hot' : ''}">
        <div class="streak-flame">${S.streak >= 7 ? '🔥' : S.streak >= 3 ? '⚡' : '💫'}</div>
        <div class="streak-count">${S.streak}</div>
        <div class="streak-label">Day Streak</div>
        <div class="streak-bar"><div class="streak-bar-fill" style="width:${pct}%"></div></div>
        <div class="streak-next">Next milestone: ${next} days</div>
      </div>
    `;
  }

  // =================== DAY RECOVERY MODE ===================
  function recoverDayMode() {
    if (!S.schedule.length) { toast('No schedule to recover!', 'error'); return; }
    const incomplete = S.schedule.filter(t => !t.isBreak && !S.scheduleCompleted[t.id]);
    if (incomplete.length === 0) { toast('✅ All tasks completed! Nothing to recover.', 'success'); return; }
    S.schedule = AIScheduler.recoverDay(S.schedule, S.scheduleCompleted);
    const recoveredCount = S.schedule.filter(t => t.recovered).length;
    S.scheduledDates[today()] = S.schedule;
    save();
    toast(`🔄 Day recovery: ${recoveredCount} task(s) rescheduled into remaining time!`, 'success');
    renderSchedule(); renderDashboard();
  }

  // =================== AI COACH ===================
  const coachHistory = [];
  async function processCoachMessage(input) {
    const msg = input.trim().toLowerCase();
    if (!msg) return;
    coachHistory.push({ role: 'user', text: input.trim() });
    renderCoachMessages();

    // Check for local triggers first
    if (msg.includes('plan my day') || msg.includes('generate schedule')) {
      generateSchedule();
      const reply = '📅 I\'ve generated a smart schedule based on your goals. Check the AI Schedule tab!';
      coachHistory.push({ role: 'coach', text: reply });
      renderCoachMessages();
      return;
    }
    
    if (msg.includes('reschedule') || msg.includes('missed task')) {
      rescheduleMissed();
      const reply = '🔄 I\'ve rescheduled your missed tasks. Your timeline is updated!';
      coachHistory.push({ role: 'coach', text: reply });
      renderCoachMessages();
      return;
    }

    // Fallback to Gemini
    const system = `You are "PlanAI Coach", a world-class productivity expert. 
    Current State:
    - Goals: ${S.goals.length} (${S.goals.filter(g=>g.completed).length} done)
    - Focus Time: ${S.pomo.totalMin}m
    - Streak: ${S.streak} days
    Rules:
    1. Be concise (max 3 sentences).
    2. Use emojis.
    3. If asked to "plan", "reschedule", or "recover", mention those specific commands work best.`;

    const reply = await callGemini(input, system);
    if (reply) {
      coachHistory.push({ role: 'coach', text: reply });
      renderCoachMessages();
    }
  }

  function renderCoachMessages() {
    const el = document.getElementById('coachMessages');
    if (!el) return;
    el.innerHTML = coachHistory.slice(-20).map(m => {
      if (m.role === 'user') {
        return `<div class="coach-msg coach-msg-user"><div class="coach-bubble coach-bubble-user">${m.text}</div></div>`;
      } else {
        return `<div class="coach-msg coach-msg-bot"><div class="coach-avatar">🤖</div><div class="coach-bubble coach-bubble-bot">${m.text.replace(/\n/g, '<br>')}</div></div>`;
      }
    }).join('');
    el.scrollTop = el.scrollHeight;
  }

  async function sendCoachMessage() {
    const input = document.getElementById('coachInput');
    if (!input || !input.value.trim()) return;
    const text = input.value;
    input.value = '';
    await processCoachMessage(text);
  }

  function toggleCoachBox() {
    const box = document.getElementById('coachBox');
    if (!box) return;
    box.classList.toggle('coach-open');
    if (box.classList.contains('coach-open') && coachHistory.length === 0) {
      coachHistory.push({ role: 'coach', text: '👋 Hi! I\'m your Gemini-powered AI Coach. How can I help you stay productive today?' });
      renderCoachMessages();
    }
  }


  // =================== GOALS ===================
  function addGoal(title, duration, priority, category, urgent, recurrence, notes, difficulty) {
    const diff = difficulty || 'medium';
    // Auto-assign duration from difficulty if user didn't specify a custom one
    const autoDur = AIScheduler.DIFFICULTY_DURATION[diff] || 30;
    const finalDur = parseInt(duration) || autoDur;
    const g = {
      id: genId(), title, duration: finalDur, priority, category: category || 'work',
      difficulty: diff,
      urgent: urgent === 'true' || urgent === true, recurrence: recurrence || 'none', notes: notes || '',
      subtasks: [], completed: false, createdAt: new Date().toISOString()
    };
    S.goals.push(g);
    S.analytics.totalCreated++;
    save(); playSound('check'); toast(`Goal "${title}" added!`, 'success');
    renderGoals(); renderDashboard();
  }
  function deleteGoal(id) { S.goals = S.goals.filter(g => g.id !== id); save(); toast('Goal removed', 'info'); renderGoals(); renderDashboard() }
  function toggleGoalComplete(id) {
    const g = S.goals.find(x => x.id === id);
    if (g) {
      g.completed = !g.completed;
      if (g.completed) {
        playSound('check');
        S.analytics.totalCompleted++;
        const td = today();
        S.analytics.dailyCompleted[td] = (S.analytics.dailyCompleted[td] || 0) + 1;
        S.analytics.dailyFocus[td] = (S.analytics.dailyFocus[td] || 0) + g.duration;
        const xpMap = { high: 50, medium: 25, low: 10 };
        awardXP(xpMap[g.priority] || 25, g.title);
      }
      save(); renderGoals(); renderDashboard();
      if (S.goals.length > 0 && S.goals.every(x => x.completed)) setTimeout(launchConfetti, 300);
    }
  }
  function addSubtask(goalId, text) {
    const g = S.goals.find(x => x.id === goalId);
    if (g && text.trim()) { g.subtasks.push({ id: genId(), text: text.trim(), done: false }); save(); renderGoals() }
  }
  function toggleSubtask(goalId, stId) {
    const g = S.goals.find(x => x.id === goalId);
    if (g) { const st = g.subtasks.find(s => s.id === stId); if (st) { st.done = !st.done; save(); renderGoals() } }
  }
  function toggleGoalExpand(id) { S.expandedGoals[id] = !S.expandedGoals[id]; renderGoals() }

  function renderGoals() {
    const lv = document.getElementById('goalsListView'), bv = document.getElementById('goalsBoardView'), mv = document.getElementById('goalsMatrixView');
    lv.style.display = S.goalView === 'list' ? '' : 'none';
    bv.style.display = S.goalView === 'board' ? '' : 'none';
    mv.style.display = S.goalView === 'matrix' ? '' : 'none';
    if (S.goalView === 'list') renderGoalsList();
    else if (S.goalView === 'board') renderGoalsBoard();
    else renderGoalsMatrix();
  }

  function renderGoalsList() {
    const c = document.getElementById('goalsListView');
    if (!S.goals.length) { c.innerHTML = '<div class="empty-state"><div class="empty-icon">🎯</div><h3>No goals yet</h3><p>Add your first goal and let AI plan your day!</p></div>'; return }
    const po = { high: 0, medium: 1, low: 2 };
    const sorted = [...S.goals].sort((a, b) => { if (a.completed !== b.completed) return a.completed ? 1 : -1; return po[a.priority] - po[b.priority] });
    c.innerHTML = sorted.map((g, i) => {
      const exp = S.expandedGoals[g.id];
      let html = `<div class="goal-card ${g.completed ? 'completed' : ''}" style="animation-delay:${i * 40}ms" data-id="${g.id}" draggable="true" ondragstart="app.dragStart(event,'${g.id}')">
        <div class="goal-check ${g.completed ? 'checked' : ''}" onclick="app.toggleGoalComplete('${g.id}')">${g.completed ? '✓' : ''}</div>
        <div class="goal-info">
          <div class="goal-title">${g.title} ${g.recurrence !== 'none' ? '<span style="font-size:10px;color:var(--text-tertiary)">🔁</span>' : ''}</div>
          <div class="goal-meta">
            <span class="badge badge-priority-${g.priority}">${g.priority.toUpperCase()}</span>
            <span class="badge badge-${g.category}">${AIScheduler.CATEGORY_EMOJI[g.category] || '📋'} ${g.category}</span>
            ${g.difficulty ? `<span class="badge badge-difficulty-${g.difficulty}">${{easy:'🟢',medium:'🟡',hard:'🔴'}[g.difficulty]} ${g.difficulty}</span>` : ''}
            ${g.urgent ? '<span class="badge badge-urgent">⚡ URGENT</span>' : ''}
            <span class="goal-duration">⏱️ ${durLabel(g.duration)}</span>
          </div>
          ${g.notes && exp ? `<div style="margin-top:5px;font-size:11px;color:var(--text-secondary);padding:5px 8px;background:var(--bg-surface);border-radius:var(--radius-sm)">${g.notes}</div>` : ''}
        </div>
        <span class="goal-expand-btn" onclick="app.toggleGoalExpand('${g.id}')">${exp ? '▲' : '▼'}</span>
        <div class="goal-actions">
          <button class="btn btn-sm btn-danger" onclick="app.deleteGoal('${g.id}')">🗑️</button>
        </div>
      </div>`;
      if (exp) {
        html += `<div class="subtasks-list">${g.subtasks.map(st => `<div class="subtask-item ${st.done ? 'done' : ''}"><input type="checkbox" ${st.done ? 'checked' : ''} onchange="app.toggleSubtask('${g.id}','${st.id}')"><span>${st.text}</span></div>`).join('')}</div>`;
        html += `<div class="add-subtask-inline"><input type="text" placeholder="Add subtask..." id="st-${g.id}" onkeydown="if(event.key==='Enter'){app.addSubtask('${g.id}',this.value);this.value=''}"><button class="btn btn-sm btn-outline" onclick="app.addSubtask('${g.id}',document.getElementById('st-${g.id}').value);document.getElementById('st-${g.id}').value=''">+</button></div>`;
      }
      return html;
    }).join('');
  }

  function renderGoalsBoard() {
    const render = gs => gs.length ? gs.map(g => `<div class="board-card" draggable="true" ondragstart="app.dragStart(event,'${g.id}')"><div class="card-title">${g.title}</div><div class="card-meta"><span class="badge badge-${g.category}" style="font-size:9px">${AIScheduler.CATEGORY_EMOJI[g.category]} ${g.category}</span><span style="font-size:10px;color:var(--text-secondary)">⏱️${durLabel(g.duration)}</span></div></div>`).join('') : '<div style="text-align:center;color:var(--text-tertiary);font-size:11px;padding:14px">No goals</div>';
    document.getElementById('boardHigh').innerHTML = render(S.goals.filter(g => g.priority === 'high'));
    document.getElementById('boardMedium').innerHTML = render(S.goals.filter(g => g.priority === 'medium'));
    document.getElementById('boardLow').innerHTML = render(S.goals.filter(g => g.priority === 'low'));
  }

  function renderGoalsMatrix() {
    const imp = g => g.priority === 'high' || g.priority === 'medium';
    const urg = g => g.urgent;
    const q1 = S.goals.filter(g => imp(g) && urg(g)), q2 = S.goals.filter(g => imp(g) && !urg(g));
    const q3 = S.goals.filter(g => !imp(g) && urg(g)), q4 = S.goals.filter(g => !imp(g) && !urg(g));
    const render = gs => gs.length ? gs.map(g => `<div class="matrix-item">${AIScheduler.CATEGORY_EMOJI[g.category] || ''} ${g.title} <span style="font-size:10px;color:var(--text-tertiary)">(${durLabel(g.duration)})</span></div>`).join('') : '<div style="font-size:11px;color:var(--text-tertiary);padding:6px">None</div>';
    document.getElementById('matrixQ1').innerHTML = render(q1);
    document.getElementById('matrixQ2').innerHTML = render(q2);
    document.getElementById('matrixQ3').innerHTML = render(q3);
    document.getElementById('matrixQ4').innerHTML = render(q4);
  }

  function toggleGoalForm() { const f = document.getElementById('addGoalForm'); f.style.display = f.style.display === 'none' ? '' : 'none' }
  function cycleGoalView() {
    S.goalView = S.goalView === 'list' ? 'board' : 'list';
    document.getElementById('toggleGoalViewBtn').textContent = S.goalView === 'list' ? '📊 Board' : '📋 List';
    renderGoals();
  }
  function toggleMatrixView() {
    S.goalView = S.goalView === 'matrix' ? 'list' : 'matrix';
    renderGoals();
  }

  // Drag & Drop
  let draggedGoalId = null;
  function dragStart(e, id) { draggedGoalId = id; e.dataTransfer.effectAllowed = 'move' }
  function setupDragDrop() {
    document.querySelectorAll('.board-column .column-body').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.parentElement.classList.add('drag-over') });
      col.addEventListener('dragleave', () => col.parentElement.classList.remove('drag-over'));
      col.addEventListener('drop', e => {
        e.preventDefault(); col.parentElement.classList.remove('drag-over');
        if (draggedGoalId) {
          const g = S.goals.find(x => x.id === draggedGoalId);
          if (g) { g.priority = col.parentElement.dataset.priority; save(); renderGoals(); toast('Priority updated', 'success') }
          draggedGoalId = null;
        }
      });
    });
  }

  // =================== SCHEDULE ===================
  function generateSchedule() {
    const active = S.goals.filter(g => !g.completed);
    if (!active.length) { toast('Add goals first!', 'error'); return }
    const peakSel = document.getElementById('peakHoursSelect');
    const peakHours = peakSel ? peakSel.value : 'morning';
    S.schedule = AIScheduler.generateSmartSchedule(active, { peakHours });
    S.scheduleCompleted = {}; S.scheduledDates[today()] = S.schedule;
    save(); toast('AI smart schedule generated! 🚀', 'success'); renderSchedule(); renderDashboard();
  }
  function renderSchedule() {
    const emp = document.getElementById('scheduleEmpty'), tl = document.getElementById('timeline');
    const icsBtn = document.getElementById('exportIcsBtn'), shareBtn = document.getElementById('shareScheduleBtn'), rescBtn = document.getElementById('rescheduleBtn');
    if (!S.schedule.length) { emp.style.display = ''; tl.style.display = 'none'; if (icsBtn) icsBtn.style.display = 'none'; if (shareBtn) shareBtn.style.display = 'none'; if (rescBtn) rescBtn.style.display = 'none'; return }
    emp.style.display = 'none'; tl.style.display = ''; if (icsBtn) icsBtn.style.display = ''; if (shareBtn) shareBtn.style.display = ''; if (rescBtn) rescBtn.style.display = '';
    tl.innerHTML = S.schedule.map((it, i) => {
      const done = S.scheduleCompleted[it.id], cat = it.isBreak ? 'is-break' : `cat-${it.category || 'work'}`, dc = done ? 'task-completed' : '';
      const rescheduledBadge = it.rescheduled ? '<span class="badge badge-rescheduled">🔄 Rescheduled</span>' : '';
      const focusBtnHtml = !it.isBreak && !done ? `<button class="btn btn-sm btn-focus-task" onclick="app.startTaskFocus('${it.id}','${it.title.replace(/'/g, "\\'")}')">🎯 Focus</button>` : '';
      return `<div class="timeline-item ${dc}" style="animation-delay:${i * 60}ms" draggable="${!it.isBreak}" data-schedule-id="${it.id}" data-schedule-idx="${i}">
        <div class="timeline-time">${it.startFormatted}</div>
        <div class="timeline-dot" style="${it.isBreak ? 'background:var(--text-tertiary);box-shadow:none' : ''}"></div>
        <div class="timeline-content ${cat} ${dc}">
          <div class="task-info">
            <div class="task-title">${it.categoryEmoji || ''} ${it.title} ${rescheduledBadge}</div>
            <div class="task-duration">${it.startFormatted} – ${it.endFormatted} · ${durLabel(it.duration)}</div>
          </div>
          <div class="timeline-actions">
            ${focusBtnHtml}
            ${!it.isBreak ? `<button class="timeline-done-check ${done ? 'checked' : ''}" onclick="app.toggleScheduleComplete('${it.id}')">${done ? '✓' : ''}</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
    setupScheduleDragDrop();
  }
  function toggleScheduleComplete(id) {
    S.scheduleCompleted[id] = !S.scheduleCompleted[id];
    if (S.scheduleCompleted[id]) playSound('check');
    save(); renderSchedule(); renderDashboard();
    const taskItems = S.schedule.filter(x => !x.isBreak);
    if (taskItems.length && taskItems.every(x => S.scheduleCompleted[x.id])) setTimeout(launchConfetti, 300);
  }
  function exportICS() {
    const blob = new Blob([AIScheduler.exportToICS(S.schedule, new Date())], { type: 'text/calendar' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `planai-${today()}.ics`; a.click();
    toast('Exported .ics file!', 'success');
  }
  function shareSchedule() {
    const text = AIScheduler.generateShareText(S.schedule, new Date());
    if (navigator.share) { navigator.share({ title: 'My PlanAI Schedule', text }).catch(() => { }) }
    else {
      navigator.clipboard.writeText(text).then(() => toast('Schedule copied!', 'success')).catch(() => {
        const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Copied!', 'success');
      })
    }
  }

  // =================== AUTO RESCHEDULE ===================
  function rescheduleMissed() {
    if (!S.schedule.length) { toast('No schedule to reschedule!', 'error'); return; }
    const before = S.schedule.length;
    S.schedule = AIScheduler.rescheduleTasks(S.schedule, S.scheduleCompleted);
    const rescheduledCount = S.schedule.filter(t => t.rescheduled).length;
    if (rescheduledCount > 0) {
      S.scheduledDates[today()] = S.schedule;
      save();
      toast(`🔄 ${rescheduledCount} missed task(s) rescheduled!`, 'success');
    } else {
      toast('✅ No missed tasks to reschedule!', 'info');
    }
    renderSchedule(); renderDashboard();
  }

  // =================== SCHEDULE DRAG & DROP ===================
  let draggedScheduleId = null;
  function setupScheduleDragDrop() {
    const tl = document.getElementById('timeline');
    if (!tl) return;
    const items = tl.querySelectorAll('.timeline-item[draggable="true"]');
    items.forEach(item => {
      item.addEventListener('dragstart', e => {
        draggedScheduleId = item.dataset.scheduleId;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedScheduleId);
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        tl.querySelectorAll('.timeline-item').forEach(el => el.classList.remove('drag-over-above', 'drag-over-below'));
        draggedScheduleId = null;
      });
      item.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        tl.querySelectorAll('.timeline-item').forEach(el => el.classList.remove('drag-over-above', 'drag-over-below'));
        if (e.clientY < midY) item.classList.add('drag-over-above');
        else item.classList.add('drag-over-below');
      });
      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over-above', 'drag-over-below');
      });
      item.addEventListener('drop', e => {
        e.preventDefault();
        item.classList.remove('drag-over-above', 'drag-over-below');
        const fromId = e.dataTransfer.getData('text/plain') || draggedScheduleId;
        const toId = item.dataset.scheduleId;
        if (!fromId || fromId === toId) return;
        const fromIdx = S.schedule.findIndex(t => t.id === fromId);
        const toIdx = S.schedule.findIndex(t => t.id === toId);
        if (fromIdx < 0 || toIdx < 0) return;
        // Move task
        const [moved] = S.schedule.splice(fromIdx, 1);
        const rect = item.getBoundingClientRect();
        const insertIdx = e.clientY < rect.top + rect.height / 2 ? toIdx : toIdx + 1;
        S.schedule.splice(insertIdx > fromIdx ? insertIdx - 1 : insertIdx, 0, moved);
        // Recalculate times
        S.schedule = AIScheduler.recalcTimesAfterReorder(S.schedule);
        S.scheduledDates[today()] = S.schedule;
        save();
        toast('📋 Schedule reordered!', 'success');
        renderSchedule(); renderDashboard();
      });
    });
  }

  // =================== PER-TASK FOCUS TIMER ===================
  function startTaskFocus(taskId, taskTitle) {
    // Stop any existing timer
    if (S.focusTimer.interval) clearInterval(S.focusTimer.interval);
    S.focusTimer.taskId = taskId;
    S.focusTimer.taskTitle = taskTitle;
    S.focusTimer.timeLeft = 25 * 60; // 25 minutes
    S.focusTimer.running = true;
    showTaskFocusOverlay();
    S.focusTimer.interval = setInterval(() => {
      S.focusTimer.timeLeft--;
      updateTaskFocusDisplay();
      if (S.focusTimer.timeLeft <= 0) {
        stopTaskFocus();
        playSound('timer');
        toast(`🎯 Focus session for "${S.focusTimer.taskTitle}" complete!`, 'success');
        awardXP(20, taskTitle);
        // Auto-complete the task in schedule
        S.scheduleCompleted[taskId] = true;
        save(); renderSchedule(); renderDashboard();
        if (S.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('🎯 Focus Complete!', { body: `Great work on "${taskTitle}"!` });
        }
      }
    }, 1000);
  }
  function stopTaskFocus() {
    if (S.focusTimer.interval) clearInterval(S.focusTimer.interval);
    S.focusTimer.running = false;
    S.focusTimer.interval = null;
  }
  function closeTaskFocus() {
    stopTaskFocus();
    const overlay = document.getElementById('taskFocusOverlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }
  function toggleTaskFocusPause() {
    if (!S.focusTimer.taskId) return;
    if (S.focusTimer.running) {
      stopTaskFocus();
      const btn = document.getElementById('taskFocusPauseBtn');
      if (btn) btn.textContent = '▶ Resume';
    } else {
      S.focusTimer.running = true;
      S.focusTimer.interval = setInterval(() => {
        S.focusTimer.timeLeft--;
        updateTaskFocusDisplay();
        if (S.focusTimer.timeLeft <= 0) {
          stopTaskFocus();
          playSound('timer');
          toast(`🎯 Focus session for "${S.focusTimer.taskTitle}" complete!`, 'success');
          awardXP(20, S.focusTimer.taskTitle);
          S.scheduleCompleted[S.focusTimer.taskId] = true;
          save(); renderSchedule(); renderDashboard();
          closeTaskFocus();
        }
      }, 1000);
      const btn = document.getElementById('taskFocusPauseBtn');
      if (btn) btn.textContent = '⏸ Pause';
    }
  }
  function showTaskFocusOverlay() {
    let overlay = document.getElementById('taskFocusOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'taskFocusOverlay';
      overlay.className = 'task-focus-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <button class="focus-exit-btn" onclick="app.closeTaskFocus()">✕ Exit</button>
      <div class="task-focus-content">
        <div class="task-focus-label">🎯 Focus: ${S.focusTimer.taskTitle}</div>
        <div class="task-focus-ring">
          <svg viewBox="0 0 260 260"><circle class="pomo-bg" cx="130" cy="130" r="120"/><circle class="task-focus-fill" id="taskFocusRing" cx="130" cy="130" r="120" stroke-dasharray="754" stroke-dashoffset="0"/></svg>
          <div class="task-focus-time" id="taskFocusTime">25:00</div>
        </div>
        <div class="task-focus-controls">
          <button class="btn btn-primary btn-lg" id="taskFocusPauseBtn" onclick="app.toggleTaskFocusPause()">⏸ Pause</button>
          <button class="btn btn-outline btn-lg" onclick="app.closeTaskFocus()">⏹ Stop</button>
        </div>
      </div>
    `;
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    updateTaskFocusDisplay();
  }
  function updateTaskFocusDisplay() {
    const el = document.getElementById('taskFocusTime');
    const ring = document.getElementById('taskFocusRing');
    if (!el) return;
    const m = Math.floor(S.focusTimer.timeLeft / 60);
    const s = S.focusTimer.timeLeft % 60;
    el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (ring) {
      const total = 25 * 60;
      const pct = (total - S.focusTimer.timeLeft) / total;
      const circ = 2 * Math.PI * 120;
      ring.setAttribute('stroke-dashoffset', circ - (circ * pct));
    }
  }

  // =================== HABITS ===================
  function addHabit(name, icon) { S.habits.push({ id: genId(), name, icon, streak: 0, completedDates: {}, createdAt: new Date().toISOString() }); save(); playSound('check'); toast(`Habit "${name}" created!`, 'success'); renderHabits() }
  function deleteHabit(id) { S.habits = S.habits.filter(h => h.id !== id); save(); toast('Habit removed', 'info'); renderHabits() }
  function toggleHabitToday(id) {
    const h = S.habits.find(x => x.id === id); if (!h) return;
    const td = today();
    if (h.completedDates[td]) delete h.completedDates[td];
    else { h.completedDates[td] = true; playSound('check'); awardXP(5, h.name); }
    h.streak = calcStreak(h); save(); renderHabits();
  }
  function calcStreak(h) {
    let s = 0, d = new Date();
    while (true) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (h.completedDates[k]) { s++; d.setDate(d.getDate() - 1) } else break
    }
    return s;
  }
  function renderHabits() {
    const grid = document.getElementById('habitsGrid'), hm = document.getElementById('weeklyHeatmap');
    if (!S.habits.length) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">✨</div><h3>Build great habits</h3><p>Track daily habits and watch streaks grow!</p></div>'; hm.style.display = 'none'; return }
    const td = today();
    grid.innerHTML = S.habits.map(h => {
      const chk = h.completedDates[td];
      return `<div class="habit-card"><div class="habit-icon">${h.icon}</div><div class="habit-info"><div class="habit-name">${h.name}</div><div class="habit-streak">${h.streak > 0 ? `<span class="streak-fire">🔥 ${h.streak} day streak</span>` : 'No streak yet'}</div></div>
        <button class="habit-check-btn ${chk ? 'checked' : ''}" onclick="app.toggleHabitToday('${h.id}')">${chk ? '✓' : '○'}</button>
        <button class="btn btn-sm btn-danger habit-delete" onclick="app.deleteHabit('${h.id}')">✕</button></div>`;
    }).join('');
    hm.style.display = ''; renderHeatmap();
  }
  function renderHeatmap() {
    const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ d, k: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, l: d.toLocaleDateString('en-US', { weekday: 'short' }) }) };
    document.getElementById('heatmapDayLabels').innerHTML = days.map(d => `<span>${d.l}</span>`).join('');
    const td = today();
    document.getElementById('heatmapGrid').innerHTML = S.habits.map(h => `<div class="heatmap-row"><div class="heatmap-label">${h.icon} ${h.name}</div><div class="heatmap-cells">${days.map(d => `<div class="heatmap-cell ${h.completedDates[d.k] ? 'filled' : ''} ${d.k === td ? 'today' : ''}">${h.completedDates[d.k] ? '✓' : ''}</div>`).join('')}</div></div>`).join('');
  }
  function toggleHabitForm() { const f = document.getElementById('addHabitForm'); f.style.display = f.style.display === 'none' ? '' : 'none' }

  // =================== CALENDAR ===================
  function renderCalendar() {
    const grid = document.getElementById('calendarGrid'), label = document.getElementById('calendarMonthLabel');
    const y = S.calYear, m = S.calMonth, t = new Date();
    label.textContent = new Date(y, m).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const dayN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let html = dayN.map(d => `<div class="calendar-day-header">${d}</div>`).join('');
    const fd = new Date(y, m, 1).getDay(), dim = new Date(y, m + 1, 0).getDate(), dpm = new Date(y, m, 0).getDate();
    for (let i = fd - 1; i >= 0; i--) html += `<div class="calendar-day other-month"><span class="day-number">${dpm - i}</span></div>`;
    for (let d = 1; d <= dim; d++) {
      const dk = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isT = t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
      const has = S.scheduledDates[dk] && S.scheduledDates[dk].length;
      html += `<div class="calendar-day ${isT ? 'today' : ''}" onclick="app.showDayDetail('${dk}',${d})" data-date="${dk}"><span class="day-number">${d}</span>${has ? '<div class="day-dots"><span class="day-dot"></span></div>' : ''}</div>`;
    }
    const rem = 7 - (fd + dim) % 7; if (rem < 7) for (let i = 1; i <= rem; i++) html += `<div class="calendar-day other-month"><span class="day-number">${i}</span></div>`;
    grid.innerHTML = html;
  }
  function showDayDetail(dk) {
    const det = document.getElementById('dayDetail'), title = document.getElementById('dayDetailTitle'), con = document.getElementById('dayDetailContent');
    document.querySelectorAll('.calendar-day.selected').forEach(e => e.classList.remove('selected'));
    const el = document.querySelector(`.calendar-day[data-date="${dk}"]`); if (el) el.classList.add('selected');
    const dt = new Date(dk + 'T12:00:00');
    title.textContent = `Schedule for ${dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
    const sch = S.scheduledDates[dk];
    con.innerHTML = sch && sch.length ? sch.filter(s => !s.isBreak).map(it => `<div class="day-schedule-item" style="border-left-color:var(--cat-${it.category || 'work'})"><span class="item-time">${it.startFormatted} – ${it.endFormatted}</span><span class="item-title">${it.categoryEmoji || ''} ${it.title}</span></div>`).join('') : '<div style="text-align:center;padding:14px;color:var(--text-tertiary);font-size:12px">No schedule for this day</div>';
    det.style.display = '';
  }
  function changeMonth(d) { S.calMonth += d; if (S.calMonth > 11) { S.calMonth = 0; S.calYear++ } else if (S.calMonth < 0) { S.calMonth = 11; S.calYear-- } renderCalendar(); document.getElementById('dayDetail').style.display = 'none' }

  // =================== ANALYTICS ===================
  function renderAnalytics() {
    animateValue(document.getElementById('aStatTotalGoals'), S.analytics.totalCreated);
    animateValue(document.getElementById('aStatTotalCompleted'), S.analytics.totalCompleted);
    animateValue(document.getElementById('aStatBestStreak'), S.bestStreak);
    drawBarChart('tasksChart', 7, 'Tasks', S.analytics.dailyCompleted, '#818cf8');
    drawBarChart('focusChart', 7, 'Min', S.analytics.dailyFocus, '#67e8f9');
    drawCategoryChart();
    drawHabitChart();
  }

  function drawBarChart(canvasId, days, label, data, color) {
    const canvas = document.getElementById(canvasId); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr; canvas.height = 180 * dpr;
    ctx.scale(dpr, dpr);
    const w = canvas.offsetWidth, h = 180, pad = 36, bw = (w - pad * 2) / days - 6;
    ctx.clearRect(0, 0, w, h);
    const keys = []; for (let i = days - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`) };
    const vals = keys.map(k => data[k] || 0);
    const max = Math.max(...vals, 1);
    keys.forEach((k, i) => {
      const v = vals[i], bh = Math.max(2, (v / max) * (h - pad * 2)), x = pad + i * (bw + 6), y = h - pad - bh;
      const grad = ctx.createLinearGradient(x, y, x, h - pad);
      grad.addColorStop(0, color); grad.addColorStop(1, color + '22');
      ctx.fillStyle = grad; ctx.beginPath();
      // compatibility: use rect if roundRect unavailable
      if (ctx.roundRect) { ctx.roundRect(x, y, bw, bh, 3); ctx.fill() }
      else { ctx.fillRect(x, y, bw, bh) }
      ctx.fillStyle = S.theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
      ctx.font = '9px Inter'; ctx.textAlign = 'center';
      ctx.fillText(k.slice(5), x + bw / 2, h - pad + 12);
      if (v > 0) ctx.fillText(v, x + bw / 2, y - 5);
    });
  }

  function drawCategoryChart() {
    const canvas = document.getElementById('categoryChart'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr; canvas.height = 180 * dpr;
    ctx.scale(dpr, dpr);
    const w = canvas.offsetWidth, h = 180, cx = w / 2, cy = h / 2, r = 65;
    ctx.clearRect(0, 0, w, h);
    const cats = { work: 0, health: 0, personal: 0, learning: 0 };
    S.goals.forEach(g => cats[g.category] = (cats[g.category] || 0) + g.duration);
    const total = Object.values(cats).reduce((a, b) => a + b, 0);
    if (!total) { ctx.fillStyle = S.theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'; ctx.font = '12px Inter'; ctx.textAlign = 'center'; ctx.fillText('No data yet', cx, cy); return }
    const colors = { work: '#818cf8', health: '#34d399', personal: '#c084fc', learning: '#fbbf24' };
    let angle = -Math.PI / 2;
    Object.entries(cats).forEach(([cat, val]) => {
      if (!val) return;
      const slice = (val / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, angle, angle + slice); ctx.closePath();
      ctx.fillStyle = colors[cat]; ctx.fill();
      const mid = angle + slice / 2;
      const lx = cx + Math.cos(mid) * (r + 18), ly = cy + Math.sin(mid) * (r + 18);
      ctx.fillStyle = S.theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
      ctx.font = '9px Inter'; ctx.textAlign = 'center';
      ctx.fillText(`${cat} ${Math.round(val / total * 100)}%`, lx, ly);
      angle += slice;
    });
    const bg = S.theme === 'dark' ? '#06060f' : '#f0f0fa';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.fillStyle = bg; ctx.fill();
  }

  function drawHabitChart() {
    const canvas = document.getElementById('habitChart'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr; canvas.height = 180 * dpr;
    ctx.scale(dpr, dpr);
    const w = canvas.offsetWidth, h = 180;
    ctx.clearRect(0, 0, w, h);
    if (!S.habits.length) { ctx.fillStyle = S.theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'; ctx.font = '12px Inter'; ctx.textAlign = 'center'; ctx.fillText('No habits yet', w / 2, h / 2); return }
    const bw = Math.min(50, (w - 60) / S.habits.length - 10);
    S.habits.forEach((hab, i) => {
      const total = Object.keys(hab.completedDates).length;
      const created = new Date(hab.createdAt);
      const daysSince = Math.max(1, Math.ceil((Date.now() - created.getTime()) / 86400000));
      const rate = Math.round(total / daysSince * 100);
      const bh = Math.max(3, (rate / 100) * (h - 60));
      const x = 30 + i * (bw + 10), y = h - 35 - bh;
      const grad = ctx.createLinearGradient(x, y, x, h - 35);
      grad.addColorStop(0, '#34d399'); grad.addColorStop(1, '#34d39922');
      ctx.fillStyle = grad; ctx.fillRect(x, y, bw, bh);
      ctx.fillStyle = S.theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
      ctx.font = '8px Inter'; ctx.textAlign = 'center';
      ctx.fillText(hab.icon + ' ' + hab.name.slice(0, 7), x + bw / 2, h - 22);
      ctx.fillText(rate + '%', x + bw / 2, y - 4);
    });
  }

  // =================== POMODORO ===================
  const POMO_TIMES = { work: 25 * 60, short: 5 * 60, long: 15 * 60 };
  function renderPomoTaskSelect() {
    const sel = document.getElementById('pomoTaskSelect');
    sel.innerHTML = '<option value="">— Link to a goal —</option>' + S.goals.filter(g => !g.completed).map(g => `<option value="${g.id}">${g.title}</option>`).join('');
    sel.value = S.pomo.linkedGoal;
  }
  function setPomoMode(mode) {
    S.pomo.mode = mode;
    if (S.pomo.running) pomoStop();
    S.pomo.timeLeft = POMO_TIMES[mode];
    updatePomoDisplay();
    document.querySelectorAll('.pomo-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    const ring = document.getElementById('pomoRing');
    if (ring) ring.classList.toggle('on-break', mode !== 'work');
  }
  function pomoToggle() { if (S.pomo.running) pomoStop(); else pomoStart() }
  function pomoStart() {
    S.pomo.running = true;
    document.getElementById('pomoStartBtn').textContent = '⏸ Pause';
    S.pomo.linkedGoal = document.getElementById('pomoTaskSelect').value;
    pomoInterval = setInterval(() => {
      S.pomo.timeLeft--;
      if (S.pomo.timeLeft <= 0) {
        pomoStop(); playSound('timer');
        if (S.pomo.mode === 'work') {
          S.pomo.sessions++; S.pomo.totalMin += POMO_TIMES.work / 60;
          awardXP(15, 'Pomodoro');
          save(); toast('🍅 Pomodoro complete! Take a break.', 'success');
          setPomoMode(S.pomo.sessions % 4 === 0 ? 'long' : 'short');
          if (S.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('🍅 Pomodoro Complete!', { body: 'Great work! Time for a break.' });
          }
        } else { toast('Break over! Ready for another session?', 'info'); setPomoMode('work') }
      }
      updatePomoDisplay();
    }, 1000);
  }
  function pomoStop() { S.pomo.running = false; clearInterval(pomoInterval); document.getElementById('pomoStartBtn').textContent = '▶ Start' }
  function pomoReset() { pomoStop(); S.pomo.timeLeft = POMO_TIMES[S.pomo.mode]; updatePomoDisplay() }
  function updatePomoDisplay() {
    const m = Math.floor(S.pomo.timeLeft / 60), s = S.pomo.timeLeft % 60;
    document.getElementById('pomoDisplay').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    const total = POMO_TIMES[S.pomo.mode], pct = (total - S.pomo.timeLeft) / total;
    const circ = 2 * Math.PI * 120;
    document.getElementById('pomoRing').setAttribute('stroke-dashoffset', circ - (circ * pct));
    document.getElementById('pomoSessions').textContent = S.pomo.sessions;
    document.getElementById('pomoTotalMin').textContent = S.pomo.totalMin;
    updateFocusTimerDisplay();
  }

  // =================== IMPORT / EXPORT (FIXED) ===================
  function exportData() {
    try {
      const json = JSON.stringify({ goals: S.goals, habits: S.habits, schedule: S.schedule, scheduleCompleted: S.scheduleCompleted, streak: S.streak, bestStreak: S.bestStreak, lastActiveDate: S.lastActiveDate, scheduledDates: S.scheduledDates, analytics: S.analytics, pomo: { sessions: S.pomo.sessions, totalMin: S.pomo.totalMin } }, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `planai-backup-${today()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Data exported successfully!', 'success');
    } catch (e) { toast('Export failed: ' + e.message, 'error') }
  }

  function handleImport(input) {
    const file = input.files && input.files[0];
    if (!file) { toast('No file selected', 'error'); return }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const d = JSON.parse(e.target.result);
        if (d.goals) S.goals = d.goals;
        if (d.habits) S.habits = d.habits;
        if (d.schedule) S.schedule = d.schedule;
        if (d.scheduleCompleted) S.scheduleCompleted = d.scheduleCompleted;
        if (typeof d.streak === 'number') S.streak = d.streak;
        if (typeof d.bestStreak === 'number') S.bestStreak = d.bestStreak;
        if (d.lastActiveDate) S.lastActiveDate = d.lastActiveDate;
        if (d.scheduledDates) S.scheduledDates = d.scheduledDates;
        if (d.analytics) S.analytics = { ...S.analytics, ...d.analytics };
        if (d.pomo) { S.pomo.sessions = d.pomo.sessions || 0; S.pomo.totalMin = d.pomo.totalMin || 0 }
        save(); toast('Data imported successfully!', 'success');
        switchView(S.currentView);
      } catch (err) { toast('Invalid file format', 'error') }
    };
    reader.readAsText(file);
    input.value = ''; // reset
  }

  // =================== KEYBOARD SHORTCUTS ===================
  function showShortcuts() { document.getElementById('shortcutsModal').classList.add('show') }
  function closeShortcuts() { document.getElementById('shortcutsModal').classList.remove('show') }

  function handleKeyboard(e) {
    if (e.target.id !== 'cmdInput' && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggleCommandPalette();
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'escape') { closeShortcuts(); if(typeof closeCommandPalette !== 'undefined') closeCommandPalette(); document.getElementById('addGoalForm').style.display = 'none'; document.getElementById('addHabitForm').style.display = 'none'; return }
    if (k === '?' || k === '/') { e.preventDefault(); showShortcuts(); return }
    if (k === '1') switchView('dashboard');
    else if (k === '2') switchView('goals');
    else if (k === '3') switchView('schedule');
    else if (k === '4') switchView('habits');
    else if (k === '5') switchView('calendar');
    else if (k === '6') switchView('analytics');
    else if (k === '7') switchView('pomodoro');
    else if (k === 'n') { switchView('goals'); setTimeout(toggleGoalForm, 100) }
    else if (k === 'g') generateSchedule();
    else if (k === 't') toggleTheme();
    else if (k === 'f') toggleFocusMode();
  }

  // =================== COMMAND PALETTE ===================
  let cmdSelIndex = 0;
  function toggleCommandPalette() {
    const pal = document.getElementById('commandPalette');
    if (!pal) return;
    if (pal.classList.contains('show')) closeCommandPalette();
    else {
      pal.classList.add('show');
      const input = document.getElementById('cmdInput');
      input.value = '';
      setTimeout(() => input.focus(), 100);
      renderCmdResults();
    }
  }
  function closeCommandPalette() {
    const pal = document.getElementById('commandPalette');
    if (pal) pal.classList.remove('show');
    const input = document.getElementById('cmdInput');
    if (input) input.blur();
  }
  function executeCommand(cmd) {
    closeCommandPalette();
    if (cmd.action) cmd.action();
    else if (cmd.addGoal) {
      const p = parseNaturalGoal(cmd.text);
      addGoal(p.title, p._hasDur ? p.duration : 30, p._hasPri ? p.priority : 'medium', p._hasCat ? p.category : 'work', p.urgent, 'none', '');
    }
  }
  function renderCmdResults() {
    const input = document.getElementById('cmdInput').value.toLowerCase();
    const resEl = document.getElementById('cmdResults');
    const commands = [
      { id: '1', title: 'Dashboard', icon: '📊', action: () => switchView('dashboard') },
      { id: '2', title: 'Goals', icon: '🎯', action: () => switchView('goals') },
      { id: '3', title: 'AI Schedule', icon: '🤖', action: () => switchView('schedule') },
      { id: '4', title: 'Habits', icon: '✨', action: () => switchView('habits') },
      { id: '5', title: 'Calendar', icon: '📅', action: () => switchView('calendar') },
      { id: 't', title: 'Toggle Theme', icon: '🌙', action: toggleTheme },
      { id: 'f', title: 'Focus Mode', icon: '🎧', action: toggleFocusMode },
      { id: 'g', title: 'Generate Schedule', icon: '⚡', action: generateSchedule }
    ];
    let filtered = commands.filter(c => c.title.toLowerCase().includes(input));
    if (input.length > 2 && filtered.length === 0) {
      filtered.push({ title: `Add Goal: "${input}"`, icon: '✨', addGoal: true, text: input });
    }
    if (filtered.length === 0) { resEl.innerHTML = '<div style="padding:10px;text-align:center;color:var(--text-tertiary)">No matches found</div>'; return; }
    cmdSelIndex = Math.max(0, Math.min(cmdSelIndex, filtered.length - 1));
    resEl.innerHTML = filtered.map((c, i) => `
      <div class="cmd-item ${i === cmdSelIndex ? 'selected' : ''}" data-index="${i}">
        <span class="cmd-item-icon">${c.icon}</span>
        <span class="cmd-item-label">${c.title}</span>
        ${c.id ? `<span class="cmd-item-shortcut">${c.id.toUpperCase()}</span>` : ''}
      </div>
    `).join('');
    
    const items = resEl.querySelectorAll('.cmd-item');
    items.forEach(el => {
      el.addEventListener('click', () => executeCommand(filtered[parseInt(el.dataset.index)]));
      el.addEventListener('mouseenter', () => { cmdSelIndex = parseInt(el.dataset.index); renderCmdResults(); });
    });
  }

  function initCommandPalette() {
    const input = document.getElementById('cmdInput');
    if (!input) return;
    input.addEventListener('input', () => { cmdSelIndex = 0; renderCmdResults(); });
    input.addEventListener('keydown', e => {
      const items = document.querySelectorAll('.cmd-item');
      if (items.length === 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); cmdSelIndex = (cmdSelIndex + 1) % items.length; renderCmdResults(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cmdSelIndex = (cmdSelIndex - 1 + items.length) % items.length; renderCmdResults(); }
      else if (e.key === 'Enter') { 
        e.preventDefault(); 
        const sel = document.querySelector('.cmd-item.selected');
        if (sel) sel.click(); 
      }
    });
    document.getElementById('commandPalette').addEventListener('click', e => {
      if (e.target.id === 'commandPalette') closeCommandPalette();
    });
  }

  // =================== RECURRING ===================
  function processRecurringGoals() {
    const td = today();
    S.goals.forEach(g => {
      if (g.recurrence !== 'none' && g.completed) {
        const d = g.completedAt || g.createdAt;
        if (d && d.slice(0, 10) !== td) { g.completed = false; delete g.completedAt }
      }
    });
    save();
  }

  // =================== NATURAL LANGUAGE PARSER ===================
  function parseNaturalGoal(text) {
    const r = { title: text, duration: 30, priority: 'medium', category: 'work', urgent: false, _hasDur: false, _hasPri: false, _hasCat: false };
    let c = text;
    const durPats = [[/\bfor\s+(\d+\.?\d*)\s*(hours?|hrs?|h)\b/i, 60], [/\bfor\s+(\d+)\s*(min(?:utes?)?|m)\b/i, 1], [/(\d+\.?\d*)\s*(hours?|hrs?|h)\b/i, 60], [/(\d+)\s*(min(?:utes?)?|m)\b/i, 1]];
    for (const [rx, mult] of durPats) { const m = c.match(rx); if (m) { r.duration = Math.round(parseFloat(m[1]) * mult); r._hasDur = true; c = c.replace(m[0], ' '); break; } }
    if (/\b(high|critical)\b/i.test(c)) { r.priority = 'high'; r._hasPri = true; c = c.replace(/\b(high|critical)\s*(priority|pri)?\b/i, ' '); }
    else if (/\b(low|easy|chill)\b/i.test(c)) { r.priority = 'low'; r._hasPri = true; c = c.replace(/\b(low|easy|chill)\s*(priority|pri)?\b/i, ' '); }
    else if (/\b(med(?:ium)?|normal)\s*(priority|pri)?\b/i.test(c)) { r._hasPri = true; c = c.replace(/\b(med(?:ium)?|normal)\s*(priority|pri)?\b/i, ' '); }
    if (/\b(health|exercise|gym|workout|jog|run(?:ning)?|yoga|fitness|walk)\b/i.test(c)) { r.category = 'health'; r._hasCat = true; c = c.replace(/\b(health|exercise|gym|workout|fitness)\b/i, ' '); }
    else if (/\b(learn(?:ing)?|study|course|tutorial|research)\b/i.test(c)) { r.category = 'learning'; r._hasCat = true; }
    else if (/\b(personal|home|family|errand|chore|clean)\b/i.test(c)) { r.category = 'personal'; r._hasCat = true; c = c.replace(/\b(personal|home|family|errand|chore)\b/i, ' '); }
    if (/\b(urgent|asap|immediately)\b/i.test(c)) { r.urgent = true; c = c.replace(/\b(urgent|asap|immediately)\b/i, ' '); }
    r.title = c.replace(/\b(priority|pri)\b/i, '').replace(/\s+/g, ' ').trim() || text;
    return r;
  }

  function updateNLPPreview() {
    const input = document.getElementById('quickGoalTitle');
    const preview = document.getElementById('nlpPreview');
    const parsed = document.getElementById('nlpParsedText');
    if (!input || !preview || !parsed) return;
    const text = input.value.trim();
    if (text.length < 3) { preview.style.display = 'none'; return; }
    const p = parseNaturalGoal(text);
    if (!p._hasDur && !p._hasPri && !p._hasCat && !p.urgent) { preview.style.display = 'none'; return; }
    const emoji = AIScheduler.CATEGORY_EMOJI[p.category] || '\ud83d\udccb';
    const priC = { high: '\ud83d\udd34', medium: '\ud83d\udfe1', low: '\ud83d\udfe2' };
    let parts = [`<strong>"${p.title}"</strong>`];
    if (p._hasDur) parts.push(`\u23f1\ufe0f ${durLabel(p.duration)}`);
    if (p._hasPri) parts.push(`${priC[p.priority]} ${p.priority}`);
    if (p._hasCat) parts.push(`${emoji} ${p.category}`);
    if (p.urgent) parts.push('\u26a1 urgent');
    parsed.innerHTML = parts.join(' \u00b7 ');
    preview.style.display = 'flex';
  }

  // =================== FOCUS MODE ===================
  function createNoiseBuffer(ctx, seconds, type) {
    const sr = ctx.sampleRate, buf = ctx.createBuffer(2, sr * seconds, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random()*2-1;
        if (type==='rain') { b0=(b0+0.02*w)/1.02; d[i]=b0*3.5; }
        else if (type==='cafe') { b0=.99886*b0+w*.0555179; b1=.99332*b1+w*.0750759; b2=.969*b2+w*.153852; b3=.8665*b3+w*.3104856; b4=.55*b4+w*.5329522; b5=-.7616*b5-w*.016898; d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11; b6=w*.115926; }
        else if (type==='lofi') { b0=b0*.997+w*.003; d[i]=b0*8*(.8+.2*Math.sin(i/sr*.5*Math.PI)); }
        else { b0=(b0+.04*w)/1.04; d[i]=b0*2.5+(Math.random()>.9997?Math.sin(i/sr*(3000+2000*Math.random())*Math.PI)*.03:0); }
      }
    }
    return buf;
  }

  function toggleFocusAmbient(type) {
    if (ambientState.type===type && ambientState.source) { ambientState.source.stop(); ambientState.source=null; ambientState.type=null; document.querySelectorAll('.ambient-btn').forEach(b=>b.classList.remove('active')); return; }
    if (ambientState.source) { try{ambientState.source.stop();}catch(e){} ambientState.source=null; }
    if (!ambientState.ctx) ambientState.ctx = new (window.AudioContext||window.webkitAudioContext)();
    const ctx=ambientState.ctx, buf=createNoiseBuffer(ctx,4,type), src=ctx.createBufferSource();
    src.buffer=buf; src.loop=true;
    const gain=ctx.createGain(); gain.gain.value=0.25;
    const filt=ctx.createBiquadFilter();
    if (type==='rain'){filt.type='lowpass';filt.frequency.value=700;} else if(type==='cafe'){filt.type='bandpass';filt.frequency.value=1200;filt.Q.value=0.5;} else if(type==='lofi'){filt.type='lowpass';filt.frequency.value=350;} else{filt.type='lowpass';filt.frequency.value=1800;}
    src.connect(filt); filt.connect(gain); gain.connect(ctx.destination); src.start();
    ambientState.source=src; ambientState.gain=gain; ambientState.type=type;
    document.querySelectorAll('.ambient-btn').forEach(b=>b.classList.toggle('active',b.dataset.sound===type));
  }

  function enterFocusMode() {
    S.focusMode=true; document.getElementById('focusOverlay').style.display='flex'; document.body.style.overflow='hidden';
    const active=S.schedule.find(it=>!it.isBreak&&!S.scheduleCompleted[it.id]);
    document.getElementById('focusTaskLabel').textContent=active?`${active.categoryEmoji||''} ${active.title}`:'\ud83c\udfaf Focus Mode';
    const qi=dayOfYear()%QUOTES.length;
    document.getElementById('focusQuote').textContent=`"${QUOTES[qi].t}" \u2014 ${QUOTES[qi].a}`;
    updateFocusTimerDisplay();
  }
  function exitFocusMode() {
    S.focusMode=false; document.getElementById('focusOverlay').style.display='none'; document.body.style.overflow='';
    if(ambientState.source){try{ambientState.source.stop();}catch(e){}ambientState.source=null;ambientState.type=null;}
    document.querySelectorAll('.ambient-btn').forEach(b=>b.classList.remove('active'));
  }
  function toggleFocusMode() { S.focusMode ? exitFocusMode() : enterFocusMode(); }
  function updateFocusTimerDisplay() {
    const el=document.getElementById('focusTimerDisplay');
    if(el&&S.focusMode){const m=Math.floor(S.pomo.timeLeft/60),s=S.pomo.timeLeft%60;el.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
  }

  // =================== XP & LEVELING ===================
  const XP_LEVELS = [
    {name:'Beginner',icon:'\ud83c\udf31',min:0},{name:'Planner',icon:'\ud83d\udcdd',min:100},
    {name:'Organizer',icon:'\ud83d\udccb',min:300},{name:'Strategist',icon:'\ud83c\udfaf',min:600},
    {name:'Master',icon:'\u2b50',min:1000},{name:'Legend',icon:'\ud83c\udfc6',min:2000},{name:'Grandmaster',icon:'\ud83d\udc51',min:5000}
  ];
  function getLevel(xp) { let lv=0; for(let i=XP_LEVELS.length-1;i>=0;i--){if(xp>=XP_LEVELS[i].min){lv=i;break;}} return lv; }
  function awardXP(amount, reason) {
    const oldLv=getLevel(S.xp); S.xp+=amount; S.level=getLevel(S.xp); save();
    showXPFloat(amount);
    if(S.level>oldLv){const lv=XP_LEVELS[S.level];toast(`\ud83c\udf89 Level Up! ${lv.icon} ${lv.name}!`,'success');setTimeout(launchConfetti,200);}
    renderXPBar();
  }
  function showXPFloat(amount) {
    const el=document.createElement('div');el.className='xp-float';el.textContent=`+${amount} XP`;
    document.body.appendChild(el);setTimeout(()=>el.remove(),1500);
  }
  function renderXPBar() {
    const lv=XP_LEVELS[S.level],next=XP_LEVELS[S.level+1];
    const badge=document.getElementById('levelBadge'),fill=document.getElementById('xpBarFill');
    const cur=document.getElementById('xpCurrent'),nxt=document.getElementById('xpNext');
    if(badge)badge.textContent=`${lv.icon} ${lv.name}`;
    if(next){const pct=((S.xp-lv.min)/(next.min-lv.min))*100;if(fill)fill.style.width=Math.min(pct,100)+'%';if(cur)cur.textContent=S.xp-lv.min;if(nxt)nxt.textContent=next.min-lv.min;}
    else{if(fill)fill.style.width='100%';if(cur)cur.textContent=S.xp;if(nxt)nxt.textContent='\u221e';}
  }

  // =================== NOTIFICATIONS ===================
  function requestNotifications() {
    if(!('Notification' in window)){toast('Notifications not supported','error');return;}
    if(Notification.permission==='granted'){S.notificationsEnabled=!S.notificationsEnabled;toast(S.notificationsEnabled?'Notifications enabled \ud83d\udd14':'Notifications paused \ud83d\udd15','info');updateNotifUI();save();return;}
    if(Notification.permission==='denied'){toast('Notifications blocked by browser. Enable in site settings.','error');return;}
    Notification.requestPermission().then(p=>{if(p==='granted'){S.notificationsEnabled=true;toast('Notifications enabled! \ud83d\udd14','success');updateNotifUI();save();startNotifChecker();}else{toast('Notifications denied','error');}});
  }
  function updateNotifUI() {
    const dot=document.getElementById('notifDot'),label=document.getElementById('notifLabel');
    if(dot)dot.className='notif-dot'+(S.notificationsEnabled?' active':'');
    if(label)label.textContent=S.notificationsEnabled?'On':'Notify';
  }
  function startNotifChecker() {
    if(notifCheckInterval)clearInterval(notifCheckInterval);
    notifCheckInterval=setInterval(()=>{
      if(!S.notificationsEnabled||!S.schedule.length)return;
      const now=new Date(),h=now.getHours(),m=now.getMinutes();
      S.schedule.forEach(it=>{
        if(it.isBreak||S.scheduleCompleted[it.id])return;
        if(it.startHour===h&&it.startMin>=m&&it.startMin<=m+5){
          new Notification(`\u23f0 Starting soon: ${it.title}`,{body:`${it.startFormatted} - ${it.endFormatted}`,tag:it.id});
        }
      });
    },60000);
  }

  // =================== PRODUCTIVITY SCORE ===================
  function calculateProductivityScore() {
    const td=today();
    const totalGoals=S.goals.length, doneGoals=S.goals.filter(g=>g.completed).length;
    const goalScore=totalGoals>0?Math.round((doneGoals/totalGoals)*40):0;
    const focusMin=(S.analytics.dailyFocus[td]||0)+S.pomo.totalMin;
    const focusScore=Math.round(Math.min(focusMin/120,1)*20);
    const totalHabits=S.habits.length, doneHabits=S.habits.filter(h=>h.completedDates[td]).length;
    const habitScore=totalHabits>0?Math.round((doneHabits/totalHabits)*20):0;
    const streakScore=Math.round(Math.min(S.streak/7,1)*10);
    const schedDone=S.schedule.filter(x=>!x.isBreak).length?Math.round(Object.values(S.scheduleCompleted).filter(Boolean).length/Math.max(S.schedule.filter(x=>!x.isBreak).length,1)*10):0;
    const total=Math.min(goalScore+focusScore+habitScore+streakScore+schedDone,100);
    S.productivityScores[td]=total; save();
    return {total,goalScore,focusScore,habitScore,streakScore,schedDone};
  }
  function renderProductivityScore() {
    const s=calculateProductivityScore();
    const el=document.getElementById('scoreValue'),fill=document.getElementById('scoreFill'),bd=document.getElementById('scoreBreakdown');
    if(el)el.textContent=s.total;
    if(fill){
      const circ=2*Math.PI*52, offset=circ-(circ*s.total/100);
      fill.setAttribute('stroke-dashoffset',offset);
      const color=s.total>=71?'var(--success)':s.total>=41?'var(--warning)':'var(--danger)';
      fill.setAttribute('stroke',color);
      if(el)el.style.color=color;
    }
    if(bd)bd.innerHTML=[
      `<span class="score-chip">\ud83c\udfaf Goals ${s.goalScore}/40</span>`,
      `<span class="score-chip">\u23f1\ufe0f Focus ${s.focusScore}/20</span>`,
      `<span class="score-chip">\u2728 Habits ${s.habitScore}/20</span>`,
      `<span class="score-chip">\ud83d\udd25 Streak ${s.streakScore}/10</span>`,
      `<span class="score-chip">\ud83d\udcc5 Schedule ${s.schedDone}/10</span>`
    ].join('');
  }

  // =================== INIT ===================
  function init() {
    // Cursor glow tracking globally
    document.addEventListener('mousemove', e => {
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    });

    // Premium Floating Light Effect
    document.querySelectorAll(".premium-card").forEach(card => {
      card.addEventListener("mousemove", e => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--x", `${e.clientX - rect.left}px`);
        card.style.setProperty("--y", `${e.clientY - rect.top}px`);
      });
    });

    initCommandPalette();

    load();
    updateStreak();
    processRecurringGoals();
    applyTheme(S.theme);
    S.pomo.timeLeft = POMO_TIMES[S.pomo.mode];
    document.getElementById('dateDisplay').textContent = fmtDate(new Date());

    // Nav clicks
    document.querySelectorAll('.nav-item').forEach(i => i.addEventListener('click', () => switchView(i.dataset.view)));
    document.querySelectorAll('.mobile-nav-item[data-view]').forEach(i => i.addEventListener('click', () => switchView(i.dataset.view)));
    
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) menuToggle.addEventListener('click', openMobileMenu);
    document.getElementById('sidebarOverlay').addEventListener('click', closeMobileMenu);

    // Quick add
    document.getElementById('quickAddForm').addEventListener('submit', e => {
      e.preventDefault(); const t = document.getElementById('quickGoalTitle');
      if (t.value.trim()) {
        const p = parseNaturalGoal(t.value.trim());
        const dur = p._hasDur ? p.duration : document.getElementById('quickGoalDuration').value;
        const pri = p._hasPri ? p.priority : document.getElementById('quickGoalPriority').value;
        const cat = p._hasCat ? p.category : 'work';
        addGoal(p.title, dur, pri, cat, p.urgent, 'none', '');
        t.value = ''; const prev = document.getElementById('nlpPreview'); if(prev) prev.style.display='none';
      }
    });

    // Goal form - priority
    document.querySelectorAll('#prioritySelector .priority-btn').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('#prioritySelector .priority-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); S.selPriority = b.dataset.priority;
    }));
    // Goal form - difficulty
    document.querySelectorAll('#difficultySelector .difficulty-btn').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('#difficultySelector .difficulty-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); S.selDifficulty = b.dataset.difficulty;
      // Update auto-duration hint
      const hint = document.getElementById('difficultyHint');
      const autoDur = AIScheduler.DIFFICULTY_DURATION[b.dataset.difficulty] || 30;
      if (hint) hint.textContent = `\u23f1\ufe0f Auto: ${autoDur} min`;
      // Auto-set duration dropdown
      const durSel = document.getElementById('goalDuration');
      if (durSel) {
        const closest = [...durSel.options].reduce((best, opt) => 
          Math.abs(parseInt(opt.value) - autoDur) < Math.abs(parseInt(best.value) - autoDur) ? opt : best
        );
        durSel.value = closest.value;
      }
    }));
    document.getElementById('goalForm').addEventListener('submit', e => {
      e.preventDefault(); const t = document.getElementById('goalTitle');
      if (t.value.trim()) {
        addGoal(t.value.trim(), document.getElementById('goalDuration').value, S.selPriority,
          document.getElementById('goalCategory').value, document.getElementById('goalUrgent').value,
          document.getElementById('goalRecurrence').value, document.getElementById('goalNotes').value, S.selDifficulty);
        t.value = ''; document.getElementById('goalNotes').value = ''; toggleGoalForm();
      }
    });

    // Habits form
    document.getElementById('habitForm').addEventListener('submit', e => {
      e.preventDefault(); const n = document.getElementById('habitName');
      if (n.value.trim()) { addHabit(n.value.trim(), document.getElementById('habitIcon').value); n.value = ''; toggleHabitForm() }
    });

    // Pomodoro
    document.querySelectorAll('.pomo-mode-btn').forEach(b => b.addEventListener('click', () => setPomoMode(b.dataset.mode)));

    // Keyboard
    document.addEventListener('keydown', handleKeyboard);

    // Drag & Drop (goals board)
    setTimeout(setupDragDrop, 500);
    // Schedule drag & drop is set up inside renderSchedule()

    // PWA
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });

    // Weather
    fetchWeather();

    // Render
    renderDashboard(); renderGoals(); renderSchedule(); renderHabits(); renderCalendar();
    updatePomoDisplay();

    // NLP preview listener
    const nlpInput = document.getElementById('quickGoalTitle');
    if (nlpInput) nlpInput.addEventListener('input', updateNLPPreview);

    // Notifications
    if (S.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') { updateNotifUI(); startNotifChecker(); }
    updateNotifUI();

    // XP bar
    renderXPBar();

    // Streak XP
    if (S.streak > 0) { const streakXP = Math.min(S.streak, 30) * 10; /* passive, no award on load */ }

    // Update focus timer in sync with pomodoro
    const origUpdate = updatePomoDisplay;
    const patchedUpdate = () => { origUpdate(); updateFocusTimerDisplay(); };
    // Patch the interval callback indirectly via the existing pomoInterval
  }

  return {
    init, switchView,
    addGoal, deleteGoal, toggleGoalComplete, toggleGoalForm, toggleGoalExpand, cycleGoalView, toggleMatrixView,
    addSubtask, toggleSubtask, dragStart,
    generateSchedule, toggleScheduleComplete, exportICS, shareSchedule, rescheduleMissed,
    recoverDayMode,
    addHabit, deleteHabit, toggleHabitToday, toggleHabitForm,
    showDayDetail, changeMonth,
    pomoToggle, pomoReset,
    showShortcuts, closeShortcuts,
    toggleTheme, exportData, handleImport,
    toggleFocusMode, enterFocusMode, exitFocusMode, toggleFocusAmbient,
    signInWithGoogle, signOut,
    startTaskFocus, closeTaskFocus, toggleTaskFocusPause,
    sendCoachMessage, toggleCoachBox, openMobileMenu, closeMobileMenu
  };
})();

document.addEventListener('DOMContentLoaded', app.init);

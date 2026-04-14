/* ============================================
   AI SCHEDULER v2 — Enhanced Scheduling
   ============================================ */
const AIScheduler = (() => {
  const ENERGY = { 6: .35, 7: .5, 8: .7, 9: .9, 10: 1, 11: .95, 12: .6, 13: .5, 14: .55, 15: .65, 16: .75, 17: .7, 18: .6, 19: .55, 20: .5, 21: .4, 22: .3 };
  const PW = { high: 3, medium: 2, low: 1 };
  const CAT_EMOJI = { work: '💼', health: '💪', personal: '🏠', learning: '📚' };

  function getEnergy(h) { return ENERGY[h] || 0.25 }
  function fmt(h, m) { const hh = h % 12 || 12; return `${hh}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }

  function generateSchedule(goals) {
    if (!goals || !goals.length) return [];
    const sorted = [...goals].filter(g => !g.completed).sort((a, b) => {
      const pw = PW[b.priority] - PW[a.priority];
      if (pw) return pw;
      return b.duration - a.duration;
    });
    const slots = [];
    for (let h = 6; h < 22; h++) for (let m = 0; m < 60; m += 15) slots.push({ h, m, energy: getEnergy(h), tid: null, brk: false });

    const schedule = [];
    for (const g of sorted) {
      const need = Math.ceil(g.duration / 15);
      let bestI = -1, bestS = -Infinity;
      for (let i = 0; i <= slots.length - need; i++) {
        let ok = true, te = 0;
        for (let j = 0; j < need; j++) { if (slots[i + j].tid || slots[i + j].brk) { ok = false; break } te += slots[i + j].energy }
        if (!ok) continue;
        const ae = te / need;
        let sc = g.priority === 'high' ? ae * 3 : g.priority === 'medium' ? ae * 1.5 : (1.2 - ae) * 1.5;
        sc -= (i / slots.length) * 0.1;
        if (g.category === 'health' && (slots[i].h <= 8 || slots[i].h >= 17)) sc += 0.5;
        if (sc > bestS) { bestS = sc; bestI = i }
      }
      if (bestI >= 0) {
        for (let j = 0; j < need; j++) slots[bestI + j].tid = g.id;
        const s = slots[bestI], ei = bestI + need - 1, e = slots[ei], em = e.m + 15;
        schedule.push({
          ...g, startHour: s.h, startMin: s.m, endHour: em >= 60 ? e.h + 1 : e.h, endMin: em % 60,
          startFormatted: fmt(s.h, s.m), endFormatted: fmt(em >= 60 ? e.h + 1 : e.h, em % 60), isBreak: false, categoryEmoji: CAT_EMOJI[g.category] || '📋'
        });
        if (g.duration >= 45 && ei + 1 < slots.length && !slots[ei + 1].tid) slots[ei + 1].brk = true;
      }
    }
    schedule.sort((a, b) => (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin));

    const wb = [];
    for (let i = 0; i < schedule.length; i++) {
      wb.push(schedule[i]);
      if (i < schedule.length - 1) {
        const ce = schedule[i].endHour * 60 + schedule[i].endMin, ns = schedule[i + 1].startHour * 60 + schedule[i + 1].startMin, gap = ns - ce;
        if (gap >= 10) {
          const lbl = gap >= 20 && ce >= 720 && ce <= 870 ? '🍽️ Lunch Break' : gap >= 20 ? '🧘 Recharge' : '☕ Short Break';
          const dur = Math.min(gap, lbl.includes('Lunch') ? 45 : 15);
          wb.push({
            id: `brk-${i}`, title: lbl, isBreak: true, duration: dur,
            startHour: Math.floor(ce / 60), startMin: ce % 60, endHour: Math.floor((ce + dur) / 60), endMin: (ce + dur) % 60,
            startFormatted: fmt(Math.floor(ce / 60), ce % 60), endFormatted: fmt(Math.floor((ce + dur) / 60), (ce + dur) % 60), categoryEmoji: lbl.split(' ')[0]
          });
        }
      }
    }
    return wb;
  }

  function exportToICS(schedule, date) {
    const y = date.getFullYear(), mo = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
    let ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PlanAI//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    for (const item of schedule) {
      if (item.isBreak) continue;
      ics.push('BEGIN:VEVENT', `DTSTART:${y}${mo}${d}T${String(item.startHour).padStart(2, '0')}${String(item.startMin).padStart(2, '0')}00`,
        `DTEND:${y}${mo}${d}T${String(item.endHour).padStart(2, '0')}${String(item.endMin).padStart(2, '0')}00`,
        `SUMMARY:${item.title}`, `DESCRIPTION:${item.category || 'general'} | ${item.priority || 'medium'}`,
        `UID:${item.id}-${y}${mo}${d}@planai`, 'END:VEVENT');
    }
    ics.push('END:VCALENDAR');
    return ics.join('\r\n');
  }

  function getInsights(goals) {
    const tips = [], tot = goals.reduce((s, g) => s + g.duration, 0), hc = goals.filter(g => g.priority === 'high').length;
    if (tot > 480) tips.push('⚠️ Over 8 hours of tasks. Consider deferring some to tomorrow.');
    if (hc > 3) tips.push('🎯 Multiple high-priority tasks. Focus on the top 3 first.');
    if (!goals.some(g => g.category === 'health')) tips.push('💪 Don\'t forget to add a health or exercise goal!');
    if (tot === 0) tips.push('✨ Add some goals to get started with your AI-powered schedule!');
    if (tot > 0 && tot <= 120) tips.push('🌟 Light day — great for deep focus or learning something new.');
    if (goals.filter(g => g.urgent).length > 2) tips.push('🔥 Too many urgent tasks. Is everything truly urgent?');
    return tips;
  }

  function generateShareText(schedule, date) {
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    let txt = `📅 My Schedule for ${dateStr}\n${'═'.repeat(40)}\n\n`;
    for (const item of schedule) {
      const check = item.isBreak ? '  ' : ' □';
      txt += `${item.startFormatted.padEnd(10)} ${check} ${item.title} (${item.duration}min)\n`;
    }
    txt += `\n${'═'.repeat(40)}\nGenerated by PlanAI ✨`;
    return txt;
  }

  /**
   * Auto-reschedule missed tasks.
   * A task is "missed" if current time > endTime AND it's not completed.
   * Missed tasks are moved after the last scheduled task, maintaining their duration.
   * @param {Array} schedule - current schedule array
   * @param {Object} completedMap - map of task id => boolean
   * @returns {Array} updated schedule
   */
  function rescheduleTasks(schedule, completedMap) {
    if (!schedule || !schedule.length) return schedule;
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();

    const missed = [];
    const kept = [];

    for (const task of schedule) {
      const taskEndMin = task.endHour * 60 + task.endMin;
      if (!task.isBreak && !completedMap[task.id] && currentMin > taskEndMin) {
        missed.push(task);
      } else {
        kept.push(task);
      }
    }

    if (missed.length === 0) return schedule;

    // Find the end of the last kept non-break task
    let lastEndMin = currentMin;
    for (const t of kept) {
      const endMin = t.endHour * 60 + t.endMin;
      if (endMin > lastEndMin) lastEndMin = endMin;
    }
    // Add a 5-minute buffer
    lastEndMin += 5;

    // Re-slot missed tasks sequentially
    for (const task of missed) {
      const startMin = lastEndMin;
      const endMin = startMin + task.duration;
      // Don't schedule past 10 PM (22:00 = 1320 min)
      if (startMin >= 1320) continue;

      task.startHour = Math.floor(startMin / 60);
      task.startMin = startMin % 60;
      task.endHour = Math.floor(endMin / 60);
      task.endMin = endMin % 60;
      task.startFormatted = fmt(task.startHour, task.startMin);
      task.endFormatted = fmt(task.endHour, task.endMin);
      task.rescheduled = true;

      kept.push(task);
      lastEndMin = endMin + 5; // 5-min gap between rescheduled tasks
    }

    // Re-sort by start time
    kept.sort((a, b) => (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin));
    return kept;
  }

  /**
   * Recalculate times for a schedule after drag-drop reorder.
   * Tasks are laid out sequentially from the earliest start time with 5-min gaps.
   * @param {Array} schedule - reordered schedule
   * @returns {Array} schedule with updated times
   */
  function recalcTimesAfterReorder(schedule) {
    if (!schedule || schedule.length === 0) return schedule;
    let cursor = Math.min(
      schedule[0].startHour * 60 + schedule[0].startMin,
      6 * 60
    );
    for (const task of schedule) {
      const dur = task.duration;
      task.startHour = Math.floor(cursor / 60);
      task.startMin = cursor % 60;
      const endMin = cursor + dur;
      task.endHour = Math.floor(endMin / 60);
      task.endMin = endMin % 60;
      task.startFormatted = fmt(task.startHour, task.startMin);
      task.endFormatted = fmt(task.endHour, task.endMin);
      cursor = endMin + (task.isBreak ? 0 : 5);
    }
    return schedule;
  }

  // =================== DIFFICULTY AUTO-DURATION ===================
  const DIFFICULTY_DURATION = { easy: 25, medium: 45, hard: 60 };

  /**
   * Smart Schedule Generator.
   * Hard tasks → peak hours, adds 5–10 min breaks after every 2 tasks.
   * @param {Array} tasks - [{title, priority, deadline, difficulty, duration, ...}]
   * @param {Object} preferences - {peakHours: "morning"|"evening"}
   * @returns {Array} scheduled tasks with time slots
   */
  function generateSmartSchedule(tasks, preferences) {
    if (!tasks || !tasks.length) return [];
    const peakHours = preferences && preferences.peakHours === 'evening'
      ? [16, 17, 18, 19, 20, 21]
      : [7, 8, 9, 10, 11]; // morning default

    // Sort: hard tasks first (for peak hours), then by priority
    const sorted = [...tasks].filter(t => !t.completed).sort((a, b) => {
      const dw = { hard: 3, medium: 2, easy: 1 };
      const diff = (dw[b.difficulty] || 2) - (dw[a.difficulty] || 2);
      if (diff) return diff;
      return PW[b.priority] - PW[a.priority];
    });

    const slots = [];
    for (let h = 6; h < 22; h++) for (let m = 0; m < 60; m += 15) {
      const isPeak = peakHours.includes(h);
      slots.push({ h, m, energy: getEnergy(h), tid: null, brk: false, isPeak });
    }

    const schedule = [];
    let tasksSinceBreak = 0;

    for (const g of sorted) {
      const dur = g.duration || DIFFICULTY_DURATION[g.difficulty] || 30;
      const need = Math.ceil(dur / 15);
      const isHard = g.difficulty === 'hard' || g.priority === 'high';

      let bestI = -1, bestS = -Infinity;
      for (let i = 0; i <= slots.length - need; i++) {
        let ok = true, te = 0, peakCount = 0;
        for (let j = 0; j < need; j++) {
          if (slots[i + j].tid || slots[i + j].brk) { ok = false; break; }
          te += slots[i + j].energy;
          if (slots[i + j].isPeak) peakCount++;
        }
        if (!ok) continue;

        const ae = te / need;
        let sc = ae * PW[g.priority];
        // Hard tasks get bonus for peak hours
        if (isHard) sc += (peakCount / need) * 2;
        // Easy tasks prefer non-peak
        if (g.difficulty === 'easy') sc += (1 - peakCount / need) * 1.5;
        sc -= (i / slots.length) * 0.1;
        if (sc > bestS) { bestS = sc; bestI = i; }
      }

      if (bestI >= 0) {
        for (let j = 0; j < need; j++) slots[bestI + j].tid = g.id;
        const s = slots[bestI], ei = bestI + need - 1, e = slots[ei], em = e.m + 15;
        schedule.push({
          ...g, duration: dur,
          startHour: s.h, startMin: s.m,
          endHour: em >= 60 ? e.h + 1 : e.h, endMin: em % 60,
          startFormatted: fmt(s.h, s.m),
          endFormatted: fmt(em >= 60 ? e.h + 1 : e.h, em % 60),
          isBreak: false,
          categoryEmoji: CAT_EMOJI[g.category] || '📋'
        });
        tasksSinceBreak++;

        // Add break after every 2 tasks (5-10 min)
        if (tasksSinceBreak >= 2 && ei + 1 < slots.length && !slots[ei + 1].tid) {
          slots[ei + 1].brk = true;
          if (ei + 2 < slots.length && !slots[ei + 2].tid) slots[ei + 2].brk = true;
          tasksSinceBreak = 0;
        }
      }
    }

    schedule.sort((a, b) => (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin));

    // Insert breaks between tasks
    const wb = [];
    for (let i = 0; i < schedule.length; i++) {
      wb.push(schedule[i]);
      if (i < schedule.length - 1) {
        const ce = schedule[i].endHour * 60 + schedule[i].endMin;
        const ns = schedule[i + 1].startHour * 60 + schedule[i + 1].startMin;
        const gap = ns - ce;
        if (gap >= 5) {
          const dur = Math.min(gap, 10);
          const lbl = gap >= 20 && ce >= 720 && ce <= 870 ? '🍽️ Lunch Break' : gap >= 15 ? '🧘 Recharge' : '☕ Quick Break';
          wb.push({
            id: `brk-${i}`, title: lbl, isBreak: true, duration: dur,
            startHour: Math.floor(ce / 60), startMin: ce % 60,
            endHour: Math.floor((ce + dur) / 60), endMin: (ce + dur) % 60,
            startFormatted: fmt(Math.floor(ce / 60), ce % 60),
            endFormatted: fmt(Math.floor((ce + dur) / 60), (ce + dur) % 60),
            categoryEmoji: lbl.split(' ')[0]
          });
        }
      }
    }
    return wb;
  }

  /**
   * Smart Suggestions based on task data patterns.
   * @param {Object} data - { goals, completedCount, totalCount, focusMinutes, habits }
   * @returns {Array} suggestion strings
   */
  function getSuggestions(data) {
    const suggestions = [];
    const { goals, completedCount, totalCount, focusMinutes, habits } = data;
    const rate = totalCount > 0 ? completedCount / totalCount : 0;

    // Low completion rate → suggest lighter schedule
    if (totalCount >= 3 && rate < 0.3) {
      suggestions.push('📉 Low completion rate. Try reducing your daily goals to 3-4 focused tasks.');
    }
    if (totalCount >= 5 && rate < 0.5) {
      suggestions.push('⚡ You have many pending tasks. Break hard tasks into smaller subtasks.');
    }

    // High completion → encourage more
    if (totalCount >= 2 && rate >= 0.8) {
      suggestions.push('🚀 Great completion rate! You have capacity — try adding a stretch goal.');
    }
    if (totalCount > 0 && rate === 1) {
      suggestions.push('🏆 Perfect day! Consider increasing task difficulty tomorrow.');
    }

    // Focus time suggestions
    if (focusMinutes < 30 && totalCount > 0) {
      suggestions.push('🎯 Low focus time today. Try a 25-min Pomodoro session to build momentum.');
    }
    if (focusMinutes >= 120) {
      suggestions.push('⏰ Over 2 hours focused — great work! Remember to take breaks.');
    }

    // Hard task distribution
    const hardTasks = (goals || []).filter(g => g.difficulty === 'hard' && !g.completed);
    if (hardTasks.length >= 3) {
      suggestions.push('🧠 3+ hard tasks today. Consider moving some to tomorrow for better quality.');
    }

    // No tasks
    if (totalCount === 0) {
      suggestions.push('✨ No goals yet! Start with 2-3 tasks to build a productive rhythm.');
    }

    // Habits
    if (habits && habits.length > 0) {
      const todayKey = new Date().toISOString().slice(0, 10);
      const habitsCompleted = habits.filter(h => h.completedDates && h.completedDates[todayKey]).length;
      if (habitsCompleted === 0 && habits.length > 0) {
        suggestions.push('🌱 No habits checked today. Start with the easiest one to build momentum.');
      }
    }

    // Default if nothing applies
    if (suggestions.length === 0) {
      suggestions.push('💪 You\'re on track! Keep up the steady progress.');
    }

    return suggestions;
  }

  /**
   * Day Recovery Mode.
   * Reschedules ALL incomplete tasks into the remaining hours of the day.
   * @param {Array} tasks - all tasks (completed + incomplete)
   * @param {Object} completedMap - map of task id => boolean
   * @returns {Array} new schedule fitting into remaining time
   */
  function recoverDay(tasks, completedMap) {
    if (!tasks || !tasks.length) return [];
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const endOfDay = 22 * 60; // 10 PM

    // Filter only incomplete non-break tasks
    const incomplete = tasks.filter(t => !t.isBreak && !completedMap[t.id]);
    if (incomplete.length === 0) return tasks;

    // Keep completed tasks in place
    const completed = tasks.filter(t => t.isBreak || completedMap[t.id]);

    // Start rescheduling from now (round up to next 15-min slot)
    let cursor = Math.ceil(currentMin / 15) * 15;
    if (cursor < currentMin) cursor += 15;

    // Sort by priority (high first)
    incomplete.sort((a, b) => (PW[b.priority] || 1) - (PW[a.priority] || 1));

    const recovered = [];
    let taskCount = 0;

    for (const task of incomplete) {
      const dur = task.duration || 30;
      if (cursor + dur > endOfDay) continue; // Skip if won't fit

      task.startHour = Math.floor(cursor / 60);
      task.startMin = cursor % 60;
      const endMin = cursor + dur;
      task.endHour = Math.floor(endMin / 60);
      task.endMin = endMin % 60;
      task.startFormatted = fmt(task.startHour, task.startMin);
      task.endFormatted = fmt(task.endHour, task.endMin);
      task.recovered = true;

      recovered.push(task);
      cursor = endMin;
      taskCount++;

      // Add 10-min break after every 2 tasks
      if (taskCount % 2 === 0 && cursor + 10 < endOfDay) {
        const brkStart = cursor;
        const brkEnd = cursor + 10;
        recovered.push({
          id: `rec-brk-${taskCount}`, title: '☕ Recovery Break', isBreak: true, duration: 10,
          startHour: Math.floor(brkStart / 60), startMin: brkStart % 60,
          endHour: Math.floor(brkEnd / 60), endMin: brkEnd % 60,
          startFormatted: fmt(Math.floor(brkStart / 60), brkStart % 60),
          endFormatted: fmt(Math.floor(brkEnd / 60), brkEnd % 60),
          categoryEmoji: '☕'
        });
        cursor = brkEnd;
      } else {
        cursor += 5; // 5-min gap
      }
    }

    // Merge completed + recovered, sort by time
    const all = [...completed, ...recovered];
    all.sort((a, b) => (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin));
    return all;
  }

  /**
   * Burnout Detection.
   * Analyzes schedule for overwork indicators.
   * @param {Array} schedule - current schedule
   * @param {Array} goals - all goals
   * @returns {Object} { isBurnout, level, warnings, suggestions }
   */
  function detectBurnout(schedule, goals) {
    const result = { isBurnout: false, level: 'ok', warnings: [], suggestions: [] };
    if (!schedule || !schedule.length) return result;

    // Calculate total scheduled time (non-break)
    const totalMin = schedule.filter(t => !t.isBreak).reduce((s, t) => s + (t.duration || 0), 0);
    const totalHrs = totalMin / 60;

    // Calculate break time
    const breakMin = schedule.filter(t => t.isBreak).reduce((s, t) => s + (t.duration || 0), 0);
    const breakRatio = totalMin > 0 ? breakMin / totalMin : 0;

    // Count hard tasks
    const hardCount = (goals || []).filter(g => g.difficulty === 'hard' && !g.completed).length;

    // Check consecutive tasks without breaks
    let consecutiveCount = 0, maxConsecutive = 0;
    for (const t of schedule) {
      if (t.isBreak) { maxConsecutive = Math.max(maxConsecutive, consecutiveCount); consecutiveCount = 0; }
      else consecutiveCount++;
    }
    maxConsecutive = Math.max(maxConsecutive, consecutiveCount);

    // Burnout detection logic
    if (totalHrs > 8) {
      result.isBurnout = true;
      result.level = 'high';
      result.warnings.push('🔴 Over 8 hours of tasks scheduled — high burnout risk!');
      result.suggestions.push('Remove or defer at least ' + Math.ceil(totalHrs - 6) + ' hour(s) of tasks.');
    } else if (totalHrs > 6) {
      result.isBurnout = true;
      result.level = 'moderate';
      result.warnings.push('🟡 Over 6 hours scheduled — moderate burnout risk.');
      result.suggestions.push('Consider moving low-priority tasks to tomorrow.');
    }

    if (breakRatio < 0.1 && totalMin > 120) {
      result.warnings.push('⚠️ Very few breaks scheduled. Add breaks for sustained focus.');
      result.suggestions.push('Add a 10-15 min break after every 90 minutes of work.');
    }

    if (hardCount >= 3) {
      result.warnings.push('🧠 3+ hard tasks — high cognitive load.');
      result.suggestions.push('Spread hard tasks across multiple days for better quality.');
    }

    if (maxConsecutive >= 4) {
      result.warnings.push('⏰ ' + maxConsecutive + ' tasks in a row without breaks!');
      result.suggestions.push('Insert short breaks between tasks to prevent fatigue.');
    }

    if (!result.isBurnout && result.warnings.length === 0) {
      result.level = 'ok';
      result.suggestions.push('✅ Your workload looks balanced. Keep it up!');
    }

    return result;
  }

  return {
    generateSchedule, generateSmartSchedule, exportToICS, getInsights,
    formatTime: fmt, CATEGORY_EMOJI: CAT_EMOJI, generateShareText,
    rescheduleTasks, recalcTimesAfterReorder,
    getSuggestions, DIFFICULTY_DURATION,
    recoverDay, detectBurnout
  };
})();


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

  return { generateSchedule, exportToICS, getInsights, formatTime: fmt, CATEGORY_EMOJI: CAT_EMOJI, generateShareText };
})();

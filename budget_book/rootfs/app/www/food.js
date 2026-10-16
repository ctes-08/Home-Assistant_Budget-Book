// Dining metadata stays in the existing note field, so old exports remain usable.
(function (root) {
  'use strict';
  const meals = ['早餐', '午餐', '晚餐', '點心', '宵夜'];
  const general = '一般餐飲';
  const words = [...meals, '飲料', '咖啡', '餐飲', '餐費'];
  const aliases = new Map(Object.entries({ uber: 'Uber Eats', ubereats: 'Uber Eats', 'uber eats': 'Uber Eats',
    '熊貓': 'foodpanda', 'food panda': 'foodpanda', foodpanda: 'foodpanda', '門市': '現場', '店面': '現場' }));
  function channelName(value) {
    const text = String(value || '').normalize('NFKC').trim();
    if ([...text].length > 30 || /[\x00-\x1f|#]/u.test(text)) throw new Error('Invalid dining channel');
    return aliases.get(text.toLowerCase()) || text;
  }
  function decodeNote(note) {
    const raw = String(note || '').normalize('NFKC').trim();
    const parts = raw.split('|');
    const label = parts[0].trim();
    if (words.includes(label) && parts.length >= 2) {
      let channel;
      try { channel = channelName(parts[1]); }
      catch { return { meal: general, channel: '', description: raw }; }
      const description = parts.length >= 3 ? parts.slice(2).join('|').trim()
        : [...meals, '餐飲', '餐費'].includes(label) ? '' : label;
      return { meal: meals.includes(label) ? label : general, channel, description };
    }
    const match = /^(早餐|午餐|晚餐|點心|宵夜)(?:\s+|$)(.*)$/u.exec(raw);
    if (match) return { meal: match[1], channel: '', description: match[2].trim() };
    return { meal: general, channel: '', description: ['餐飲', '餐費'].includes(raw) ? '' : raw };
  }
  // Leave untouched notes byte-for-byte intact when only amount/date/category changes.
  // The unvalidated form is only a draft when switching away from food; it is never
  // used to save a food entry. Keeping it visible avoids losing hidden field values.
  function editorNote(original, details, validate = true) {
    original = String(original || '');
    const initial = decodeNote(original);
    if (['meal', 'channel', 'description'].every(key => initial[key] === details[key])) return original;
    if (![...meals, general].includes(details.meal)) throw new Error('food.invalid_meal');
    let channel = String(details.channel || '').trim();
    const description = String(details.description || '').trim();
    if (validate) {
      try { channel = channelName(channel); }
      catch { throw new Error('food.invalid_channel'); }
    }
    const label = details.meal === general ? '餐飲' : details.meal;
    const note = details.meal === general && !channel && !description ? ''
      : !channel && !description ? label : label + '｜' + channel + (description ? '｜' + description : '');
    if (validate && [...note].length > 100) throw new Error('food.note_too_long');
    return note;
  }
  function summarize(book, period, meal = null, channel = null) {
    const ids = new Set((book.categories || []).filter(c => c.type === 'expense' && (c.id === 'food' || c.name === '餐飲')).map(c => c.id));
    const mealTotals = Object.fromEntries([...meals, general].map(label => [label, 0]));
    const channelTotals = new Map();
    const selected = channel == null ? null : channelName(channel);
    let total = 0, count = 0;
    const add = (a, b) => Number((a + b).toFixed(8));
    for (const tx of book.transactions || []) {
      if (tx.type !== 'expense' || !ids.has(tx.category) || !String(tx.date || '').startsWith(period)) continue;
      const info = decodeNote(tx.note), label = info.channel || '未指定通路';
      if ((meal && info.meal !== meal) || (selected != null && label !== selected)) continue;
      if (typeof tx.amount !== 'number' || !Number.isFinite(tx.amount) || tx.amount < 0 || tx.amount > 1e12) throw new Error('Invalid dining amount');
      total = add(total, tx.amount); count++;
      mealTotals[info.meal] = add(mealTotals[info.meal], tx.amount);
      channelTotals.set(label, add(channelTotals.get(label) || 0, tx.amount));
    }
    const channels = Object.fromEntries([...channelTotals].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
    return { total, count, meals: mealTotals, channels };
  }
  const api = { meals, general, channelName, decodeNote, editorNote, summarize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BudgetFood = api;
})(typeof window === 'undefined' ? globalThis : window);

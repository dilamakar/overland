/* =========================================================================
   i18n.js: English and Turkish text.
   Static text in index.html carries data-i18n / data-i18n-* attributes;
   dynamic text is built with t(key, params).
   ========================================================================= */

const STRINGS = {
  en: {
    'meta.title': 'Overland: cross borders, not seas',
    'start.tag': 'Cross borders, not seas.',
    'start.lede': 'You get two countries and one minute. Walk from the first to the second one border at a time. Every country you step into must touch the last one on land.',
    'start.step1': '<b>Tap a neighbour</b> of the country you\'re in. A wrong tap, one that doesn\'t share a land border, costs a life.',
    'start.step2': '<b>Every step closer</b> to the goal adds 3 seconds. Arrive on the shortest route for a bonus and 10 more.',
    'start.step3': '<b>Nine long routes, three levels.</b> Through tiny countries and the long way round. The hints fade as you go.',
    'start.name': 'Name for the high-score table',
    'start.go': 'Start the clock',
    'start.loading': 'Loading map…',
    'start.failed': 'Map failed to load. Reload the page.',
    'start.board': 'High scores on this device',
    'start.credit': 'Borders: Natural Earth 1:50m via world-atlas. Made with D3, TopoJSON and Chart.js.',
    'board.empty': 'No scores yet. Be the first.',
    'hud.score': 'Score', 'hud.route': 'Route', 'hud.lives': 'Lives', 'hud.pause': 'Pause (P)', 'hud.time': 'Time left',
    'visa.from': 'From', 'visa.to': 'To', 'visa.undo': 'Undo', 'visa.skip': 'Skip route', 'visa.cost': '−1 life',
    'visa.empty': 'Your entry stamps land here.',
    'ctrl.in': 'Zoom in', 'ctrl.out': 'Zoom out', 'ctrl.fit': 'Show the whole route',
    'pause.title': 'Paused', 'pause.text': 'The clock stops while you\'re away.', 'pause.resume': 'Resume',
    'over.chart': 'Your crossings vs. the shortest route', 'over.menu': 'Main menu', 'over.again': 'Play again', 'over.points': 'points',
    'pref.day': 'Switch to day mode', 'pref.night': 'Switch to night mode', 'pref.lang': 'Türkçe',
    'globe.label': 'Globe. Drag to turn it, scroll or pinch to zoom, tap a country to cross into it.',

    'level.1': 'Day tripper', 'level.2': 'Backpacker', 'level.3': 'Overlander',
    'chip': ({ n, name }) => `Level ${n}, ${name}`,
    'hint.shortest': ({ n }) => `Shortest: ${n} crossing${n === 1 ? '' : 's'}`,
    'hint.none': 'No hints at this level',
    'st.begin': ({ c }) => `Tap a country that borders <b>${c}</b>.`,
    'st.level2': '<b>Level 2.</b> Neighbours no longer light up. ',
    'st.level3': '<b>Level 3.</b> No names on hover and no distance hints. ',
    'st.sea': 'That\'s open sea. Overland means land borders only.',
    'st.same': ({ c }) => `You're already in <b>${c}</b>. Pick one of its neighbours.`,
    'st.back': ({ c }) => `Back in <b>${c}</b>. Try another way.`,
    'st.wrong': ({ a, b }) => `<b>${a}</b> doesn't share a land border with <b>${b}</b>. You lose a life.`,
    'st.closer': ({ c, n }) => `In <b>${c}</b>. At least ${n} crossing${n === 1 ? '' : 's'} to go.`,
    'st.further': ({ c }) => `In <b>${c}</b>. That step took you further from the goal.`,
    'st.in': ({ c, t }) => `In <b>${c}</b>. Keep heading for <b>${t}</b>.`,
    'st.arrived': ({ t }) => `Arrived in <b>${t}</b>.`,
    'st.skipped': 'Skipped. The dashed line shows the shortest way.',
    'arr.kicker': ({ t }) => `Arrived in ${t}`,
    'arr.skipKicker': 'Route skipped, one life used',
    'arr.best': ({ n }) => `${n} crossings, the shortest route`,
    'arr.more': ({ n, m }) => `${n} crossings. The shortest was ${m}.`,
    'arr.skip': ({ m }) => `The shortest way was ${m} crossings`,
    'arr.lineBest': 'shortest route', 'arr.line': 'route', 'arr.speed': ({ s }) => `speed (${s} s)`,
    'arr.level': 'level', 'arr.clock': 'on the clock', 'arr.next': 'Next route', 'arr.last': 'See your passport',
    'over.time': 'Time is up', 'over.lives': 'Out of lives', 'over.done': ({ n }) => `All ${n} routes travelled`,
    'over.sub': ({ r, s, bonus }) => `${r} route${r === 1 ? '' : 's'} completed, ${s} on the shortest way${bonus ? `, +${bonus} for time left` : ''}.`,
    'over.none': 'No routes finished this time. Neighbours first, then head for the goal.',
    'over.best': 'New high score', 'over.rank': ({ n }) => `Rank ${n} on this device`, 'over.out': 'Not in the top 10',
    'over.visited': ({ n }) => `${n} countr${n === 1 ? 'y' : 'ies'} stamped`,
    'chart.yours': 'Your crossings', 'chart.best': 'Shortest possible', 'chart.x': 'Route',
    'chart.skipped': 'Skipped', 'chart.points': ({ p }) => `${p} points`,
    'stamp.entry': 'ENTRY', 'stamp.start': 'DEPARTED', 'stamp.goal': 'ARRIVED',
    'unit.s': 's',
  },
  tr: {
    'meta.title': 'Overland: sınırları geç, denizleri değil',
    'start.tag': 'Sınırları geç, denizleri değil.',
    'start.lede': 'Sana iki ülke ve bir dakika veriliyor. Birinciden ikinciye sınır sınır yürü. Adım attığın her ülke, bir öncekiyle kara sınırı paylaşmalı.',
    'start.step1': '<b>Bulunduğun ülkenin bir komşusuna dokun.</b> Kara sınırı olmayan bir ülkeye dokunursan bir can gider.',
    'start.step2': '<b>Hedefe yaklaştıran her adım</b> 3 saniye kazandırır. En kısa rotadan varırsan bonus puan ve 10 saniye daha.',
    'start.step3': '<b>Dokuz uzun rota, üç seviye.</b> Minicik ülkelerden geçen, dolambaçlı yollar. İlerledikçe ipuçları azalır.',
    'start.name': 'Skor tablosu için adın',
    'start.go': 'Saati başlat',
    'start.loading': 'Harita yükleniyor…',
    'start.failed': 'Harita yüklenemedi. Sayfayı yenile.',
    'start.board': 'Bu cihazdaki en yüksek skorlar',
    'start.credit': 'Sınırlar: Natural Earth 1:50m (world-atlas). D3, TopoJSON ve Chart.js ile yapıldı.',
    'board.empty': 'Henüz skor yok. İlk sen ol.',
    'hud.score': 'Skor', 'hud.route': 'Rota', 'hud.lives': 'Can', 'hud.pause': 'Duraklat (P)', 'hud.time': 'Kalan süre',
    'visa.from': 'Nereden', 'visa.to': 'Nereye', 'visa.undo': 'Geri al', 'visa.skip': 'Rotayı atla', 'visa.cost': '−1 can',
    'visa.empty': 'Giriş damgaların buraya basılacak.',
    'ctrl.in': 'Yakınlaştır', 'ctrl.out': 'Uzaklaştır', 'ctrl.fit': 'Tüm rotayı göster',
    'pause.title': 'Duraklatıldı', 'pause.text': 'Sen yokken saat durur.', 'pause.resume': 'Devam et',
    'over.chart': 'Senin geçişlerin ve en kısa rota', 'over.menu': 'Ana menü', 'over.again': 'Tekrar oyna', 'over.points': 'puan',
    'pref.day': 'Gündüz moduna geç', 'pref.night': 'Gece moduna geç', 'pref.lang': 'English',
    'globe.label': 'Dünya küresi. Çevirmek için sürükle, yakınlaştırmak için kaydır ya da iki parmakla aç, geçmek için bir ülkeye dokun.',

    'level.1': 'Günübirlikçi', 'level.2': 'Sırt çantalı', 'level.3': 'Kıta gezgini',
    'chip': ({ n, name }) => `Seviye ${n}, ${name}`,
    'hint.shortest': ({ n }) => `En kısa: ${n} geçiş`,
    'hint.none': 'Bu seviyede ipucu yok',
    'st.begin': ({ c }) => `Şu ülkeyle sınırı olan bir ülkeye dokun: <b>${c}</b>.`,
    'st.level2': '<b>Seviye 2.</b> Komşular artık parlamıyor. ',
    'st.level3': '<b>Seviye 3.</b> Üzerine gelince isim ve mesafe ipucu yok. ',
    'st.sea': 'Orası deniz. Sadece kara sınırlarından geçebilirsin.',
    'st.same': ({ c }) => `Zaten buradasın: <b>${c}</b>. Komşularından birini seç.`,
    'st.back': ({ c }) => `Geri döndün: <b>${c}</b>. Başka bir yol dene.`,
    'st.wrong': ({ a, b }) => `<b>${a}</b> ile <b>${b}</b> arasında kara sınırı yok. Bir can kaybettin.`,
    'st.closer': ({ c, n }) => `Şu an <b>${c}</b>. Hedefe en az ${n} geçiş kaldı.`,
    'st.further': ({ c }) => `Şu an <b>${c}</b>. Bu adım seni hedeften uzaklaştırdı.`,
    'st.in': ({ c, t }) => `Şu an <b>${c}</b>. Hedef: <b>${t}</b>.`,
    'st.arrived': ({ t }) => `Vardın: <b>${t}</b>.`,
    'st.skipped': 'Rota atlandı. Kesikli çizgi en kısa yolu gösteriyor.',
    'arr.kicker': ({ t }) => `Varış: ${t}`,
    'arr.skipKicker': 'Rota atlandı, bir can gitti',
    'arr.best': ({ n }) => `${n} geçiş, en kısa rota`,
    'arr.more': ({ n, m }) => `${n} geçiş. En kısası ${m} idi.`,
    'arr.skip': ({ m }) => `En kısa yol ${m} geçişti`,
    'arr.lineBest': 'en kısa rota', 'arr.line': 'rota', 'arr.speed': ({ s }) => `hız (${s} sn)`,
    'arr.level': 'seviye', 'arr.clock': 'süreye', 'arr.next': 'Sonraki rota', 'arr.last': 'Pasaportuna bak',
    'over.time': 'Süre doldu', 'over.lives': 'Canın kalmadı', 'over.done': ({ n }) => `${n} rotanın hepsi tamamlandı`,
    'over.sub': ({ r, s, bonus }) => `${r} rota tamamlandı, ${s} tanesi en kısa yoldan${bonus ? `, kalan süre için +${bonus}` : ''}.`,
    'over.none': 'Bu sefer rota tamamlanmadı. Önce komşuları bul, sonra hedefe yönel.',
    'over.best': 'Yeni rekor', 'over.rank': ({ n }) => `Bu cihazda ${n}. sıra`, 'over.out': 'İlk 10\'a giremedi',
    'over.visited': ({ n }) => `${n} ülke damgalandı`,
    'chart.yours': 'Senin geçişlerin', 'chart.best': 'Mümkün en kısa', 'chart.x': 'Rota',
    'chart.skipped': 'Atlandı', 'chart.points': ({ p }) => `${p} puan`,
    'stamp.entry': 'GİRİŞ', 'stamp.start': 'ÇIKIŞ', 'stamp.goal': 'VARIŞ',
    'unit.s': 'sn',
  },
};

let stored = null;
try { stored = localStorage.getItem('overland.lang'); } catch { /* storage blocked */ }
let lang = stored || ((navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en');
if (!STRINGS[lang]) lang = 'en';

export const getLang = () => lang;
export const locale = () => (lang === 'tr' ? 'tr-TR' : 'en-GB');

export function setLang(next) {
  lang = STRINGS[next] ? next : 'en';
  try { localStorage.setItem('overland.lang', lang); } catch { /* ignore */ }
  applyStatic();
}

/** Looks up a string; function entries are called with params. */
export function t(key, params = {}) {
  const v = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return typeof v === 'function' ? v(params) : v;
}

/** Country name in the current language. */
export const nameOf = country => country?.names?.[lang] ?? country?.name ?? '';

/** Formats numbers the local way (16,795 vs 16.795). */
export const num = n => Number(n).toLocaleString(locale());

/** Fills every element that has data-i18n (text), data-i18n-html, or data-i18n-<attr>. */
export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  document.title = t('meta.title');
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  for (const attr of ['placeholder', 'aria-label', 'title', 'data-empty']) {
    const key = 'i18n' + attr.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase()); // aria-label → i18nAriaLabel
    root.querySelectorAll(`[data-i18n-${attr}]`).forEach(el => el.setAttribute(attr, t(el.dataset[key])));
  }
}

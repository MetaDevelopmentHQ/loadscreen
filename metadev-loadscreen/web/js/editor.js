/**
 * MetaDev Loadscreen · editor.js
 *
 * "Loadscreen Studio": the in-game theme editor (/loadscreen).
 *
 *   left   settings panel (tabs: design, content, media, calendar, share, history, stats)
 *   centre live preview, drawn by the SAME renderer as the loading screen
 *   bottom summary of the current choices
 *
 * The editor works on a draft copy of the theme. Nothing is trusted here:
 * every save/import/restore goes to the server, which validates it again
 * and answers with the clean theme that is actually stored.
 *
 * Opened outside FiveM (plain browser), it runs in demo mode with sample data.
 */

import { loadLocale, createI18n, escapeHtml } from './i18n.js';
import {
  resolveToday, findActiveHoliday, listHolidays, parseISODate, formatISODate, occurrence, HOLIDAYS,
} from './calendar.js';
import {
  GALLERY, FONTS, ACCENT_SWATCHES, MODULES, CARD_CATEGORIES,
  buildDefaultTheme, normaliseTheme, composeTheme, applyPreset, backgroundKind,
} from './themes.js';
import { Renderer } from './renderer.js';
import { encodeTheme, decodeTheme } from './themecode.js';
import { extractAccentColors } from './logocolors.js';

const IN_FIVEM = typeof window.GetParentResourceName === 'function';
const RESOURCE = IN_FIVEM ? window.GetParentResourceName() : 'metadev-loadscreen';

const STUDIO = { width: 1440, height: 920 };
const PREVIEW_SIZE = { width: 1920, height: 1080, scale: 0.5 };
const TABS = ['design', 'content', 'media', 'calendar', 'share', 'history', 'stats'];

/** Same limits as server/theme_store.lua, so the inputs stop where the server would cut. */
const LIMITS = {
  serverName: 32, serverLabel: 48, badge: 60, slogan: 160,
  cardTitle: 60, cardBody: 220, cardsPerTab: 8,
  trackTitle: 80, trackArtist: 60, playlist: 25, url: 512,
  holidayBadge: 80, holidayMessage: 220,
};

const ICON = {
  save: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>',
  close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18"></path><path d="M6 6l12 12"></path></svg>',
  trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M6 6l1 14h10l1-14"></path></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>',
  chevron: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"></path></svg>',
};

/* -------------------------------------------------------------------------- */
/* State                                                                      */
/* -------------------------------------------------------------------------- */

const ui = {
  t: null,
  payload: null,       // data from the server (theme, history, stats, schedule config…)
  saved: null,         // theme as stored on the server
  draft: null,         // theme being edited
  tab: 'design',
  today: null,
  previewDate: null,
  previewHoliday: null,
  expanded: new Set(), // calendar rows that are open
  suggestions: null,   // logo colour suggestions
  logoStatus: '',
  importText: '',
  busy: false,
  renderer: null,
  refs: {},
  timers: { preview: 0, toast: 0 },
};

const backdrop = document.getElementById('backdrop');
const studio = document.getElementById('studio');

const clone = (value) => JSON.parse(JSON.stringify(value));
const isDirty = () => JSON.stringify(ui.draft) !== JSON.stringify(ui.saved);
const t = (key, vars) => ui.t(key, vars);

function getPath(object, path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), object);
}

function setPath(object, path, value) {
  const keys = path.split('.');
  let node = object;
  keys.slice(0, -1).forEach((key, i) => {
    if (node[key] == null || typeof node[key] !== 'object') node[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    node = node[key];
  });
  node[keys[keys.length - 1]] = value;
}

/* -------------------------------------------------------------------------- */
/* Communication                                                              */
/* -------------------------------------------------------------------------- */

/** Calls a NUI callback in client/editor.lua (which forwards to the server). */
async function nui(name, data = {}) {
  if (!IN_FIVEM) return demo.request(name, data);
  try {
    const response = await fetch(`https://${RESOURCE}/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(data),
    });
    return await response.json();
  } catch {
    return { ok: false, error: 'timeout' };
  }
}

function errorText(code) {
  const key = `editor.errors.${code}`;
  return ui.t.has(key) ? t(key) : t('editor.errors.unknown');
}

window.addEventListener('message', (event) => {
  const message = event.data || {};
  if (message.action === 'open') open(message.payload);
  if (message.action === 'close') hide();
});

/* -------------------------------------------------------------------------- */
/* Open / close                                                               */
/* -------------------------------------------------------------------------- */

async function open(payload) {
  if (!ui.t || ui.t.code !== payload.locale) {
    const { code, dict } = await loadLocale(payload.locale);
    ui.t = createI18n(dict, code);
    document.documentElement.lang = code;
  }

  ui.payload = payload;
  ui.saved = normaliseTheme(payload.theme, buildDefaultTheme(ui.t));
  ui.draft = clone(ui.saved);
  ui.today = resolveToday({ now: payload.now, timeZone: payload.timezone, utcOffset: payload.utcOffset, forceDate: payload.forceDate });
  ui.previewDate = ui.today;
  ui.suggestions = null;
  ui.logoStatus = '';
  ui.importText = '';
  ui.expanded.clear();

  renderShell();
  backdrop.classList.add('is-open');
  fit();
}

function hide() {
  backdrop.classList.remove('is-open');
  studio.innerHTML = ''; // stops preview animations and videos
  ui.renderer = null;
}

async function close() {
  if (isDirty() && !(await confirmDialog(t('editor.confirm.close')))) return;
  hide();
  await nui('close');
}

/** Scales the 1440×920 window down on smaller screens. */
function fit() {
  const scale = Math.min(1, (window.innerWidth - 32) / STUDIO.width, (window.innerHeight - 32) / STUDIO.height);
  studio.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
window.addEventListener('resize', fit);

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */

function renderShell() {
  studio.innerHTML = `
    <header class="ed-head">
      <div class="ed-brand">
        <div class="ed-mark">M</div>
        <div class="ed-product">${escapeHtml(t('editor.brand'))} <span>${escapeHtml(t('editor.product'))}</span></div>
        <div class="ed-pill">${escapeHtml(t('editor.version', { version: ui.payload.version || '1.0.0' }))}</div>
      </div>
      <nav class="ed-nav" data-ref="nav">${TABS.map((tab) =>
        `<button data-cmd="tab" data-tab="${tab}">${escapeHtml(t(`editor.nav.${tab}`))}</button>`).join('')}</nav>
      <div class="ed-actions">
        <button class="btn" data-cmd="reset">${escapeHtml(t('editor.actions.reset'))}</button>
        <button class="btn btn-primary" data-cmd="save" data-ref="save"></button>
        <button class="btn btn-icon" data-cmd="close" aria-label="${escapeHtml(t('editor.actions.close'))}">${ICON.close}</button>
      </div>
    </header>
    <div class="ed-body">
      <aside class="ed-panel" data-ref="panel"></aside>
      <main class="ed-main">
        <div class="ed-main-head">
          <div class="ed-live"><i></i>${escapeHtml(t('editor.preview.live'))}</div>
          <div class="ed-sync" data-ref="sync"></div>
        </div>
        <div class="ed-preview" data-ref="preview"></div>
        <div class="ed-summary" data-ref="summary"></div>
      </main>
    </div>
    <div class="ed-toast" data-ref="toast" role="status"></div>
    <div class="ed-dialog" data-ref="dialog">
      <div class="ed-dialog-box">
        <p data-ref="dialogText"></p>
        <div class="ed-dialog-actions">
          <button class="btn" data-ref="dialogNo"></button>
          <button class="btn btn-primary" data-ref="dialogYes"></button>
        </div>
      </div>
    </div>`;

  ui.refs = {};
  studio.querySelectorAll('[data-ref]').forEach((node) => { ui.refs[node.dataset.ref] = node; });

  ui.renderer = new Renderer(ui.refs.preview, {
    t: ui.t,
    mode: 'preview',
    onAction(action, detail) {
      const renderer = ui.renderer;
      const count = renderer.cardCount || 1;
      if (action === 'tab') renderer.update({ tab: Number(detail.value) });
      if (action === 'tipNext') renderer.update({ tip: (renderer.state.tip + 1) % count });
      if (action === 'tipPrev') renderer.update({ tip: (renderer.state.tip - 1 + count) % count });
    },
  });
  ui.renderer.setSize(PREVIEW_SIZE);

  renderHeader();
  renderPanel();
  renderPreview(true);
}

function renderHeader() {
  const { refs } = ui;
  const dirty = isDirty();
  studio.style.setProperty('--ed-accent', ui.draft.accent);
  refs.nav.querySelectorAll('button').forEach((button) => button.classList.toggle('is-active', button.dataset.tab === ui.tab));
  refs.save.innerHTML = `${ICON.save}<span>${escapeHtml(t(ui.busy ? 'editor.actions.saving' : 'editor.actions.save'))}</span>`;
  refs.save.disabled = ui.busy || !dirty;
  refs.sync.textContent = t(dirty ? 'editor.preview.dirty' : 'editor.preview.synced');
  refs.sync.classList.toggle('is-dirty', dirty);
}

function renderPanel() {
  const panel = ui.refs.panel;
  const scroll = panel.dataset.tab === ui.tab ? panel.scrollTop : 0;
  panel.innerHTML = PANELS[ui.tab]();
  panel.dataset.tab = ui.tab;
  panel.scrollTop = scroll;
}

/** Schedule overrides as the server would merge them: config.lua, then the editor. */
function mergedOverrides() {
  const config = ui.payload.schedule?.config || {};
  const edited = ui.draft.schedule || {};
  const merged = {};
  for (const id of Object.keys(config)) {
    const entry = { ...config[id] };
    const own = edited[id] || {};
    if (typeof own.enabled === 'boolean') entry.enabled = own.enabled;
    if (own.badge?.trim()) entry.badge = own.badge;
    if (own.message?.trim()) entry.message = own.message;
    merged[id] = entry;
  }
  return merged;
}

/** Re-draws the preview (debounced while typing). */
function renderPreview(immediate = false) {
  clearTimeout(ui.timers.preview);
  const run = () => {
    if (!ui.renderer) return;
    const overrides = mergedOverrides();
    const enabled = ui.payload.schedule?.enabled !== false;
    ui.previewHoliday = findActiveHoliday(ui.previewDate, { locale: ui.t.code, overrides, enabled });
    const theme = composeTheme(ui.draft, ui.previewHoliday, { t: ui.t, date: ui.previewDate, overrides });
    ui.renderer.setTheme(theme);
    ui.renderer.update({ progress: 0.64, stage: 1, eta: 40, interval: theme.cards.interval });
    renderSummary();
  };
  if (immediate) run();
  else ui.timers.preview = setTimeout(run, 120);
}

function renderSummary() {
  const draft = ui.draft;
  const punct = (text) => `<span class="tok-punct">${text}</span>`;
  const key = (name) => `<span class="tok-key">"${name}"</span>${punct(':')} `;
  const str = (value) => `<span class="tok-str">"${escapeHtml(value)}"</span>`;
  const bool = (value) => `<span class="tok-bool">${Boolean(value)}</span>`;
  const holiday = ui.previewHoliday;

  ui.refs.summary.innerHTML = `
    <div class="ed-summary-head"><b>${escapeHtml(t('editor.summary.title'))}</b><span>${escapeHtml(t('editor.summary.hint'))}</span></div>
    <div>${key('layout')}${str(draft.layout)}${punct(',')}</div>
    <div>${key('accent')}${str(draft.accent)}${punct(',')}</div>
    <div>${key('font')}${str(FONTS[draft.font].label)}${punct(',')}</div>
    <div>${key('modules')}${punct('{')} ${MODULES.map((m) => `${key(m)}${bool(draft.modules[m])}`).join(`${punct(',')} `)} ${punct('}')}${punct(',')}</div>
    <div>${key('scheduled')}${holiday
      ? str(`${holiday.id} · ${formatISODate(ui.previewDate)}`)
      : `<span class="tok-bool">null</span>`}</div>`;
}

/** Call after every draft change. */
function changed({ panel = false } = {}) {
  renderHeader();
  renderPreview();
  if (panel) renderPanel();
}

/* -------------------------------------------------------------------------- */
/* Panel building blocks                                                      */
/* -------------------------------------------------------------------------- */

function section(title, body, aside = '') {
  return `<section class="ed-section"><div class="ed-section-head"><div class="ed-label">${escapeHtml(title)}</div>${aside}</div>${body}</section>`;
}

function field(label, bind, { max, placeholder = '', textarea = false, mono = false, type = 'text', dataType, min, maxValue } = {}) {
  const value = escapeHtml(getPath(ui.draft, bind) ?? '');
  const attrs = [
    `data-bind="${bind}"`,
    max ? `maxlength="${max}"` : '',
    placeholder ? `placeholder="${escapeHtml(placeholder)}"` : '',
    dataType ? `data-type="${dataType}"` : '',
    min !== undefined ? `min="${min}"` : '',
    maxValue !== undefined ? `max="${maxValue}"` : '',
    'spellcheck="false"',
  ].join(' ');
  const control = textarea
    ? `<textarea class="ed-textarea" ${attrs}>${value}</textarea>`
    : `<input class="ed-input${mono ? ' mono' : ''}" type="${type}" value="${value}" ${attrs}>`;
  return label ? `<label class="ed-field"><span>${escapeHtml(label)}</span>${control}</label>` : control;
}

function toggle(label, hint, on, cmd, data = '') {
  return `
    <div class="ed-toggle-row">
      <div class="ed-toggle-text">
        <div class="ed-toggle-label">${escapeHtml(label)}</div>
        ${hint ? `<div class="ed-toggle-hint">${escapeHtml(hint)}</div>` : ''}
      </div>
      <button class="ed-switch${on ? ' is-on' : ''}" data-cmd="${cmd}" ${data} aria-label="${escapeHtml(label)}" aria-pressed="${on}"></button>
    </div>`;
}

function mediaPreview(src, kind) {
  if (!src) return '';
  const safe = escapeHtml(src);
  return kind === 'video' ? `<video src="${safe}" muted playsinline preload="metadata"></video>` : `<img src="${safe}" alt="">`;
}

function fileName(src) {
  return String(src || '').split(/[/?#]/).filter(Boolean).pop() || '';
}

function formatSeconds(value) {
  return Number.isFinite(value) ? t('editor.stats.seconds', { n: Math.round(value) }) : '—';
}

function formatDay({ y, m, d }, options) {
  try {
    return new Intl.DateTimeFormat(ui.t.intl, { ...options, timeZone: 'UTC' }).format(Date.UTC(y, m - 1, d));
  } catch {
    return formatISODate({ y, m, d });
  }
}

/* -------------------------------------------------------------------------- */
/* Panels                                                                     */
/* -------------------------------------------------------------------------- */

const PANELS = {
  design() {
    const draft = ui.draft;
    const bgKind = backgroundKind(draft.background);

    const gallery = GALLERY.map((preset) => `
      <button class="ed-layout${draft.layout === preset.layout ? ' is-active' : ''}" data-cmd="preset" data-id="${preset.id}">
        <div class="ed-thumb ${preset.layout}">${mediaPreview(draft.background.src, bgKind)}</div>
        <div>${escapeHtml(preset.name || t(preset.nameKey))}</div>
      </button>`).join('');

    const swatches = ACCENT_SWATCHES.map((hex) => `
      <button class="ed-swatch${draft.accent === hex ? ' is-active' : ''}" style="--swatch:${hex}" data-cmd="accent" data-hex="${hex}" aria-label="${hex}"></button>`).join('');

    const fonts = Object.entries(FONTS).map(([id, font]) => `
      <button class="${draft.font === id ? 'is-active' : ''}" style="font-family:${font.css};font-weight:${id === 'serif' ? 400 : 700}" data-cmd="font" data-id="${id}">${font.label}</button>`).join('');

    const modules = MODULES.map((key) =>
      toggle(t(`editor.modules.${key}.label`), t(`editor.modules.${key}.hint`), draft.modules[key], 'module', `data-key="${key}"`)).join('');

    return [
      section(t('editor.gallery.title'), `<div class="ed-gallery">${gallery}</div>`),
      section(t('editor.accent.title'), `
        <div class="ed-swatches">${swatches}</div>
        <div class="ed-custom">
          <input type="color" value="${escapeHtml(draft.accent.toLowerCase())}" data-bind="accent" data-type="hex" aria-label="${escapeHtml(t('editor.accent.custom'))}">
          <input class="ed-input mono" value="${escapeHtml(draft.accent)}" maxlength="7" data-bind="accent" data-type="hex" spellcheck="false">
        </div>`, `<div class="ed-value">${escapeHtml(draft.accent)}</div>`),
      section(t('editor.font.title'), `<div class="ed-segment">${fonts}</div>`),
      section(t('editor.modules.title'), `<div class="ed-toggles">${modules}</div>`),
      section(t('editor.background.title'), `
        <div class="ed-media-row">
          <div class="ed-media-thumb">${mediaPreview(draft.background.src, bgKind)}</div>
          <div class="ed-media-text">
            <div class="ed-media-name">${escapeHtml(fileName(draft.background.src) || t('editor.background.none'))}</div>
            <div class="ed-toggle-hint">${escapeHtml(t('editor.background.hint'))}</div>
          </div>
          <button class="btn btn-sm" data-cmd="tab" data-tab="media">${escapeHtml(t('editor.background.change'))}</button>
        </div>`),
    ].join('');
  },

  content() {
    const draft = ui.draft;
    const categories = CARD_CATEGORIES.map((category) => {
      const items = draft.cards[category] || [];
      const list = items.length ? items.map((item, i) => `
        <div class="ed-item">
          <div class="ed-item-head">
            <div class="ed-item-n">${String(i + 1).padStart(2, '0')}</div>
            <button class="ed-remove" data-cmd="removeCard" data-category="${category}" data-index="${i}" aria-label="${escapeHtml(t('editor.content.remove'))}">${ICON.trash}</button>
          </div>
          ${field('', `cards.${category}.${i}.title`, { max: LIMITS.cardTitle, placeholder: t('editor.content.itemTitle') })}
          ${field('', `cards.${category}.${i}.body`, { max: LIMITS.cardBody, placeholder: t('editor.content.itemBody'), textarea: true })}
        </div>`).join('') : `<div class="ed-empty">${escapeHtml(t('editor.content.empty'))}</div>`;

      const add = `<button class="btn btn-xs" data-cmd="addCard" data-category="${category}" ${items.length >= LIMITS.cardsPerTab ? 'disabled' : ''}>${ICON.plus}${escapeHtml(t('editor.content.add'))}</button>`;
      return section(`${ui.t.upper(t(`cards.tabs.${category}`))} · ${items.length}/${LIMITS.cardsPerTab}`, `<div class="ed-items">${list}</div>`, add);
    }).join('');

    return [
      section(t('editor.content.server'), `
        ${field(t('editor.content.serverName'), 'serverName', { max: LIMITS.serverName })}
        ${field(t('editor.content.serverLabel'), 'serverLabel', { max: LIMITS.serverLabel })}
        ${field(t('editor.content.badge'), 'badge', { max: LIMITS.badge })}
        ${field(t('editor.content.slogan'), 'slogan', { max: LIMITS.slogan, textarea: true })}`),
      section(t('editor.content.cards'), `
        ${field(t('editor.content.interval'), 'cards.interval', { type: 'number', dataType: 'number', min: 3, maxValue: 60 })}
        <p class="ed-hint">${escapeHtml(t('editor.content.glassLimit'))}</p>`),
      categories,
    ].join('');
  },

  media() {
    const draft = ui.draft;
    const types = ['auto', 'image', 'video'].map((type) =>
      `<button class="${draft.background.type === type ? 'is-active' : ''}" data-cmd="bgType" data-type="${type}">${escapeHtml(t(`editor.media.types.${type}`))}</button>`).join('');

    let logoExtra = '';
    if (ui.logoStatus) logoExtra = `<p class="ed-hint">${escapeHtml(ui.logoStatus)}</p>`;
    if (ui.suggestions?.length) {
      logoExtra += `<div class="ed-label">${escapeHtml(t('editor.media.suggestions'))}</div><div class="ed-suggestions">${ui.suggestions.map((s, i) => `
        <button class="ed-suggestion" data-cmd="accent" data-hex="${s.hex}" style="--swatch:${s.hex}">
          <i></i><b>${s.hex}</b>${i === 0 ? `<span class="ed-tag">${escapeHtml(t('editor.media.recommended'))}</span>` : ''}<small>${s.contrast}:1</small>
        </button>`).join('')}</div>`;
    }

    const tracks = draft.playlist.length ? draft.playlist.map((_, i) => `
      <div class="ed-item">
        <div class="ed-item-head">
          <div class="ed-item-n">${String(i + 1).padStart(2, '0')}</div>
          <button class="ed-remove" data-cmd="removeTrack" data-index="${i}" aria-label="${escapeHtml(t('editor.content.remove'))}">${ICON.trash}</button>
        </div>
        ${field('', `playlist.${i}.title`, { max: LIMITS.trackTitle, placeholder: t('editor.media.trackTitle') })}
        ${field('', `playlist.${i}.artist`, { max: LIMITS.trackArtist, placeholder: t('editor.media.trackArtist') })}
        ${field('', `playlist.${i}.src`, { max: LIMITS.url, placeholder: t('editor.media.trackSrc'), mono: true })}
      </div>`).join('') : `<div class="ed-empty">${escapeHtml(t('editor.media.playlistEmpty'))}</div>`;

    const volume = Math.round((draft.music.volume ?? 0.4) * 100);

    return [
      section(t('editor.media.background'), `
        <div class="ed-media-row">
          <div class="ed-media-thumb">${mediaPreview(draft.background.src, backgroundKind(draft.background))}</div>
          <div class="ed-media-text"><div class="ed-media-name">${escapeHtml(fileName(draft.background.src) || t('editor.background.none'))}</div></div>
        </div>
        ${field(t('editor.media.src'), 'background.src', { max: LIMITS.url, placeholder: 'media/background.webp', mono: true })}
        <div class="ed-segment small">${types}</div>
        <p class="ed-note">${escapeHtml(t('editor.media.bgHint'))}</p>`),
      section(t('editor.media.logo'), `
        ${field('', 'logo', { max: LIMITS.url, placeholder: 'media/logo/logo.png', mono: true })}
        <p class="ed-hint">${escapeHtml(t('editor.media.logoHint'))}</p>
        <button class="btn btn-sm" data-cmd="extract">${escapeHtml(t('editor.media.extract'))}</button>
        ${logoExtra}`),
      section(t('editor.media.music'), `
        <label class="ed-field"><span>${escapeHtml(t('editor.media.volume'))} · <b data-ref-volume>${volume}%</b></span>
          <input class="ed-range" type="range" min="0" max="100" value="${volume}" data-bind="music.volume" data-type="percent">
        </label>
        <div class="ed-toggles">${toggle(t('editor.media.shuffle'), '', draft.music.shuffle, 'shuffle')}</div>
        <div class="ed-items">${tracks}</div>
        <button class="btn btn-sm" data-cmd="addTrack" ${draft.playlist.length >= LIMITS.playlist ? 'disabled' : ''}>${ICON.plus}${escapeHtml(t('editor.media.add'))}</button>`),
    ].join('');
  },

  calendar() {
    const overrides = mergedOverrides();
    const enabledGlobal = ui.payload.schedule?.enabled !== false;
    const holidays = listHolidays(ui.previewDate.y, ui.t.code);
    const active = ui.previewHoliday;

    const rows = holidays.map((holiday) => {
      const id = holiday.id;
      const on = overrides[id]?.enabled !== false;
      const open = ui.expanded.has(id);
      const range = formatISODate(holiday.start) === formatISODate(holiday.end)
        ? formatDay(holiday.start, { day: 'numeric', month: 'short' })
        : `${formatDay(holiday.start, { day: 'numeric', month: 'short' })} – ${formatDay(holiday.end, { day: 'numeric', month: 'short' })}`;
      const body = open ? `
        <div class="ed-holiday-body">
          ${field(t('editor.calendar.badge'), `schedule.${id}.badge`, { max: LIMITS.holidayBadge, placeholder: t(`holidays.${id}.badge`) })}
          ${field(t('editor.calendar.message'), `schedule.${id}.message`, { max: LIMITS.holidayMessage, placeholder: t(`holidays.${id}.message`), textarea: true })}
          <p class="ed-hint">${escapeHtml(t('editor.calendar.vars'))} · ${escapeHtml(t('editor.calendar.defaultPlaceholder'))}</p>
          <button class="btn btn-xs" data-cmd="previewHoliday" data-id="${id}">${escapeHtml(t('editor.calendar.preview'))}</button>
        </div>` : '';
      return `
        <div class="ed-holiday${active?.id === id ? ' is-today' : ''}">
          <div class="ed-holiday-row">
            <i class="ed-holiday-dot" style="--swatch:${holiday.accent}"></i>
            <div class="ed-holiday-text">
              <div class="ed-holiday-name">${escapeHtml(t(`holidays.${id}.name`))}</div>
              <div class="ed-holiday-meta">${escapeHtml(range)}
                <span class="ed-tag muted">${escapeHtml(t(`editor.calendar.scope.${holiday.scope}`))}</span>
                ${holiday.mode === 'remembrance' ? `<span class="ed-tag muted">${escapeHtml(t('editor.calendar.remembrance'))}</span>` : ''}
              </div>
            </div>
            <button class="ed-switch${on ? ' is-on' : ''}" data-cmd="holiday" data-id="${id}" aria-pressed="${on}" aria-label="${escapeHtml(t(`holidays.${id}.name`))}"></button>
            <button class="ed-chevron${open ? ' is-open' : ''}" data-cmd="expand" data-id="${id}" aria-expanded="${open}">${ICON.chevron}</button>
          </div>
          ${body}
        </div>`;
    }).join('');

    return [
      section(t('editor.calendar.title'), `
        <p class="ed-hint">${escapeHtml(t('editor.calendar.hint'))}</p>
        ${enabledGlobal ? '' : `<p class="ed-note">${escapeHtml(t('editor.calendar.disabledGlobal'))}</p>`}
        <label class="ed-field"><span>${escapeHtml(t('editor.calendar.previewDate'))}</span>
          <div class="ed-row">
            <input class="ed-input mono" type="date" value="${formatISODate(ui.previewDate)}" data-preview-date>
            <button class="btn btn-sm" data-cmd="today">${escapeHtml(t('editor.calendar.today'))}</button>
          </div>
        </label>
        <p class="ed-hint">${escapeHtml(active ? t('editor.calendar.active', { name: t(`holidays.${active.id}.name`) }) : t('editor.calendar.inactive'))}</p>`),
      `<div class="ed-holidays">${rows}</div>`,
    ].join('');
  },

  share() {
    const code = encodeTheme(ui.draft);
    return [
      section(t('editor.share.code'), `
        <textarea class="ed-textarea mono" rows="5" readonly data-ref-code>${escapeHtml(code)}</textarea>
        <p class="ed-hint">${escapeHtml(t('editor.share.codeHint'))}</p>
        <button class="btn btn-sm" data-cmd="copy">${escapeHtml(t('editor.share.copy'))}</button>`),
      section(t('editor.share.import'), `
        <textarea class="ed-textarea mono" rows="5" placeholder="${escapeHtml(t('editor.share.importPlaceholder'))}" data-local="importText" spellcheck="false">${escapeHtml(ui.importText)}</textarea>
        <button class="btn btn-sm" data-cmd="import">${escapeHtml(t('editor.share.importButton'))}</button>`),
    ].join('');
  },

  history() {
    const history = ui.payload.history || [];
    let formatter;
    try {
      formatter = new Intl.DateTimeFormat(ui.t.intl, { dateStyle: 'medium', timeStyle: 'short', timeZone: ui.payload.timezone });
    } catch {
      formatter = new Intl.DateTimeFormat(ui.t.intl, { dateStyle: 'medium', timeStyle: 'short' });
    }
    const list = history.length ? history.map((entry, i) => `
      <div class="ed-history-item">
        <div class="ed-history-text">
          <div class="ed-history-time">${escapeHtml(formatter.format(new Date(entry.savedAt * 1000)))}</div>
          <div class="ed-history-meta">${escapeHtml(entry.author || '?')} · ${escapeHtml(t(`editor.history.kinds.${entry.kind === 'restore' ? 'restore' : 'save'}`))}</div>
        </div>
        ${i === 0
          ? `<span class="ed-tag">${escapeHtml(t('editor.history.current'))}</span>`
          : `<button class="btn btn-xs" data-cmd="restore" data-id="${escapeHtml(entry.id)}">${escapeHtml(t('editor.history.restore'))}</button>`}
      </div>`).join('') : `<div class="ed-empty">${escapeHtml(t('editor.history.empty'))}</div>`;

    return section(t('editor.history.title'), `<p class="ed-hint">${escapeHtml(t('editor.history.hint'))}</p><div class="ed-history">${list}</div>`);
  },

  stats() {
    const stats = ui.payload.stats || {};
    if (!stats.total) {
      return section(t('editor.stats.title'), `<div class="ed-empty">${escapeHtml(t('editor.stats.empty'))}</div>`);
    }
    const week = stats.week || [];
    const peak = Math.max(1, ...week.map((day) => day.count));
    const bars = week.map((day, i) => {
      const date = parseISODate(day.date);
      return `
        <div class="ed-bar${i === week.length - 1 ? ' is-today' : ''}" title="${escapeHtml(t('editor.stats.joins', { n: day.count }))}">
          <div class="ed-bar-count">${day.count}</div>
          <div class="ed-bar-fill" style="height:${Math.round((day.count / peak) * 100)}%"></div>
          <div class="ed-bar-day">${escapeHtml(date ? formatDay(date, { weekday: 'short' }) : '')}</div>
        </div>`;
    }).join('');

    return [
      section(t('editor.stats.title'), `
        <div class="ed-tiles">
          <div class="ed-tile"><b>${escapeHtml(formatSeconds(stats.average))}</b><span>${escapeHtml(t('editor.stats.average'))}</span></div>
          <div class="ed-tile"><b>${stats.today ?? 0}</b><span>${escapeHtml(t('editor.stats.today'))}</span></div>
          <div class="ed-tile"><b>${escapeHtml(formatSeconds(stats.fastest))}</b><span>${escapeHtml(t('editor.stats.fastest'))}</span></div>
          <div class="ed-tile"><b>${escapeHtml(formatSeconds(stats.slowest))}</b><span>${escapeHtml(t('editor.stats.slowest'))}</span></div>
        </div>`),
      section(t('editor.stats.week'), `<div class="ed-chart">${bars}</div><p class="ed-hint">${escapeHtml(t('editor.stats.total', { n: stats.total }))}</p>`),
    ].join('');
  },
};

/* -------------------------------------------------------------------------- */
/* Commands (clicks on [data-cmd])                                            */
/* -------------------------------------------------------------------------- */

const COMMANDS = {
  tab({ tab }) {
    if (!TABS.includes(tab)) return;
    ui.tab = tab;
    renderHeader();
    renderPanel();
  },

  preset({ id }) {
    const preset = GALLERY.find((p) => p.id === id);
    if (!preset) return;
    ui.draft = applyPreset(ui.draft, preset);
    changed({ panel: true });
  },

  accent({ hex }) {
    ui.draft.accent = hex;
    changed({ panel: true });
  },

  font({ id }) {
    if (!FONTS[id]) return;
    ui.draft.font = id;
    changed({ panel: true });
  },

  module({ key }) {
    ui.draft.modules[key] = !ui.draft.modules[key];
    changed({ panel: true });
  },

  bgType({ type }) {
    ui.draft.background.type = type;
    changed({ panel: true });
  },

  addCard({ category }) {
    const list = ui.draft.cards[category] || (ui.draft.cards[category] = []);
    if (list.length < LIMITS.cardsPerTab) list.push({ title: '', body: '' });
    changed({ panel: true });
  },

  removeCard({ category, index }) {
    ui.draft.cards[category].splice(Number(index), 1);
    changed({ panel: true });
  },

  addTrack() {
    if (ui.draft.playlist.length < LIMITS.playlist) ui.draft.playlist.push({ title: '', artist: '', src: '' });
    changed({ panel: true });
  },

  removeTrack({ index }) {
    ui.draft.playlist.splice(Number(index), 1);
    changed({ panel: true });
  },

  shuffle() {
    ui.draft.music.shuffle = !ui.draft.music.shuffle;
    changed({ panel: true });
  },

  async extract() {
    const src = (ui.draft.logo || '').trim();
    ui.suggestions = null;
    if (!src) {
      ui.logoStatus = t('editor.media.noLogo');
      renderPanel();
      return;
    }
    ui.logoStatus = t('editor.media.extracting');
    renderPanel();
    try {
      ui.suggestions = await extractAccentColors(src, 3);
      ui.logoStatus = ui.suggestions.length ? '' : t('editor.media.noColors');
    } catch (error) {
      ui.logoStatus = t(error.code === 'cors' ? 'editor.media.corsError' : 'editor.media.loadError');
    }
    if (ui.tab === 'media') renderPanel();
  },

  holiday({ id }) {
    const enabled = mergedOverrides()[id]?.enabled !== false;
    setPath(ui.draft, `schedule.${id}.enabled`, !enabled);
    changed({ panel: true });
  },

  expand({ id }) {
    if (ui.expanded.has(id)) ui.expanded.delete(id);
    else ui.expanded.add(id);
    renderPanel();
  },

  previewHoliday({ id }) {
    const holiday = HOLIDAYS.find((h) => h.id === id);
    if (!holiday) return;
    ui.previewDate = occurrence(holiday, ui.previewDate.y).start;
    renderPreview(true);
    renderPanel();
  },

  today() {
    ui.previewDate = ui.today;
    renderPreview(true);
    renderPanel();
  },

  async copy() {
    const area = ui.refs.panel.querySelector('[data-ref-code]');
    let copied = false;
    try {
      await navigator.clipboard.writeText(area.value);
      copied = true;
    } catch {
      area.select();
      try { copied = document.execCommand('copy'); } catch { copied = false; }
    }
    toast(t(copied ? 'editor.share.copied' : 'editor.share.copyFailed'), !copied);
  },

  async import() {
    let imported;
    try {
      imported = decodeTheme(ui.importText);
    } catch {
      toast(t('editor.share.invalid'), true);
      return;
    }
    // Missing fields (e.g. local media that wasn't shared) keep the current values.
    const result = await nui('validate', { theme: { ...clone(ui.draft), ...imported } });
    if (!result?.ok) {
      toast(t('editor.toast.error', { error: errorText(result?.error) }), true);
      return;
    }
    ui.draft = normaliseTheme(result.theme, ui.saved);
    ui.importText = '';
    changed({ panel: true });
    toast(t('editor.share.imported'));
  },

  async restore({ id }) {
    if (!(await confirmDialog(t('editor.history.confirm')))) return;
    await persist('restore', { id }, t('editor.history.restored'));
  },

  async reset() {
    if (!isDirty() || !(await confirmDialog(t('editor.confirm.reset')))) return;
    ui.draft = clone(ui.saved);
    changed({ panel: true });
  },

  async save() {
    if (!isDirty()) return;
    await persist('save', { theme: ui.draft }, t('editor.toast.saved'));
  },

  close() {
    close();
  },
};

/** Save or restore through the server, then adopt the theme it actually stored. */
async function persist(action, data, successMessage) {
  if (ui.busy) return;
  ui.busy = true;
  renderHeader();
  const result = await nui(action, data);
  ui.busy = false;

  if (!result?.ok) {
    renderHeader();
    toast(t('editor.toast.error', { error: errorText(result?.error) }), true);
    return;
  }

  ui.saved = normaliseTheme(result.theme, buildDefaultTheme(ui.t));
  ui.draft = clone(ui.saved);
  if (result.history) ui.payload.history = result.history;
  changed({ panel: true });

  const warnings = result.warnings?.length ? ` ${t('editor.toast.warnings', { fields: result.warnings.join(', ') })}` : '';
  toast(successMessage + warnings, Boolean(warnings));
}

/* -------------------------------------------------------------------------- */
/* Input handling                                                             */
/* -------------------------------------------------------------------------- */

studio.addEventListener('click', (event) => {
  const target = event.target.closest('[data-cmd]');
  if (!target || target.disabled || !studio.contains(target)) return;
  COMMANDS[target.dataset.cmd]?.(target.dataset, target);
});

function handleInput(event) {
  const el = event.target;

  if (el.dataset.local) {
    ui[el.dataset.local] = el.value;
    return;
  }

  if (el.hasAttribute('data-preview-date')) {
    const date = parseISODate(el.value);
    if (date && event.type === 'change') {
      ui.previewDate = date;
      renderPreview(true);
      renderPanel();
    }
    return;
  }

  const path = el.dataset.bind;
  if (!path) return;

  let value = el.value;
  switch (el.dataset.type) {
    case 'number':
      value = Number(value);
      if (!Number.isFinite(value)) return;
      value = Math.min(Number(el.max) || value, Math.max(Number(el.min) || value, Math.round(value)));
      break;
    case 'percent': {
      value = Math.min(1, Math.max(0, Number(value) / 100));
      const label = el.closest('.ed-field')?.querySelector('[data-ref-volume]');
      if (label) label.textContent = `${Math.round(value * 100)}%`;
      break;
    }
    case 'hex':
      value = value.trim();
      if (!/^#[0-9a-f]{6}$/i.test(value)) return; // wait until the hex code is complete
      value = value.toUpperCase();
      break;
    default:
      break;
  }

  setPath(ui.draft, path, value);
  // Colour pickers fire 'input' continuously; only rebuild the panel when done.
  changed({ panel: path === 'accent' && event.type === 'change' });
}

studio.addEventListener('input', handleInput);
studio.addEventListener('change', handleInput);

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !backdrop.classList.contains('is-open')) return;
  if (ui.refs.dialog?.classList.contains('is-open')) return;
  close();
});

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* -------------------------------------------------------------------------- */

function toast(message, isError = false) {
  const node = ui.refs.toast;
  if (!node) return;
  node.textContent = message;
  node.classList.toggle('is-error', isError);
  node.classList.add('is-visible');
  clearTimeout(ui.timers.toast);
  ui.timers.toast = setTimeout(() => node.classList.remove('is-visible'), isError ? 5000 : 3200);
}

function confirmDialog(text) {
  const { dialog, dialogText, dialogYes, dialogNo } = ui.refs;
  dialogText.textContent = text;
  dialogYes.textContent = t('editor.confirm.yes');
  dialogNo.textContent = t('editor.confirm.no');
  dialog.classList.add('is-open');
  return new Promise((resolve) => {
    const done = (answer) => {
      dialog.classList.remove('is-open');
      dialogYes.onclick = null;
      dialogNo.onclick = null;
      resolve(answer);
    };
    dialogYes.onclick = () => done(true);
    dialogNo.onclick = () => done(false);
  });
}

/* -------------------------------------------------------------------------- */
/* Demo mode (opened in a normal browser)                                     */
/* -------------------------------------------------------------------------- */

const demo = {
  history: [],

  payload() {
    const params = new URLSearchParams(window.location.search);
    const now = Math.floor(Date.now() / 1000);
    const counts = [21, 34, 28, 45, 39, 52, 37];
    const week = counts.map((count, i) => {
      const date = new Date((now - (6 - i) * 86400) * 1000);
      return { date: date.toISOString().slice(0, 10), count };
    });
    return {
      version: '1.0.0',
      locale: params.get('locale') || 'tr',
      now,
      timezone: 'Europe/Istanbul',
      utcOffset: 3,
      forceDate: params.get('date'),
      theme: params.get('layout') ? { layout: params.get('layout') } : null,
      history: [],
      stats: { total: 412, average: 38.4, fastest: 12.1, slowest: 141.7, today: counts[6], week },
      schedule: { enabled: true, config: Object.fromEntries(HOLIDAYS.map((h) => [h.id, { enabled: true }])) },
    };
  },

  remember(theme, kind) {
    const entry = { id: `${Date.now()}`, savedAt: Math.floor(Date.now() / 1000), author: 'Demo', kind, theme: clone(theme) };
    demo.history = [entry, ...demo.history].slice(0, 5);
  },

  list() {
    return demo.history.map(({ theme, ...entry }) => entry);
  },

  async request(name, data) {
    switch (name) {
      case 'save':
        demo.remember(data.theme, 'save');
        return { ok: true, theme: data.theme, history: demo.list() };
      case 'validate':
        return { ok: true, theme: data.theme };
      case 'restore': {
        const entry = demo.history.find((e) => e.id === data.id);
        if (!entry) return { ok: false, error: 'not_found' };
        demo.remember(entry.theme, 'restore');
        return { ok: true, theme: entry.theme, history: demo.list() };
      }
      default:
        return { ok: true };
    }
  },
};

if (!IN_FIVEM) {
  document.body.classList.add('is-demo');
  open(demo.payload()).then(() => {
    // ?tab=calendar etc. opens a specific tab (handy for screenshots).
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab) COMMANDS.tab({ tab });
    const banner = document.createElement('div');
    banner.className = 'ed-demo';
    banner.textContent = t('editor.demo');
    document.body.appendChild(banner);
  });
}

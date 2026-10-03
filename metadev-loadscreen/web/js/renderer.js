/**
 * MetaDev Loadscreen · renderer.js
 *
 * Draws a theme onto a 1920×1080 "design stage". Used by BOTH the loading
 * screen and the editor's live preview, so the preview is exact by design.
 *
 *   const renderer = new Renderer(hostElement, { t, mode: 'live', onAction });
 *   renderer.setSize(fitStage(innerWidth, innerHeight));
 *   renderer.setTheme(effectiveTheme);     // full rebuild (rare)
 *   renderer.update({ progress: 0.42 });   // cheap, targeted DOM patches
 *
 * The renderer never plays audio and never talks to FiveM. Clicks are
 * reported through `onAction(name, detail)` and the owner decides what to do.
 */

import { escapeHtml } from './i18n.js';
import { FONTS, CARD_CATEGORIES, backgroundKind, initials } from './themes.js';
import { mountEffect } from './effects.js';

export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;
export const STAGE_COUNT = 4;

/** Glass shows at most this many items per card tab (fits the 300px body). */
const GLASS_ITEMS_PER_TAB = 4;

/* -------------------------------------------------------------------------- */
/* Icons (inline SVG, hand drawn)                                             */
/* -------------------------------------------------------------------------- */

const US_STARS = Array.from({ length: 30 }, (_, i) =>
  `<circle cx="${(1.1 + (i % 6) * 1.95).toFixed(2)}" cy="${(1.15 + Math.floor(i / 6) * 2.1).toFixed(2)}" r="0.45"></circle>`).join('');

export const ICONS = {
  // Turkish flag (from the 29 Ekim design file).
  'flag-tr': '<svg class="holiday-icon" width="36" height="24" viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" rx="2" fill="#E30A17"></rect><circle cx="11" cy="10" r="5" fill="#FFFFFF"></circle><circle cx="12.25" cy="10" r="4" fill="#E30A17"></circle><polygon fill="#FFFFFF" points="15.70,10.00 17.39,9.41 17.43,7.62 18.51,9.05 20.22,8.53 19.20,10.00 20.22,11.47 18.51,10.95 17.43,12.38 17.39,10.59"></polygon></svg>',
  // US flag: 13 stripes, canton with a simplified 6×5 star grid.
  'flag-us': `<svg class="holiday-icon" width="36" height="24" viewBox="0 0 30 20" aria-hidden="true"><defs><clipPath id="mdls-us-clip"><rect width="30" height="20" rx="2"></rect></clipPath></defs><g clip-path="url(#mdls-us-clip)"><rect width="30" height="20" fill="#B22234"></rect><path fill="#FFFFFF" d="M0 1.54h30v1.54H0zM0 4.62h30v1.54H0zM0 7.69h30v1.54H0zM0 10.77h30v1.54H0zM0 13.85h30v1.54H0zM0 16.92h30v1.54H0z"></path><rect width="12.6" height="10.77" fill="#3C3B6E"></rect><g fill="#FFFFFF">${US_STARS}</g></g></svg>`,
  // Shamrock: three heart-shaped leaves rotated around the centre, plus a stem.
  clover: '<svg class="holiday-icon" width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11.5c.6 4.2 2.2 7.6 4.6 10.5" fill="none" stroke="#2FA866" stroke-width="1.6" stroke-linecap="round"></path><g fill="#3DDC84"><g id="mdls-leaf"><circle cx="10.1" cy="5.4" r="2.7"></circle><circle cx="13.9" cy="5.4" r="2.7"></circle><path d="M7.6 6.6h8.8L12 11.4z"></path></g><use href="#mdls-leaf" transform="rotate(120 12 11)"></use><use href="#mdls-leaf" transform="rotate(240 12 11)"></use></g></svg>',

  note: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7E8794" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>',
  prev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 20L9 12l10-8v16z"></path><path d="M5 19V5"></path></svg>',
  next: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4l10 8-10 8V4z"></path><path d="M19 5v14"></path></svg>',
  pause: (size, stroke) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round"><path d="M8 5v14"></path><path d="M16 5v14"></path></svg>`,
  play: (size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"></path></svg>`,
  volume: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M15.5 8.5a5 5 0 0 1 0 7"></path></svg>',
  muted: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M16 9l5 6"></path><path d="M21 9l-5 6"></path></svg>',
  chevronLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>',
  chevronRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"></path></svg>',
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Scales the 1920×1080 design to the viewport. The stage keeps the viewport's
 * aspect ratio, so on ultrawide or 4:3 screens it simply gets wider/taller and
 * the corner-anchored elements stay in their corners.
 */
export function fitStage(viewportWidth, viewportHeight) {
  const scale = Math.min(viewportWidth / DESIGN_WIDTH, viewportHeight / DESIGN_HEIGHT) || 1;
  return { scale, width: Math.round(viewportWidth / scale), height: Math.round(viewportHeight / scale) };
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** "Yaklaşık 40 sn kaldı" / "About 2 min left" */
export function formatEta(seconds, t) {
  if (!Number.isFinite(seconds)) return '';
  if (seconds <= 3) return t('eta.almost');
  const time = seconds < 60
    ? t('eta.seconds', { n: Math.max(5, Math.ceil(seconds / 5) * 5) })
    : t('eta.minutes', { n: Math.ceil(seconds / 60) });
  return t('eta.remaining', { time });
}

/** "2 gün önce" / "2 days ago" */
function relativeTime(fromSeconds, nowSeconds, t) {
  const diff = Math.max(0, nowSeconds - fromSeconds);
  let value = -Math.round(diff / 86400);
  let unit = 'day';
  if (diff < 3600) { value = -Math.max(1, Math.round(diff / 60)); unit = 'minute'; } else if (diff < 86400) { value = -Math.round(diff / 3600); unit = 'hour'; }
  try {
    return new Intl.RelativeTimeFormat(t.intl, { numeric: 'always' }).format(value, unit);
  } catch {
    return `${-value} ${unit}`;
  }
}

/** Minimal shows one line per item: "Title. Body" */
function joinTip(item) {
  const title = String(item.title || '').trim();
  const body = String(item.body || '').trim();
  if (!title || !body) return title || body;
  return /[.!?:…]$/.test(title) ? `${title} ${body}` : `${title}. ${body}`;
}

function iconFor(name) {
  return name && ICONS[name] && typeof ICONS[name] === 'string' ? ICONS[name] : '';
}

/* -------------------------------------------------------------------------- */
/* Renderer                                                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_STATE = {
  players: { online: 0, max: 0 },
  progress: 0,          // 0..1, already smoothed by the caller
  stage: 0,             // 0..3
  finished: false,
  eta: null,            // seconds or null
  track: null,          // { title, artist } or null
  playing: false,
  muted: false,
  volume: 0.4,
  position: 0,
  duration: 0,
  tab: 0,               // index into the non-empty card tabs (Glass)
  tip: 0,               // index into the flattened tip list (Minimal)
  welcome: null,        // { name, lastSeen, now }
  credit: { show: true },
  interval: 8,
};

export class Renderer {
  /**
   * @param {HTMLElement} host
   * @param {object} options
   * @param {Function} options.t         translator from i18n.js
   * @param {'live'|'preview'} options.mode  preview shows sample data in empty slots
   * @param {Function} options.onAction  (name, detail) => void
   */
  constructor(host, { t, mode = 'live', onAction = () => {} }) {
    this.host = host;
    this.t = t;
    this.mode = mode;
    this.onAction = onAction;
    this.size = { width: DESIGN_WIDTH, height: DESIGN_HEIGHT, scale: 1 };
    this.state = { ...DEFAULT_STATE };
    this.theme = null;
    this.refs = {};

    this.root = document.createElement('div');
    this.root.className = 'mdls';
    this.root.addEventListener('click', (event) => this.handleClick(event));
    host.appendChild(this.root);
  }

  /* ----- Public API ----------------------------------------------------- */

  setSize(size) {
    const resized = size.width !== this.size.width || size.height !== this.size.height;
    this.size = { ...size };
    Object.assign(this.root.style, {
      width: `${size.width}px`,
      height: `${size.height}px`,
      transform: `scale(${size.scale})`,
    });
    if (resized && this.theme) this.mountEffects();
  }

  setTheme(theme) {
    this.theme = theme;
    this.cardTabs = CARD_CATEGORIES.filter((cat) => theme.cards?.[cat]?.length);
    this.tips = this.buildTipList(theme);
    this.state.tab = Math.min(this.state.tab, Math.max(0, this.cardTabs.length - 1));
    this.state.tip = Math.min(this.state.tip, Math.max(0, this.tips.length - 1));
    this.build();
  }

  /** Merges partial state and patches only what changed. */
  update(partial) {
    const changed = {};
    for (const [key, value] of Object.entries(partial)) {
      if (this.state[key] !== value) {
        this.state[key] = value;
        changed[key] = true;
      }
    }
    if (this.theme) this.patch(changed);
  }

  /** Number of card tabs (Glass) or tips (Minimal); used for ← → navigation. */
  get cardCount() {
    return this.theme?.layout === 'minimal' ? this.tips.length : this.cardTabs.length;
  }

  /* ----- Derived content ------------------------------------------------ */

  /** Minimal: holiday message first, then tips / rules / updates interleaved. */
  buildTipList(theme) {
    const list = [];
    if (theme.holiday?.message) list.push({ label: theme.holiday.label, text: theme.holiday.message });
    if (!theme.modules?.cards) return list;
    const queues = ['tips', 'rules', 'updates'].map((cat) =>
      (theme.cards?.[cat] || []).map((item) => ({ label: this.t(`cards.labels.${cat}`), text: joinTip(item) })));
    const longest = Math.max(0, ...queues.map((q) => q.length));
    for (let i = 0; i < longest; i += 1) {
      for (const queue of queues) if (queue[i]) list.push(queue[i]);
    }
    return list;
  }

  /** Which music UI to show: 'player', 'note' (remembrance) or null. */
  musicMode() {
    const theme = this.theme;
    if (!theme.modules?.music) return null;
    if (theme.musicDisabled) return 'note';
    if (theme.playlist?.length || this.mode === 'preview') return 'player';
    return null;
  }

  playersVisible() {
    return Boolean(this.theme.modules?.players);
  }

  /* ----- Building ------------------------------------------------------- */

  build() {
    const theme = this.theme;
    const font = FONTS[theme.font] || FONTS.syne;
    const layout = theme.layout === 'minimal' ? 'minimal' : 'glass';

    this.root.className = `mdls layout-${layout}`;
    const style = this.root.style;
    style.setProperty('--accent', theme.accent);
    style.setProperty('--title-font', font.css);
    style.setProperty('--title-weight', String(font.weight));
    style.setProperty('--title-ls', font[layout]);
    style.setProperty('--gray', String(theme.holiday?.grayscale || 0));
    style.setProperty('--tilt', `${theme.holiday?.tilt || 0}deg`);

    this.root.innerHTML = [
      this.backgroundHtml(),
      layout === 'glass' ? '<div class="g-shade-x"></div><div class="g-shade-y"></div>' : '<div class="m-shade-y"></div><div class="m-shade-top"></div>',
      theme.holiday?.shade ? `<div class="mdls-layer" style="background:${theme.holiday.shade}"></div>` : '',
      theme.holiday?.tint ? `<div class="mdls-layer" style="background:${theme.holiday.tint}"></div>` : '',
      '<div class="mdls-fx" data-ref="fx"></div>',
      layout === 'glass' ? this.glassHtml() : this.minimalHtml(),
    ].join('');

    this.refs = {};
    this.root.querySelectorAll('[data-ref]').forEach((node) => { this.refs[node.dataset.ref] = node; });
    this.mountEffects();
    this.patch(Object.fromEntries(Object.keys(DEFAULT_STATE).map((key) => [key, true])));
  }

  mountEffects() {
    if (!this.refs.fx) return;
    mountEffect(this.refs.fx, this.theme.holiday?.effect, this.size);
  }

  backgroundHtml() {
    const src = escapeHtml(this.theme.background?.src || '');
    if (!src) return '<div class="mdls-bg"></div>';
    const media = backgroundKind(this.theme.background) === 'video'
      ? `<video src="${src}" autoplay muted loop playsinline></video>`
      : `<img src="${src}" alt="">`;
    return `<div class="mdls-bg">${media}</div>`;
  }

  welcomeHtml(position) {
    if (!this.theme.modules?.welcome) return '';
    return `<div class="welcome ${position}" data-ref="welcome" hidden></div>`;
  }

  creditHtml(className, inner) {
    return `<a class="${className}" data-ref="credit" data-action="credit" role="link" tabindex="-1">${inner}</a>`;
  }

  glassHtml() {
    const { theme, t } = this;
    const holiday = theme.holiday;
    const logo = theme.logo
      ? `<img src="${escapeHtml(theme.logo)}" alt="">`
      : escapeHtml(initials(theme.serverLabel || theme.serverName));
    const badge = holiday ? `${iconFor(holiday.icon)}${escapeHtml(holiday.badge)}` : escapeHtml(theme.badge);
    const slogan = holiday ? holiday.message : theme.slogan;
    const stageNames = t.raw('stages.names') || [];

    const steps = stageNames.map((name, i) =>
      `<div class="g-step" data-step="${i}"><i></i><div>${escapeHtml(name)}</div></div>`).join('');

    const cards = theme.modules?.cards && this.cardTabs.length ? `
      <aside class="glass-card g-cards">
        <div class="g-tabs" data-ref="tabs">${this.cardTabs.map((cat, i) =>
          `<button class="g-tab" data-action="tab" data-value="${i}">${escapeHtml(t(`cards.tabs.${cat}`))}</button>`).join('')}</div>
        <div class="g-items" data-ref="items"></div>
        <div class="g-cards-foot">
          <div class="g-pips" data-ref="pips">${this.cardTabs.map(() => '<div class="g-pip"></div>').join('')}</div>
          <div class="g-auto" data-ref="auto"></div>
        </div>
      </aside>` : '';

    const musicMode = this.musicMode();
    let music = '';
    if (musicMode === 'note') music = `<div class="g-music-note">${escapeHtml(t('music.respect'))}</div>`;
    if (musicMode === 'player') {
      music = `
      <aside class="glass-card g-music">
        <div class="g-music-row">
          <div class="g-cover">${ICONS.note}</div>
          <div class="g-track">
            <div class="g-now">${escapeHtml(t('music.nowPlaying'))}</div>
            <div class="g-track-title" data-ref="trackTitle"></div>
            <div class="g-track-artist" data-ref="trackArtist"></div>
          </div>
          <div class="g-controls">
            <button class="g-ctrl" data-action="prev" aria-label="${escapeHtml(t('music.prev'))}">${ICONS.prev}</button>
            <button class="g-play" data-action="toggle" data-ref="play" aria-label="${escapeHtml(t('music.toggle'))}"></button>
            <button class="g-ctrl" data-action="next" aria-label="${escapeHtml(t('music.next'))}">${ICONS.next}</button>
          </div>
        </div>
        <div class="g-timeline">
          <div class="g-time" data-ref="timeNow">0:00</div>
          <div class="bar g-seek is-interactive" data-action="seek"><div class="bar-fill" data-ref="seekFill"></div></div>
          <div class="g-time" data-ref="timeTotal">0:00</div>
          <button class="g-vol-btn" data-action="mute" data-ref="volIcon" aria-label="${escapeHtml(t('music.volume'))}"></button>
          <div class="bar g-vol is-interactive" data-action="volume"><div class="bar-fill" data-ref="volFill"></div></div>
        </div>
      </aside>`;
    }

    const hints = [];
    if (musicMode === 'player') hints.push([t('keys.space'), t('keys.pause')]);
    if (cards) hints.push([t('keys.arrows'), t('keys.cards')]);
    if (musicMode === 'player') hints.push([t('keys.m'), t('keys.mute')]);
    const keys = hints.length ? `<footer class="g-keys">${hints.map(([key, label]) =>
      `<div class="key-hint"><span class="kbd">${escapeHtml(key)}</span>${escapeHtml(label)}</div>`).join('')}</footer>` : '';

    return `
      <header class="g-brand">
        <div class="g-logo">${logo}</div>
        <div class="g-brand-text">
          <div class="g-brand-name">${escapeHtml(theme.serverLabel)}</div>
          ${this.playersVisible() ? '<div class="g-players"><div class="dot-online"></div><div data-ref="players"></div></div>' : ''}
        </div>
      </header>
      ${this.welcomeHtml('g-welcome')}
      ${this.creditHtml('g-credit', `${escapeHtml(t('credit.madeBy'))} <span>${escapeHtml(t('credit.brand'))}</span>`)}
      <section class="g-hero">
        <div class="g-hero-text">
          ${badge ? `<div class="g-badge">${badge}</div>` : ''}
          <h1 class="g-title">${escapeHtml(theme.serverName)}</h1>
          ${slogan ? `<p class="g-slogan">${escapeHtml(slogan)}</p>` : ''}
        </div>
        <div class="g-progress">
          <div class="g-progress-head">
            <div class="g-stage">
              <div class="g-stage-label"><span data-ref="stageLabel"></span><span class="g-eta" data-ref="eta"></span></div>
              <div class="g-stage-name" data-ref="stageName"></div>
            </div>
            <div class="g-percent"><span data-ref="percent">0</span><small>%</small></div>
          </div>
          <div class="g-bar"><div class="bar-fill" data-ref="barFill"></div></div>
          <div class="g-steps" data-ref="steps">${steps}</div>
        </div>
      </section>
      ${cards}
      ${music}
      ${keys}`;
  }

  minimalHtml() {
    const { theme, t } = this;
    const holiday = theme.holiday;
    const musicMode = this.musicMode();

    const tip = this.tips.length ? `
      <div class="m-tip">
        ${this.tips.length > 1 ? `<button class="m-round" data-action="tipPrev" aria-label="${escapeHtml(t('cards.prevTip'))}">${ICONS.chevronLeft}</button>` : ''}
        <div class="m-tip-text" data-ref="tipText">
          <div class="m-tip-label" data-ref="tipLabel"></div>
          <div class="m-tip-body" data-ref="tipBody"></div>
        </div>
        ${this.tips.length > 1 ? `<button class="m-round" data-action="tipNext" aria-label="${escapeHtml(t('cards.nextTip'))}">${ICONS.chevronRight}</button>` : ''}
      </div>` : '';

    let music = '';
    if (musicMode === 'note') music = `<div class="m-music-note">${escapeHtml(t('music.respect'))}</div>`;
    if (musicMode === 'player') {
      music = `
        <div class="m-music">
          <div class="m-track">
            <div class="m-track-title" data-ref="trackTitle"></div>
            <div class="m-track-artist" data-ref="trackArtist"></div>
          </div>
          <button class="m-round" data-action="toggle" data-ref="play" aria-label="${escapeHtml(t('music.toggle'))}"></button>
        </div>`;
    }

    return `
      <div class="m-top">
        ${this.playersVisible() ? '<div class="m-players"><div class="dot-online"></div><div data-ref="players"></div></div>' : ''}
        ${this.creditHtml('m-credit', escapeHtml(t('credit.brand')))}
      </div>
      ${this.welcomeHtml('m-welcome')}
      <div class="m-bottom">
        <div class="m-left">
          ${holiday?.badge ? `<div class="m-badge">${iconFor(holiday.icon)}${escapeHtml(holiday.badge)}</div>` : ''}
          <h1 class="m-title">${escapeHtml(theme.serverName)}<span>.</span></h1>
          ${tip}
        </div>
        <div class="m-right">
          ${music}
          <div class="m-status">
            <div class="m-stage" data-ref="stageName"></div>
            <div class="m-percent"><span data-ref="percent">0</span><small>%</small></div>
          </div>
        </div>
      </div>
      <div class="m-line"><div class="bar-fill" data-ref="barFill"></div></div>`;
  }

  /* ----- Patching ------------------------------------------------------- */

  patch(changed) {
    const { state, refs, t, theme } = this;
    const minimal = theme.layout === 'minimal';
    const preview = this.mode === 'preview';

    if (changed.players && refs.players) {
      const players = preview && !state.players.max ? { online: 128, max: 256 } : state.players;
      refs.players.textContent = t(minimal ? 'players.minimal' : 'players.glass', players);
    }

    if (changed.progress || changed.finished) {
      const percent = state.finished ? 100 : Math.min(99, Math.floor(state.progress * 100));
      refs.percent.textContent = String(percent);
      refs.barFill.style.width = `${state.finished ? 100 : (state.progress * 100).toFixed(2)}%`;
    }

    if (changed.stage || changed.finished || changed.eta) {
      const names = t.raw('stages.loading') || [];
      const name = state.finished ? t('stages.done') : (names[state.stage] || '');
      const showEta = theme.modules?.eta && !state.finished && Number.isFinite(state.eta);
      const eta = showEta ? formatEta(state.eta, t) : '';
      if (minimal) {
        refs.stageName.textContent = t.upper(eta ? `${name} · ${eta}` : name);
      } else {
        refs.stageLabel.textContent = t('stages.label', { n: Math.min(state.stage + 1, STAGE_COUNT), total: STAGE_COUNT });
        refs.eta.textContent = eta ? ` · ${t.upper(eta)}` : '';
        refs.stageName.textContent = name;
        refs.steps.querySelectorAll('.g-step').forEach((step, i) => {
          const done = state.finished || i < state.stage;
          step.classList.toggle('is-done', done);
          step.classList.toggle('is-active', !done && i === state.stage);
        });
      }
    }

    if ((changed.track || changed.playing) && refs.trackTitle) {
      const track = state.track || (preview ? { title: t('music.placeholderTitle'), artist: t('music.placeholderArtist') } : { title: '', artist: '' });
      refs.trackTitle.textContent = track.title || '';
      refs.trackArtist.textContent = track.artist || '';
    }

    if (changed.playing && refs.play) {
      const playing = preview ? true : state.playing;
      refs.play.innerHTML = playing
        ? ICONS.pause(minimal ? 14 : 18, minimal ? 2.6 : 2.4)
        : ICONS.play(minimal ? 14 : 18);
    }

    if ((changed.position || changed.duration) && refs.seekFill) {
      const ratio = state.duration > 0 ? state.position / state.duration : (preview ? 0.38 : 0);
      refs.seekFill.style.width = `${(Math.min(1, ratio) * 100).toFixed(2)}%`;
      refs.timeNow.textContent = preview && !state.duration ? '1:24' : formatTime(state.position);
      refs.timeTotal.textContent = preview && !state.duration ? '3:41' : formatTime(state.duration);
    }

    if ((changed.volume || changed.muted) && refs.volFill) {
      refs.volFill.style.width = `${state.muted ? 0 : Math.round(state.volume * 100)}%`;
      refs.volIcon.innerHTML = state.muted ? ICONS.muted : ICONS.volume;
    }

    if ((changed.tab || changed.interval) && refs.items) this.patchCards();
    if (changed.tip && refs.tipBody) this.patchTip();

    if (changed.welcome && refs.welcome) this.patchWelcome();

    if (changed.credit && refs.credit) refs.credit.hidden = state.credit?.show === false;
  }

  patchCards() {
    const { state, refs, t, theme } = this;
    const category = this.cardTabs[state.tab];
    const items = (theme.cards[category] || []).slice(0, GLASS_ITEMS_PER_TAB);
    refs.items.innerHTML = items.map((item, i) => `
      <div class="g-item fade-in">
        <div class="g-item-n">${String(i + 1).padStart(2, '0')}</div>
        <div class="g-item-text">
          <div class="g-item-title">${escapeHtml(item.title)}</div>
          <div class="g-item-body">${escapeHtml(item.body)}</div>
        </div>
      </div>`).join('');
    refs.tabs.querySelectorAll('.g-tab').forEach((tab, i) => tab.classList.toggle('is-active', i === state.tab));
    refs.pips.querySelectorAll('.g-pip').forEach((pip, i) => pip.classList.toggle('is-active', i === state.tab));
    refs.auto.textContent = t('cards.autoRotate', { n: state.interval });
  }

  patchTip() {
    const { refs } = this;
    const tip = this.tips[this.state.tip] || this.tips[0];
    if (!tip) return;
    refs.tipLabel.textContent = `${tip.label} · ${this.state.tip + 1}/${this.tips.length}`;
    refs.tipBody.textContent = tip.text;
    // Restart the fade-in animation for the new text.
    refs.tipText.classList.remove('fade-in');
    void refs.tipText.offsetWidth;
    refs.tipText.classList.add('fade-in');
  }

  patchWelcome() {
    const { refs, t } = this;
    const now = Date.now() / 1000;
    const sample = { name: t('welcome.sampleName'), lastSeen: now - 2 * 86400, now };
    const welcome = this.state.welcome || (this.mode === 'preview' ? sample : null);
    if (!welcome?.name) {
      refs.welcome.hidden = true;
      return;
    }
    const returning = Number.isFinite(welcome.lastSeen) && welcome.lastSeen > 0;
    const sub = returning
      ? t('welcome.lastSeen', { when: relativeTime(welcome.lastSeen, welcome.now || Date.now() / 1000, t) })
      : t('welcome.firstTime');
    refs.welcome.innerHTML = `
      <div class="welcome-avatar">${escapeHtml(welcome.name.trim().charAt(0).toLocaleUpperCase(t.intl))}</div>
      <div class="welcome-text">
        <div class="welcome-name">${escapeHtml(t(returning ? 'welcome.back' : 'welcome.first', { name: welcome.name }))}</div>
        <div class="welcome-sub">${escapeHtml(sub)}</div>
      </div>`;
    refs.welcome.hidden = false;
  }

  /* ----- Input ---------------------------------------------------------- */

  handleClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target || !this.root.contains(target)) return;
    const detail = { value: target.dataset.value };
    if (target.classList.contains('bar')) {
      const rect = target.getBoundingClientRect();
      detail.fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    }
    this.onAction(target.dataset.action, detail);
  }
}

/**
 * MetaDev Loadscreen · loadscreen.js
 *
 * Entry point of the loading screen. Wires together:
 *   server data (deferrals.handover) → theme + scheduled theme → renderer
 *   FiveM loading events            → progress, stage, ETA
 *   playlist, card rotation, keyboard shortcuts, shutdown fade
 *
 * Opened in a normal browser (no handover data) it runs in "dev" mode with
 * sample data. Useful URL parameters in dev mode:
 *   ?layout=minimal   ?locale=en   ?date=2026-10-29   ?demo=1 (replays load events)
 */

import { loadLocale, createI18n } from './i18n.js';
import { resolveToday, findActiveHoliday } from './calendar.js';
import { buildDefaultTheme, normaliseTheme, composeTheme } from './themes.js';
import { Renderer, fitStage } from './renderer.js';
import { LoadProgress, EtaEstimator } from './progress.js';
import { MusicPlayer } from './music.js';

const params = new URLSearchParams(location.search);

/* -------------------------------------------------------------------------- */
/* Server data                                                                */
/* -------------------------------------------------------------------------- */

function readHandover() {
  const data = window.nuiHandoverData?.metadev;
  return data ? { data, dev: false } : { data: devHandover(), dev: true };
}

/** Sample data for opening loadscreen.html directly in a browser. */
function devHandover() {
  const now = Math.floor(Date.now() / 1000);
  return {
    locale: params.get('locale') || 'tr',
    now,
    timezone: 'Europe/Istanbul',
    utcOffset: 3,
    forceDate: params.get('date'),
    players: { online: 128, max: 256 },
    eta: { seconds: 40, source: 'personal' },
    welcome: { name: 'Frik', lastSeen: now - 2 * 86400, now },
    credit: { show: true, url: '' },
    schedule: { enabled: true, overrides: {} },
    theme: params.get('layout') ? { layout: params.get('layout') } : null,
  };
}

/** Opens a link in the player's real browser (never inside the loading screen). */
function openExternal(url) {
  if (!/^https:\/\//.test(url || '')) return;
  try {
    window.invokeNative?.('openUrl', url);
  } catch {
    /* not available outside FiveM */
  }
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
  const { data, dev } = readHandover();
  const { code, dict } = await loadLocale(data.locale);
  const t = createI18n(dict, code);
  document.documentElement.lang = code;

  // 1. Theme: the owner's theme, with today's scheduled theme layered on top.
  const theme = normaliseTheme(data.theme, buildDefaultTheme(t));
  const overrides = data.schedule?.overrides || {};
  const today = resolveToday({ now: data.now, timeZone: data.timezone, utcOffset: data.utcOffset, forceDate: data.forceDate });
  const holiday = findActiveHoliday(today, { locale: code, overrides, enabled: data.schedule?.enabled !== false });
  const effective = composeTheme(theme, holiday, { t, date: today, overrides });

  // 2. Renderer
  const app = document.getElementById('app');
  const progress = new LoadProgress();
  const eta = new EtaEstimator(effective.modules.eta ? data.eta?.seconds : null);
  let music = null;

  const cards = createCardRotation(() => renderer, effective.cards.interval);

  const renderer = new Renderer(app, {
    t,
    mode: 'live',
    onAction(action, detail) {
      switch (action) {
        case 'toggle': music?.toggle(); break;
        case 'prev': music?.prev(); break;
        case 'next': music?.next(); break;
        case 'mute': music?.toggleMute(); break;
        case 'volume': music?.setVolume(detail.fraction); break;
        case 'seek': music?.seek(detail.fraction); break;
        case 'tab': cards.go(Number(detail.value)); break;
        case 'tipPrev': cards.step(-1); break;
        case 'tipNext': cards.step(1); break;
        case 'credit': openExternal(data.credit?.url); break;
        default: break;
      }
    },
  });

  const resize = () => renderer.setSize(fitStage(window.innerWidth, window.innerHeight));
  resize();
  window.addEventListener('resize', resize);
  renderer.setTheme(effective);
  renderer.update({
    players: data.players || { online: 0, max: 0 },
    welcome: data.welcome ? { ...data.welcome, now: data.now } : null,
    credit: data.credit || { show: true },
    interval: effective.cards.interval,
  });

  // Reveal once fonts are ready so the first frame is already correct.
  try { await document.fonts.ready; } catch { /* ignore */ }
  app.classList.add('is-ready');

  // 3. Music
  if (renderer.musicMode() === 'player' && effective.playlist.length) {
    music = new MusicPlayer({
      playlist: effective.playlist,
      volume: effective.music.volume,
      shuffle: effective.music.shuffle,
      onChange: (state) => renderer.update(state),
    });
    music.start();
  }

  cards.start();

  // 4. Progress: FiveM posts loading events to this window.
  const loop = createProgressLoop(progress, eta, renderer);
  window.addEventListener('message', (event) => {
    let message = event.data;
    if (typeof message === 'string') {
      try { message = JSON.parse(message); } catch { return; }
    }
    if (message?.eventName === 'metadev:shutdown') {
      shutdown(message.fadeMs);
      return;
    }
    if (progress.handle(message)) loop.wake();
  });

  // 5. Keyboard shortcuts
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    switch (event.code) {
      case 'Space': event.preventDefault(); music?.toggle(); break;
      case 'ArrowLeft': cards.step(-1); break;
      case 'ArrowRight': cards.step(1); break;
      case 'KeyM': music?.toggleMute(); break;
      default: break;
    }
  });

  /** Called by client/main.lua right before ShutdownLoadingScreenNui(). */
  function shutdown(fadeMs = 800) {
    progress.finish();
    renderer.update({ finished: true });
    loop.wake();
    cards.stop();
    music?.stop(fadeMs);
    app.style.setProperty('--leave-ms', `${fadeMs}ms`);
    app.classList.add('is-leaving');
  }

  if (dev && params.has('demo')) replayDemo(progress, loop, shutdown);
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Auto-rotating cards (Glass tabs / Minimal tips). Any manual change restarts
 * the timer so the user's choice stays on screen for a full interval.
 */
function createCardRotation(getRenderer, intervalSeconds) {
  let timer = 0;
  const ms = Math.max(3, Number(intervalSeconds) || 8) * 1000;

  const key = () => (getRenderer().theme.layout === 'minimal' ? 'tip' : 'tab');
  const go = (index) => {
    const renderer = getRenderer();
    const count = renderer.cardCount;
    if (count < 1) return;
    renderer.update({ [key()]: ((index % count) + count) % count });
    restart();
  };
  const step = (direction) => go(getRenderer().state[key()] + direction);
  const restart = () => {
    clearInterval(timer);
    timer = setInterval(() => step(1), ms);
  };

  return { go, step, start: restart, stop: () => clearInterval(timer) };
}

/**
 * Animation loop for the progress bar. Runs only while the bar is moving and
 * goes to sleep otherwise, so an idle loading screen costs ~0 CPU.
 */
function createProgressLoop(progress, eta, renderer) {
  let frame = 0;
  let last = 0;
  let lastEta = 0;

  const tick = (now) => {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016;
    last = now;
    const value = progress.tick(dt);
    const patch = { progress: value, stage: progress.stage };
    if (now - lastEta > 1000) {
      lastEta = now;
      patch.eta = eta.update(value, progress.elapsed());
    }
    renderer.update(patch);
    frame = value < progress.target ? requestAnimationFrame(tick) : 0;
  };

  // The ETA should keep counting down even when no events arrive.
  setInterval(() => {
    if (!frame) renderer.update({ eta: eta.update(progress.display, progress.elapsed()) });
  }, 1000);

  return {
    wake() {
      if (frame) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    },
  };
}

/** Dev only (`?demo=1`): replays a typical sequence of FiveM loading events. */
function replayDemo(progress, loop, shutdown) {
  const events = [
    { eventName: 'startInitFunctionOrder', type: 'INIT_CORE', count: 6 },
    ...Array.from({ length: 6 }, (_, idx) => ({ eventName: 'initFunctionInvoking', type: 'INIT_CORE', idx })),
    { eventName: 'startDataFileEntries', count: 30 },
    ...Array.from({ length: 30 }, () => ({ eventName: 'onDataFileEntry' })),
    { eventName: 'startInitFunctionOrder', type: 'INIT_AFTER_MAP_LOADED', count: 8 },
    ...Array.from({ length: 8 }, (_, idx) => ({ eventName: 'initFunctionInvoking', type: 'INIT_AFTER_MAP_LOADED', idx })),
    { eventName: 'startInitFunctionOrder', type: 'INIT_SESSION', count: 4 },
    ...Array.from({ length: 4 }, (_, idx) => ({ eventName: 'initFunctionInvoking', type: 'INIT_SESSION', idx })),
  ];
  events.forEach((event, i) => setTimeout(() => {
    if (progress.handle(event)) loop.wake();
  }, 600 + i * 350));
  setTimeout(() => shutdown(800), 600 + events.length * 350 + 2500);
}

main().catch((error) => console.error('[metadev-loadscreen]', error));

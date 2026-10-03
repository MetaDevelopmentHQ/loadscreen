/**
 * MetaDev Loadscreen · themes.js
 *
 * The theme data model shared by the loading screen and the editor:
 *   - constants (fonts, swatches, modules)
 *   - the preset gallery
 *   - `composeTheme()`, which lays a scheduled (holiday) theme on top of the
 *     server owner's own theme.
 *
 * The authoritative validation lives on the server (server/theme_store.lua).
 * `normaliseTheme()` here only fills gaps so the renderer never crashes.
 */

import { holidayVars } from './calendar.js';
import { interpolate } from './i18n.js';

export const THEME_VERSION = 1;

export const LAYOUTS = ['glass', 'minimal'];

/**
 * Title fonts. `glass` / `minimal` hold the per-layout letter-spacing; the
 * Syne values come straight from the design files, the others are tuned to
 * the same optical width.
 */
export const FONTS = {
  syne: { label: 'Syne', css: "'Syne', sans-serif", weight: 800, glass: '-5px', minimal: '-2px' },
  manrope: { label: 'Manrope', css: "'Manrope', sans-serif", weight: 700, glass: '-4px', minimal: '-1.5px' },
  serif: { label: 'Serif', css: "'Instrument Serif', serif", weight: 400, glass: '-2px', minimal: '-1px' },
};

/** The six preset accent colours shown in the editor. */
export const ACCENT_SWATCHES = ['#F5B544', '#7CE7C3', '#8EA8FF', '#FF7A6B', '#E58CFF', '#F2F3F5'];

/** Toggleable modules, in the order the editor lists them. */
export const MODULES = ['welcome', 'music', 'cards', 'players', 'eta'];

export const CARD_CATEGORIES = ['rules', 'updates', 'tips'];

export const DEFAULT_ACCENT = '#F5B544';

/**
 * Preset gallery. A preset only sets look-and-feel (layout, accent, font);
 * it never touches the server's texts, logo or media.
 *
 * To add a preset, append an object here. `layout` must be one of LAYOUTS;
 * `name` is shown as-is (or `nameKey` is looked up in the locale file).
 */
export const GALLERY = [
  { id: 'glass', nameKey: 'editor.gallery.glass', layout: 'glass', accent: DEFAULT_ACCENT, font: 'syne' },
  { id: 'minimal', nameKey: 'editor.gallery.minimal', layout: 'minimal', accent: DEFAULT_ACCENT, font: 'syne' },
];

export function applyPreset(theme, preset) {
  return { ...theme, layout: preset.layout, accent: preset.accent, font: preset.font };
}

/**
 * The out-of-the-box theme. Mirrors `ThemeStore.Default()` in Lua and is
 * only used when the page runs without server data (browser preview).
 */
export function buildDefaultTheme(t) {
  const content = t.raw('defaults') || {};
  return {
    version: THEME_VERSION,
    layout: 'glass',
    accent: DEFAULT_ACCENT,
    font: 'syne',
    modules: { welcome: true, music: true, cards: true, players: true, eta: true },
    serverName: content.serverName || 'MetaV',
    serverLabel: content.serverLabel || 'MetaV Roleplay',
    badge: content.badge || '',
    slogan: content.slogan || '',
    logo: '',
    background: { src: 'media/background.webp', type: 'auto' },
    cards: {
      interval: 8,
      rules: content.cards?.rules || [],
      updates: content.cards?.updates || [],
      tips: content.cards?.tips || [],
    },
    playlist: [],
    music: { volume: 0.4, shuffle: false },
    schedule: {},
  };
}

/** Fills missing fields from a base theme (shallow per section). */
export function normaliseTheme(theme, base) {
  const input = theme && typeof theme === 'object' ? theme : {};
  return {
    ...base,
    ...input,
    modules: { ...base.modules, ...(input.modules || {}) },
    background: { ...base.background, ...(input.background || {}) },
    cards: { ...base.cards, ...(input.cards || {}) },
    music: { ...base.music, ...(input.music || {}) },
    playlist: Array.isArray(input.playlist) ? input.playlist : base.playlist,
    schedule: input.schedule && !Array.isArray(input.schedule) ? input.schedule : {},
    layout: LAYOUTS.includes(input.layout) ? input.layout : base.layout,
    font: FONTS[input.font] ? input.font : base.font,
  };
}

/** Image or video? `type: 'auto'` decides by file extension. */
export function backgroundKind(background) {
  if (background?.type === 'image' || background?.type === 'video') return background.type;
  return /\.(webm|mp4|ogv)(\?|#|$)/i.test(background?.src || '') ? 'video' : 'image';
}

/** Letters shown in the logo box when no logo image is set ("MetaV Roleplay" → "MV"). */
export function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'MD';
  const first = words[0];
  // "MetaV" → "MV": take capitals from a single camel-cased word.
  const capitals = first.match(/\p{Lu}/gu);
  if (words.length === 1) return (capitals && capitals.length > 1 ? capitals.slice(0, 2).join('') : first.slice(0, 2)).toUpperCase();
  return (capitals && capitals.length > 1 ? capitals.slice(0, 2).join('') : words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Merges a scheduled theme into the owner's theme.
 *
 * Only accent, tint, effect, badge, message and (optionally) music change.
 * Layout, logo, server name and content stay exactly as configured.
 *
 * @param {object} theme      Owner's theme (normalised)
 * @param {object|null} holiday  Result of findActiveHoliday()
 * @param {object} ctx        { t, date, overrides }
 */
export function composeTheme(theme, holiday, { t, date, overrides = {} }) {
  if (!holiday) return { ...theme, holiday: null };

  const override = overrides?.[holiday.id] || {};
  const vars = holidayVars(holiday, date);
  const text = (field) => {
    const custom = override[field];
    const source = typeof custom === 'string' && custom.trim() ? custom : t(`holidays.${holiday.id}.${field}`);
    return interpolate(source, vars);
  };
  const remembrance = holiday.mode === 'remembrance';

  return {
    ...theme,
    accent: holiday.accent,
    playlist: Array.isArray(override.playlist) && override.playlist.length ? override.playlist : theme.playlist,
    musicDisabled: remembrance,
    holiday: {
      id: holiday.id,
      mode: holiday.mode,
      tint: holiday.tint,
      shade: holiday.shade,
      grayscale: holiday.grayscale,
      effect: holiday.effect,
      icon: holiday.icon,
      tilt: holiday.tilt,
      badge: text('badge'),
      message: text('message'),
      label: t(`holidays.${holiday.id}.label`),
    },
  };
}

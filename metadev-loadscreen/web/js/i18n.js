/**
 * MetaDev Loadscreen · i18n.js
 *
 * Tiny translation helper. Strings live in `locales/<code>.json`; adding a
 * language means adding one JSON file (plus its Lua twin for server messages).
 */

const FALLBACK_LOCALE = 'en';

/** Fetches a locale file; falls back to English, then to an empty dictionary. */
export async function loadLocale(code, baseUrl = '../locales/') {
  for (const candidate of [code, FALLBACK_LOCALE]) {
    try {
      const response = await fetch(`${baseUrl}${candidate}.json`);
      if (response.ok) return { code: candidate, dict: await response.json() };
    } catch {
      /* try the next candidate */
    }
  }
  return { code: FALLBACK_LOCALE, dict: {} };
}

/** Replaces `{name}` placeholders. Unknown placeholders are left untouched. */
export function interpolate(text, vars = {}) {
  return String(text).replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

/**
 * Creates a translator bound to a dictionary.
 *
 *   const t = createI18n(dict);
 *   t('players.glass', { online: 12, max: 64 });
 *   t.raw('stages.names') // → the raw array/object
 */
export function createI18n(dict, code = FALLBACK_LOCALE) {
  const lookup = (key) => key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dict);

  const t = (key, vars) => {
    const value = lookup(key);
    return typeof value === 'string' ? interpolate(value, vars) : key;
  };
  t.raw = lookup;
  t.has = (key) => lookup(key) !== undefined;
  t.code = code;
  /** BCP 47 tag for Intl APIs, e.g. "tr-TR". */
  t.intl = dict?.meta?.intl || code;
  /** Locale-aware upper-casing (Turkish "i" → "İ"). */
  t.upper = (text) => String(text).toLocaleUpperCase(t.intl);
  return t;
}

/** Escapes text before it is placed inside HTML. Every user string goes through this. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

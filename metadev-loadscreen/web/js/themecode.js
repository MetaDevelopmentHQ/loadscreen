/**
 * MetaDev Loadscreen · themecode.js
 *
 * Shareable theme codes: "MDLS1:" + LZ-string compressed JSON.
 *
 * Media files are never embedded. Only https:// links travel with the code;
 * local paths (media/…) are dropped because they only exist on the original
 * server. When importing, missing fields keep the importer's current values,
 * and the result is validated by the server before it can be saved.
 */

import LZString from './vendor/lz-string.js';

export const PREFIX = 'MDLS1:';

/** Hard cap on the decompressed size, so a hostile code can't freeze the page. */
const MAX_JSON_LENGTH = 200000;

const isRemote = (src) => /^https:\/\//i.test(src || '');

/** Removes everything that shouldn't leave this server. */
export function portableTheme(theme) {
  const copy = JSON.parse(JSON.stringify(theme));
  if (!isRemote(copy.logo)) delete copy.logo;
  if (!isRemote(copy.background?.src)) delete copy.background;
  copy.playlist = (copy.playlist || []).filter((track) => isRemote(track.src));
  if (!copy.playlist.length) delete copy.playlist;
  return copy;
}

export function encodeTheme(theme) {
  return PREFIX + LZString.compressToEncodedURIComponent(JSON.stringify(portableTheme(theme)));
}

/**
 * Decodes a theme code. Throws on anything that isn't a valid code.
 * The returned object is still untrusted: send it to the server to validate.
 */
export function decodeTheme(code) {
  const text = String(code || '').trim();
  if (!text.startsWith(PREFIX)) throw new Error('prefix');
  const json = LZString.decompressFromEncodedURIComponent(text.slice(PREFIX.length));
  if (!json || json.length > MAX_JSON_LENGTH) throw new Error('payload');
  const theme = JSON.parse(json);
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) throw new Error('shape');
  return theme;
}

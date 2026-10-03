/**
 * MetaDev Loadscreen · music.js
 *
 * Playlist player built on a single <audio> element. Every volume change
 * (play, pause, mute, track switch, shutdown) is a short fade instead of a
 * hard cut. The player is UI-agnostic: it reports state through `onChange`.
 */

const STORAGE_KEY = 'metadev-loadscreen:audio';

const FADE_IN_MS = 1200;
const FADE_OUT_MS = 500;
const SWITCH_MS = 300;

function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable: preferences simply aren't remembered */
  }
}

export class MusicPlayer {
  /**
   * @param {object} options
   * @param {{title:string, artist:string, src:string}[]} options.playlist
   * @param {number}  options.volume   default volume 0..1 (theme setting)
   * @param {boolean} options.shuffle
   * @param {Function} options.onChange (state) => void
   */
  constructor({ playlist, volume = 0.4, shuffle = false, onChange = () => {} }) {
    const prefs = readPrefs();
    this.playlist = playlist.filter((track) => track?.src);
    this.shuffle = shuffle;
    this.onChange = onChange;
    this.volume = Number.isFinite(prefs.volume) ? prefs.volume : volume;
    this.muted = Boolean(prefs.muted);
    this.index = shuffle ? Math.floor(Math.random() * this.playlist.length) : 0;
    this.playing = false;
    this.failures = 0;
    this.fadeFrame = 0;

    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.volume = 0;
    this.audio.addEventListener('timeupdate', () => this.emit());
    this.audio.addEventListener('loadedmetadata', () => this.emit());
    this.audio.addEventListener('ended', () => this.next());
    this.audio.addEventListener('playing', () => { this.failures = 0; });
    this.audio.addEventListener('error', () => this.handleError());
  }

  get track() {
    return this.playlist[this.index] || null;
  }

  /** Level the <audio> element should reach when not fading out. */
  get audibleVolume() {
    return this.muted ? 0 : this.volume;
  }

  emit() {
    this.onChange({
      track: this.track ? { title: this.track.title, artist: this.track.artist } : null,
      playing: this.playing,
      muted: this.muted,
      volume: this.volume,
      position: this.audio.currentTime || 0,
      duration: Number.isFinite(this.audio.duration) ? this.audio.duration : 0,
    });
  }

  /** Smoothly moves the element volume. Resolves when the fade completes. */
  fade(to, ms) {
    cancelAnimationFrame(this.fadeFrame);
    const from = this.audio.volume;
    const started = performance.now();
    return new Promise((resolve) => {
      const step = (now) => {
        const k = Math.min(1, (now - started) / ms);
        this.audio.volume = Math.min(1, Math.max(0, from + (to - from) * k));
        if (k < 1) this.fadeFrame = requestAnimationFrame(step);
        else resolve();
      };
      this.fadeFrame = requestAnimationFrame(step);
    });
  }

  load(index) {
    if (!this.playlist.length) return;
    this.index = (index + this.playlist.length) % this.playlist.length;
    this.audio.src = this.track.src;
    this.emit();
  }

  async start() {
    if (!this.playlist.length) return;
    this.load(this.index);
    await this.play();
  }

  async play() {
    if (!this.track) return;
    if (!this.audio.src) this.load(this.index);
    this.playing = true;
    this.emit();
    try {
      await this.audio.play();
      await this.fade(this.audibleVolume, FADE_IN_MS);
    } catch {
      // Autoplay blocked or bad source: show the paused state, let the user retry.
      this.playing = false;
      this.emit();
    }
  }

  async pause() {
    this.playing = false;
    this.emit();
    await this.fade(0, FADE_OUT_MS);
    if (!this.playing) this.audio.pause();
  }

  toggle() {
    return this.playing ? this.pause() : this.play();
  }

  async skip(direction) {
    if (this.playlist.length < 2) return;
    const wasPlaying = this.playing;
    await this.fade(0, SWITCH_MS);
    const nextIndex = this.shuffle
      ? (this.index + 1 + Math.floor(Math.random() * (this.playlist.length - 1))) % this.playlist.length
      : this.index + direction;
    this.load(nextIndex);
    if (wasPlaying) await this.play();
  }

  next() { return this.skip(1); }

  prev() {
    // Like most players: "previous" restarts the song if we're past 3 seconds.
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return Promise.resolve();
    }
    return this.skip(-1);
  }

  setVolume(volume) {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.volume > 0) this.muted = false;
    if (this.playing) this.fade(this.audibleVolume, 150);
    writePrefs({ volume: this.volume, muted: this.muted });
    this.emit();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.playing) this.fade(this.audibleVolume, 400);
    writePrefs({ volume: this.volume, muted: this.muted });
    this.emit();
  }

  seek(fraction) {
    if (Number.isFinite(this.audio.duration)) this.audio.currentTime = fraction * this.audio.duration;
  }

  /** Fades out and stops; used right before the loading screen closes. */
  async stop(ms = FADE_OUT_MS) {
    this.playing = false;
    await this.fade(0, ms);
    this.audio.pause();
  }

  handleError() {
    this.failures += 1;
    // Skip broken tracks, but give up once every track has failed in a row.
    if (this.failures >= this.playlist.length) {
      this.playing = false;
      this.emit();
      return;
    }
    this.load(this.index + 1);
    if (this.playing) this.play();
  }
}

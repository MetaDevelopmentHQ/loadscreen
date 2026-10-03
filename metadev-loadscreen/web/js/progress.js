/**
 * MetaDev Loadscreen · progress.js
 *
 * Turns FiveM's loading-screen events into a single, monotonic progress value
 * and a stage index. Nothing is simulated: every change comes from an event.
 *
 * Stages:  0 Resources  →  1 Maps  →  2 Vehicles  →  3 Character
 *
 *   INIT_CORE / INIT_BEFORE_MAP_LOADED      → Resources
 *   startDataFileEntries / performMapLoad…  → Maps
 *   INIT_AFTER_MAP_LOADED                   → Vehicles (streamed assets)
 *   INIT_SESSION, then waiting for spawn    → Character
 *
 * The overall value is the larger of FiveM's own `loadFraction` and the
 * stage-based estimate, capped below 100 % until the client confirms spawn.
 */

const STAGE_BY_INIT_TYPE = {
  INIT_CORE: 0,
  INIT_BEFORE_MAP_LOADED: 0,
  INIT_AFTER_MAP_LOADED: 2,
  INIT_SESSION: 3,
};

export const STAGES = 4;

/** Progress never shows 100 % before the player has actually spawned. */
const CAP_BEFORE_SPAWN = 0.97;

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

export class LoadProgress {
  constructor() {
    this.startedAt = performance.now();
    this.stage = 0;
    this.stagePart = 0;     // 0..1 progress inside the current stage
    this.fraction = 0;      // FiveM loadFraction
    this.target = 0;        // where the bar is heading
    this.display = 0;       // smoothed value shown on screen
    this.finished = false;
    this.order = { count: 0 };
    this.files = { count: 0, done: 0 };
  }

  /** Feed every `message` event's data here. Returns true if anything changed. */
  handle(data) {
    if (!data || typeof data.eventName !== 'string') return false;
    const before = `${this.stage}:${this.target}`;

    switch (data.eventName) {
      case 'loadProgress':
        this.fraction = Math.max(this.fraction, clamp01(data.loadFraction));
        break;
      case 'startInitFunctionOrder':
        this.advanceStage(STAGE_BY_INIT_TYPE[data.type] ?? this.stage);
        this.order = { count: Number(data.count) || 0 };
        break;
      case 'initFunctionInvoking':
        if (this.order.count > 0) this.setStagePart((Number(data.idx) + 1) / this.order.count);
        break;
      case 'startDataFileEntries':
        this.advanceStage(1);
        this.files = { count: Number(data.count) || 0, done: 0 };
        break;
      case 'onDataFileEntry':
        this.files.done += 1;
        if (this.stage === 1 && this.files.count > 0) this.setStagePart(this.files.done / this.files.count);
        break;
      case 'performMapLoadFunction':
        this.advanceStage(1);
        break;
      case 'endDataFileEntries':
        if (this.stage === 1) this.setStagePart(1);
        break;
      default:
        return false;
    }

    this.recompute();
    return before !== `${this.stage}:${this.target}`;
  }

  advanceStage(stage) {
    // Stages only move forward; events from earlier phases may still arrive.
    if (stage > this.stage) {
      this.stage = stage;
      this.stagePart = 0;
    }
  }

  setStagePart(part) {
    this.stagePart = Math.max(this.stagePart, clamp01(part));
  }

  recompute() {
    if (this.finished) return;
    const byStage = (this.stage + this.stagePart) / STAGES;
    const next = Math.min(CAP_BEFORE_SPAWN, Math.max(this.fraction * CAP_BEFORE_SPAWN, byStage));
    this.target = Math.max(this.target, next);
  }

  /** Called when the client reports a full spawn. */
  finish() {
    this.finished = true;
    this.stage = STAGES - 1;
    this.target = 1;
  }

  /**
   * Eases the displayed value toward the target. Call once per frame.
   * @param {number} dt seconds since the previous frame
   */
  tick(dt) {
    const speed = this.finished ? 8 : 3;
    const next = this.display + (this.target - this.display) * (1 - Math.exp(-dt * speed));
    this.display = this.target - next < 0.0005 ? this.target : Math.max(this.display, next);
    return this.display;
  }

  /** Seconds since the loading screen appeared. */
  elapsed() {
    return (performance.now() - this.startedAt) / 1000;
  }
}

/**
 * Remaining-time estimator.
 *
 * Starts from the server's estimate (this player's last load, or the server
 * average) and blends in the real loading speed as progress grows, so the
 * number follows reality instead of counting down blindly.
 */
export class EtaEstimator {
  constructor(expectedSeconds) {
    this.expected = Number(expectedSeconds) > 0 ? Number(expectedSeconds) : null;
    this.shown = null;
  }

  get enabled() {
    return this.expected !== null;
  }

  update(progress, elapsed) {
    if (!this.enabled) return null;
    const p = clamp01(progress);
    const fromHistory = this.expected * (1 - p);
    const fromSpeed = p > 0.05 ? (elapsed / p) - elapsed : fromHistory;
    const estimate = Math.max(0, fromHistory * (1 - p) + fromSpeed * p);

    // Count down smoothly; only jump up if we are clearly slower than expected.
    if (this.shown === null || estimate < this.shown || estimate > this.shown + 10) this.shown = estimate;
    return this.shown;
  }
}

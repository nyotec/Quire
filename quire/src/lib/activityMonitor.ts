/**
 * Activity monitor: fires onLock when the user has been idle for getTimeoutMs(),
 * or when the tab has been hidden for getHiddenTimeoutMs().
 *
 * - 0 from either getter disables that timer.
 * - bump() resets the inactivity timer; visibilitychange→visible also bumps.
 * - mousemove is throttled aggressively so editing doesn't spam the path.
 * - Each instance keeps its own timers; no shared state across tabs.
 */

const MOUSEMOVE_THROTTLE_MS = 5_000;

export class ActivityMonitor {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  private lastActivity = Date.now();
  private lastMouseMove = 0;
  private running = false;

  constructor(
    private onLock: () => void,
    private getTimeoutMs: () => number,
    private getHiddenTimeoutMs: () => number,
  ) {}

  start(): void {
    if (this.running || typeof window === 'undefined') return;
    this.running = true;
    window.addEventListener('keydown', this.onKey, { passive: true });
    window.addEventListener('mousedown', this.onActivity, { passive: true });
    window.addEventListener('touchstart', this.onActivity, { passive: true });
    window.addEventListener('wheel', this.onActivity, { passive: true });
    window.addEventListener('mousemove', this.onMouseMove, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.bump();
  }

  stop(): void {
    if (!this.running || typeof window === 'undefined') return;
    this.running = false;
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('mousedown', this.onActivity);
    window.removeEventListener('touchstart', this.onActivity);
    window.removeEventListener('wheel', this.onActivity);
    window.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.clearTimers();
  }

  /** Reset the inactivity timer. Called externally (e.g. on settings change). */
  bump(): void {
    this.lastActivity = Date.now();
    this.scheduleInactivity();
  }

  /** Re-read the current timeouts and reschedule. Use after settings change. */
  reschedule(): void {
    this.bump();
  }

  forceLock(): void {
    this.clearTimers();
    this.onLock();
  }

  private onKey = (_e: KeyboardEvent) => this.onActivity();
  private onActivity = () => this.bump();

  private onMouseMove = () => {
    const now = Date.now();
    if (now - this.lastMouseMove < MOUSEMOVE_THROTTLE_MS) return;
    this.lastMouseMove = now;
    this.bump();
  };

  private onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      this.clearHidden();
      this.bump();
    } else {
      this.scheduleHidden();
    }
  };

  private scheduleInactivity() {
    if (this.timer) clearTimeout(this.timer);
    const ms = this.getTimeoutMs();
    if (ms <= 0) {
      this.timer = null;
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.onLock();
    }, ms);
  }

  private scheduleHidden() {
    if (this.hiddenTimer) clearTimeout(this.hiddenTimer);
    const ms = this.getHiddenTimeoutMs();
    if (ms <= 0) {
      this.hiddenTimer = null;
      return;
    }
    this.hiddenTimer = setTimeout(() => {
      this.hiddenTimer = null;
      this.onLock();
    }, ms);
  }

  private clearHidden() {
    if (this.hiddenTimer) {
      clearTimeout(this.hiddenTimer);
      this.hiddenTimer = null;
    }
  }

  private clearTimers() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.clearHidden();
  }
}

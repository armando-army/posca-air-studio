// Keep gesture timing independent of the camera and the page layout.
export class GestureController {
  constructor() { this.reset(); }
  reset() {
    this.pinched = false;
    this.targetId = null;
    this.enteredAt = 0;
    this.holdStarted = null;
    this.armed = false;
    this.activated = false;
    this.needsRelease = true;
    this.drawing = false;
  }
  step({ ratio, now, target = null, allowPaint = true }) {
    const wasPinched = this.pinched;
    this.pinched = ratio < (wasPinched ? .48 : .34);
    const closing = this.pinched && !wasPinched;
    let activate = null, progress = 0;
    if ((target?.id ?? null) !== this.targetId) {
      this.targetId = target?.id ?? null;
      this.enteredAt = now;
      this.holdStarted = null;
      this.armed = !this.pinched;
      this.activated = false;
    }
    if (target) {
      this.drawing = false;
      this.needsRelease = true;
      if (!this.pinched) this.armed = true;
      if (!this.activated) {
        if (target.kind === 'hold') {
          if (this.pinched && this.armed) {
            if (this.holdStarted === null) this.holdStarted = now;
            progress = Math.min(1, (now - this.holdStarted) / 2000);
            if (progress === 1) activate = target.id;
          } else this.holdStarted = null;
        } else {
          progress = Math.min(1, (now - this.enteredAt) / (target.delay ?? 1000));
          if (progress === 1 || (target.kind !== 'dwell' && closing && this.armed)) activate = target.id;
        }
        if (activate) { this.activated = true; progress = 1; }
      }
    } else if (!allowPaint) {
      this.drawing = false;
      this.needsRelease = true;
    } else {
      if (!this.pinched) this.needsRelease = false;
      this.drawing = this.pinched && !this.needsRelease;
    }
    return { activate, progress, pinched: this.pinched, drawing: this.drawing };
  }
}
export function widthFromGap(ratio) {
  return Math.round(12 + Math.max(0, Math.min(1, (ratio - .22) / 1.35)) * 78);
}

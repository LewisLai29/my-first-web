export class PausableGameClock {
    source;
    origin;
    pausedAt = null;
    pausedDuration = 0;
    constructor(source = () => performance.now()) {
        this.source = source;
        this.origin = source();
    }
    now() {
        const current = this.pausedAt ?? this.source();
        return Math.max(0, current - this.origin - this.pausedDuration);
    }
    pause() {
        if (this.pausedAt === null)
            this.pausedAt = this.source();
    }
    resume() {
        if (this.pausedAt === null)
            return;
        this.pausedDuration += this.source() - this.pausedAt;
        this.pausedAt = null;
    }
    reset() {
        this.origin = this.source();
        this.pausedAt = null;
        this.pausedDuration = 0;
    }
}

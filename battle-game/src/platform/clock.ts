export type ClockSource = () => number;

export interface GameClock {
    now(): number;
    pause(): void;
    resume(): void;
    reset(): void;
}

export class PausableGameClock implements GameClock {
    private origin: number;
    private pausedAt: number | null = null;
    private pausedDuration = 0;

    constructor(private readonly source: ClockSource = () => performance.now()) {
        this.origin = source();
    }

    now(): number {
        const current = this.pausedAt ?? this.source();
        return Math.max(0, current - this.origin - this.pausedDuration);
    }

    pause(): void {
        if (this.pausedAt === null) this.pausedAt = this.source();
    }

    resume(): void {
        if (this.pausedAt === null) return;
        this.pausedDuration += this.source() - this.pausedAt;
        this.pausedAt = null;
    }

    reset(): void {
        this.origin = this.source();
        this.pausedAt = null;
        this.pausedDuration = 0;
    }
}

export type ClockSource = () => number;
export interface GameClock {
    now(): number;
    pause(): void;
    resume(): void;
    reset(): void;
}
export declare class PausableGameClock implements GameClock {
    private readonly source;
    private origin;
    private pausedAt;
    private pausedDuration;
    constructor(source?: ClockSource);
    now(): number;
    pause(): void;
    resume(): void;
    reset(): void;
}

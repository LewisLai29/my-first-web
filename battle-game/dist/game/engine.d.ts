import type { GameClock } from '../platform/clock.js';
import type { WordfrontConfig } from './config.js';
import type { GameEffect, GameState, PauseReason, QuestionState } from './types.js';
export interface EngineView {
    render(state: Readonly<GameState>, now: number): void;
    play(effect: GameEffect): Promise<void>;
    setAnimationsPaused(paused: boolean): void;
}
export type WordfrontEngine = {
    start: () => void;
    submitAnswer: (entryId: string) => void;
    pause: (reason: PauseReason) => void;
    clearPauseReason: (reason: PauseReason) => void;
    resume: () => void;
    getState: () => Readonly<GameState>;
    destroy: () => void;
};
export declare function createEngine({ config, questions, clock, view, }: {
    config: WordfrontConfig;
    questions: readonly QuestionState[];
    clock: GameClock;
    view: EngineView;
}): WordfrontEngine;

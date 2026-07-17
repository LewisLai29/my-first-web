import type { EngineView } from '../game/engine.js';
import type { GameEffect, GameState, VocabularyEntry } from '../game/types.js';
import { type WordfrontInputHandlers } from './input.js';
export declare class DomWordfrontView implements EngineView {
    private readonly root;
    private readonly questionDurationMs;
    private readonly entriesById;
    private readonly animations;
    private readonly cleanupInput;
    private lastQuestionId;
    private lastWaveKey;
    private lastResultRevision;
    constructor(root: HTMLElement, entries: readonly VocabularyEntry[], handlers: WordfrontInputHandlers, questionDurationMs: number);
    render(state: Readonly<GameState>, now: number): void;
    play(effect: GameEffect): Promise<void>;
    setAnimationsPaused(paused: boolean): void;
    destroy(): void;
    private renderWave;
    private renderQuestion;
    private renderScreens;
    private renderResult;
    private escape;
}

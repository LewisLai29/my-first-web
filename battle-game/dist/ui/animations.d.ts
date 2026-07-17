import type { GameEffect } from '../game/types.js';
export declare class WordfrontAnimations {
    private readonly root;
    private readonly active;
    private readonly frameRequests;
    private paused;
    constructor(root: HTMLElement);
    setPaused(paused: boolean): void;
    play(effect: GameEffect): Promise<void>;
    destroy(): void;
    private animate;
    private playerAttack;
    private playPlayerFrames;
    private enemyAttack;
    private enemyDeath;
}

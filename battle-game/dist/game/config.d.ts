import type { EnemyKind } from '../entities/enemy/enemy-types.js';
export type EnemyGroupConfig = {
    kind: EnemyKind;
    count: number;
};
export type WaveConfig = {
    enemies: readonly EnemyGroupConfig[];
};
export type WordfrontConfig = {
    questionDurationMs: number;
    wrongPenaltyMs: number;
    waveTransitionMs: number;
    waves: readonly WaveConfig[];
};
export declare const DEFAULT_CONFIG: WordfrontConfig;

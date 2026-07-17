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

export const DEFAULT_CONFIG: WordfrontConfig = {
    questionDurationMs: 10_000,
    wrongPenaltyMs: 3_000,
    waveTransitionMs: 3_000,
    waves: [
        { enemies: [{ kind: 'normal', count: 3 }] },
        { enemies: [{ kind: 'strong', count: 3 }] },
        { enemies: [{ kind: 'strong', count: 3 }, { kind: 'boss', count: 1 }] },
    ],
};

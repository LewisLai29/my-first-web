export const DEFAULT_CONFIG = {
    questionDurationMs: 10_000,
    wrongPenaltyMs: 3_000,
    waveTransitionMs: 3_000,
    waves: [
        { enemies: [{ kind: 'normal', count: 3 }] },
        { enemies: [{ kind: 'strong', count: 3 }] },
        { enemies: [{ kind: 'strong', count: 3 }, { kind: 'boss', count: 1 }] },
    ],
};

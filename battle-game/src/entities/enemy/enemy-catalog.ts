import type { EnemyDefinition, EnemyKind } from './enemy-types.js';

export const ENEMY_CATALOG: Readonly<Record<EnemyKind, EnemyDefinition>> = {
    normal: { kind: 'normal', hp: 2, damage: 10, maxAdvanceStep: 4 },
    strong: { kind: 'strong', hp: 3, damage: 15, maxAdvanceStep: 4 },
    boss: { kind: 'boss', hp: 5, damage: 20, maxAdvanceStep: 4 },
};

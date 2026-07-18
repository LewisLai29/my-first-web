import type { EnemyDefinition, EnemyKind } from './enemy-types.js';

export const ENEMY_CATALOG: Readonly<Record<EnemyKind, EnemyDefinition>> = {
    normal: { kind: 'normal', hp: 8, attack: 15, defense: 1, maxAdvanceStep: 4 },
    strong: { kind: 'strong', hp: 12, attack: 22, defense: 2, maxAdvanceStep: 4 },
    boss: { kind: 'boss', hp: 15, attack: 30, defense: 3, maxAdvanceStep: 4 },
};

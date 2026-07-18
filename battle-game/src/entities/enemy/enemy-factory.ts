import { ENEMY_CATALOG } from './enemy-catalog.js';
import type { EnemyKind, EnemyState } from './enemy-types.js';

export function createEnemy(kind: EnemyKind, id: string): EnemyState {
    const definition = ENEMY_CATALOG[kind];
    return {
        id,
        kind,
        hp: definition.hp,
        maxHp: definition.hp,
        attack: definition.attack,
        defense: definition.defense,
        advanceStep: 0,
        maxAdvanceStep: definition.maxAdvanceStep,
    };
}

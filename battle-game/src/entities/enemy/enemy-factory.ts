import { ENEMY_CATALOG } from './enemy-catalog.js';
import type { EnemyKind, EnemyState } from './enemy-types.js';

export function createEnemy(kind: EnemyKind, id: string): EnemyState {
    const definition = ENEMY_CATALOG[kind];
    return {
        id,
        kind,
        hp: definition.hp,
        maxHp: definition.hp,
        attackDamage: definition.damage,
        advanceStep: 0,
        maxAdvanceStep: definition.maxAdvanceStep,
    };
}

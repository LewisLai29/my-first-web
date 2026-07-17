import { ENEMY_CATALOG } from './enemy-catalog.js';
export function createEnemy(kind, id) {
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

import type { EnemyState } from './enemy-types.js';

export function damageEnemy(enemy: EnemyState, damage: number): EnemyState {
    return {
        ...enemy,
        hp: Math.max(0, Math.min(enemy.maxHp, enemy.hp - Math.max(0, damage))),
    };
}

export function advanceEnemy(enemy: EnemyState): EnemyState {
    return {
        ...enemy,
        advanceStep: Math.min(enemy.maxAdvanceStep, enemy.advanceStep + 1),
    };
}

export function isEnemyDefeated(enemy: EnemyState): boolean {
    return enemy.hp <= 0;
}

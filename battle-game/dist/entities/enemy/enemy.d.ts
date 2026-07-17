import type { EnemyState } from './enemy-types.js';
export declare function damageEnemy(enemy: EnemyState, damage: number): EnemyState;
export declare function advanceEnemy(enemy: EnemyState): EnemyState;
export declare function isEnemyDefeated(enemy: EnemyState): boolean;

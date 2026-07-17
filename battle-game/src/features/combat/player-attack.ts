import { damageEnemy } from '../../entities/enemy/enemy.js';
import type { EnemyState } from '../../entities/enemy/enemy-types.js';
import { clampDamage } from './damage.js';

export function resolvePlayerAttack(enemy: EnemyState, damage: number): EnemyState {
    return damageEnemy(enemy, clampDamage(damage));
}

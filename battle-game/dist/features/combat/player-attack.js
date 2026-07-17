import { damageEnemy } from '../../entities/enemy/enemy.js';
import { clampDamage } from './damage.js';
export function resolvePlayerAttack(enemy, damage) {
    return damageEnemy(enemy, clampDamage(damage));
}

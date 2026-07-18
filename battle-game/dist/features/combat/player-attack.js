import { damageEnemy } from '../../entities/enemy/enemy.js';
import { calculateDamage } from './damage.js';
export function resolvePlayerAttack(player, enemy) {
    const damage = calculateDamage(player.attack, enemy.defense);
    return { enemy: damageEnemy(enemy, damage), damage };
}

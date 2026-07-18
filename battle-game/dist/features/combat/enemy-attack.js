import { advanceEnemy } from '../../entities/enemy/enemy.js';
import { damagePlayer } from '../../entities/player/player.js';
import { calculateDamage } from './damage.js';
export function resolveEnemyAttack(enemy, player) {
    const damage = calculateDamage(enemy.attack, player.defense);
    return {
        enemy: advanceEnemy(enemy),
        player: damagePlayer(player, damage),
        damage,
    };
}

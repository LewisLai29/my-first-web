import { advanceEnemy } from '../../entities/enemy/enemy.js';
import { damagePlayer } from '../../entities/player/player.js';
export function resolveEnemyAttack(enemy, player) {
    return {
        enemy: advanceEnemy(enemy),
        player: damagePlayer(player, enemy.attackDamage),
    };
}

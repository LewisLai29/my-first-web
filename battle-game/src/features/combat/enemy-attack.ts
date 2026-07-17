import { advanceEnemy } from '../../entities/enemy/enemy.js';
import type { EnemyState } from '../../entities/enemy/enemy-types.js';
import { damagePlayer } from '../../entities/player/player.js';
import type { PlayerState } from '../../entities/player/player-types.js';

export type EnemyAttackResult = {
    enemy: EnemyState;
    player: PlayerState;
};

export function resolveEnemyAttack(enemy: EnemyState, player: PlayerState): EnemyAttackResult {
    return {
        enemy: advanceEnemy(enemy),
        player: damagePlayer(player, enemy.attackDamage),
    };
}

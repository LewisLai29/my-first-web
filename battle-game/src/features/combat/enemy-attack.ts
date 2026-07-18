import { advanceEnemy } from '../../entities/enemy/enemy.js';
import type { EnemyState } from '../../entities/enemy/enemy-types.js';
import { damagePlayer } from '../../entities/player/player.js';
import type { PlayerState } from '../../entities/player/player-types.js';
import { calculateDamage } from './damage.js';

export type EnemyAttackResult = {
    enemy: EnemyState;
    player: PlayerState;
    damage: number;
};

export function resolveEnemyAttack(enemy: EnemyState, player: PlayerState): EnemyAttackResult {
    const damage = calculateDamage(enemy.attack, player.defense);
    return {
        enemy: advanceEnemy(enemy),
        player: damagePlayer(player, damage),
        damage,
    };
}

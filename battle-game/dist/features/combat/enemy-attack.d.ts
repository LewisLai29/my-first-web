import type { EnemyState } from '../../entities/enemy/enemy-types.js';
import type { PlayerState } from '../../entities/player/player-types.js';
export type EnemyAttackResult = {
    enemy: EnemyState;
    player: PlayerState;
};
export declare function resolveEnemyAttack(enemy: EnemyState, player: PlayerState): EnemyAttackResult;

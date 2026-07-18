import type { EnemyState } from '../../entities/enemy/enemy-types.js';
import type { PlayerState } from '../../entities/player/player-types.js';
export type PlayerAttackResult = {
    enemy: EnemyState;
    damage: number;
};
export declare function resolvePlayerAttack(player: PlayerState, enemy: EnemyState): PlayerAttackResult;

import { damageEnemy } from '../../entities/enemy/enemy.js';
import type { EnemyState } from '../../entities/enemy/enemy-types.js';
import type { PlayerState } from '../../entities/player/player-types.js';
import { calculateDamage } from './damage.js';

export type PlayerAttackResult = {
    enemy: EnemyState;
    damage: number;
};

export function resolvePlayerAttack(player: PlayerState, enemy: EnemyState): PlayerAttackResult {
    const damage = calculateDamage(player.attack, enemy.defense);
    return { enemy: damageEnemy(enemy, damage), damage };
}

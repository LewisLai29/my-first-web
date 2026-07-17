import { PLAYER_ATTACK_DAMAGE, PLAYER_MAX_HP } from './player-config.js';
import type { PlayerState } from './player-types.js';

export function createPlayer(): PlayerState {
    return {
        hp: PLAYER_MAX_HP,
        maxHp: PLAYER_MAX_HP,
        attackDamage: PLAYER_ATTACK_DAMAGE,
    };
}

export function damagePlayer(player: PlayerState, damage: number): PlayerState {
    return {
        ...player,
        hp: Math.max(0, Math.min(player.maxHp, player.hp - Math.max(0, damage))),
    };
}

import type { PlayerState } from './player-types.js';
export declare function createPlayer(): PlayerState;
export declare function attackForStreak(correctStreak: number): number;
export declare function addCorrectAnswer(player: PlayerState): PlayerState;
export declare function resetCorrectStreak(player: PlayerState): PlayerState;
export declare function damagePlayer(player: PlayerState, damage: number): PlayerState;

import { PLAYER_BASE_ATTACK, PLAYER_DEFENSE, PLAYER_MAX_ATTACK_BONUS, PLAYER_MAX_HP, PLAYER_STREAK_THRESHOLD, } from './player-config.js';
export function createPlayer() {
    return {
        hp: PLAYER_MAX_HP,
        maxHp: PLAYER_MAX_HP,
        attack: PLAYER_BASE_ATTACK,
        defense: PLAYER_DEFENSE,
        correctStreak: 0,
    };
}
export function attackForStreak(correctStreak) {
    const streak = Number.isFinite(correctStreak) ? Math.max(0, Math.floor(correctStreak)) : 0;
    const bonus = Math.min(PLAYER_MAX_ATTACK_BONUS, Math.max(0, streak - PLAYER_STREAK_THRESHOLD + 1));
    return PLAYER_BASE_ATTACK + bonus;
}
export function addCorrectAnswer(player) {
    const correctStreak = player.correctStreak + 1;
    return { ...player, correctStreak, attack: attackForStreak(correctStreak) };
}
export function resetCorrectStreak(player) {
    return { ...player, correctStreak: 0, attack: PLAYER_BASE_ATTACK };
}
export function damagePlayer(player, damage) {
    return {
        ...player,
        hp: Math.max(0, Math.min(player.maxHp, player.hp - Math.max(0, damage))),
    };
}

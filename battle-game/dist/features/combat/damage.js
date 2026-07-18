function statValue(value) {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
export function calculateDamage(attack, defense) {
    return Math.max(1, statValue(attack) - statValue(defense));
}

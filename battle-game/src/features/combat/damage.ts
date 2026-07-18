function statValue(value: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function calculateDamage(attack: number, defense: number): number {
    return Math.max(1, statValue(attack) - statValue(defense));
}

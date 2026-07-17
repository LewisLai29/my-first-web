export function clampDamage(value) {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}

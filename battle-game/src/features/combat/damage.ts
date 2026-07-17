export function clampDamage(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}

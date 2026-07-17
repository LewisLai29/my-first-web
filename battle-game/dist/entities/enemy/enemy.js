export function damageEnemy(enemy, damage) {
    return {
        ...enemy,
        hp: Math.max(0, Math.min(enemy.maxHp, enemy.hp - Math.max(0, damage))),
    };
}
export function advanceEnemy(enemy) {
    return {
        ...enemy,
        advanceStep: Math.min(enemy.maxAdvanceStep, enemy.advanceStep + 1),
    };
}
export function isEnemyDefeated(enemy) {
    return enemy.hp <= 0;
}

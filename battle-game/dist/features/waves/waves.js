import { createEnemy } from '../../entities/enemy/enemy-factory.js';
import { calculateDamage } from '../combat/damage.js';
export function createWaves(configs) {
    return configs.map((config, waveIndex) => {
        let enemySequence = 0;
        return {
            index: waveIndex,
            activeEnemyIndex: 0,
            enemies: config.enemies.flatMap((group) => Array.from({ length: group.count }, () => {
                enemySequence += 1;
                return createEnemy(group.kind, `wave-${waveIndex + 1}-enemy-${enemySequence}`);
            })),
        };
    });
}
export function countRequiredPlayerAttacks(waves, playerAttack) {
    return waves.reduce((total, wave) => total + wave.enemies.reduce((waveTotal, enemy) => (waveTotal + Math.ceil(enemy.maxHp / calculateDamage(playerAttack, enemy.defense))), 0), 0);
}

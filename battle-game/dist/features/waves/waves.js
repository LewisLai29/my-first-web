import { createEnemy } from '../../entities/enemy/enemy-factory.js';
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
export function countWaveHp(waves) {
    return waves.reduce((total, wave) => total + wave.enemies.reduce((waveTotal, enemy) => (waveTotal + enemy.maxHp), 0), 0);
}

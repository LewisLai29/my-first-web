import { createEnemy } from '../../entities/enemy/enemy-factory.js';
import type { WaveConfig } from '../../game/config.js';
import type { WaveState } from '../../game/types.js';

export function createWaves(configs: readonly WaveConfig[]): WaveState[] {
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

export function countWaveHp(waves: readonly WaveState[]): number {
    return waves.reduce((total, wave) => total + wave.enemies.reduce((waveTotal, enemy) => (
        waveTotal + enemy.maxHp
    ), 0), 0);
}

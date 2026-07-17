import type { WaveConfig } from '../../game/config.js';
import type { WaveState } from '../../game/types.js';
export declare function createWaves(configs: readonly WaveConfig[]): WaveState[];
export declare function countWaveHp(waves: readonly WaveState[]): number;

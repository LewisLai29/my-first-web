import type { PauseReason } from '../game/types.js';
export type LifecycleHandlers = {
    pause: (reason: PauseReason) => void;
    clearPauseReason: (reason: PauseReason) => void;
};
export declare function bindGameLifecycle(handlers: LifecycleHandlers): () => void;

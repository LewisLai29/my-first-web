import type { PauseReason } from '../game/types.js';

export type LifecycleHandlers = {
    pause: (reason: PauseReason) => void;
    clearPauseReason: (reason: PauseReason) => void;
};

export function bindGameLifecycle(handlers: LifecycleHandlers): () => void {
    const portraitMedia = window.matchMedia('(orientation: portrait) and (max-width: 900px)');

    const onVisibility = (): void => {
        if (document.visibilityState === 'visible') handlers.clearPauseReason('hidden');
        else handlers.pause('hidden');
    };
    const onBlur = (): void => handlers.pause('blur');
    const onFocus = (): void => handlers.clearPauseReason('blur');
    const onOrientation = (): void => {
        if (portraitMedia.matches) handlers.pause('portrait');
        else handlers.clearPauseReason('portrait');
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    portraitMedia.addEventListener('change', onOrientation);
    onVisibility();
    onOrientation();

    return () => {
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('focus', onFocus);
        portraitMedia.removeEventListener('change', onOrientation);
    };
}

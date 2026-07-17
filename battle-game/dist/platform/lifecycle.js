export function bindGameLifecycle(handlers) {
    const portraitMedia = window.matchMedia('(orientation: portrait) and (max-width: 900px)');
    const onVisibility = () => {
        if (document.visibilityState === 'visible')
            handlers.clearPauseReason('hidden');
        else
            handlers.pause('hidden');
    };
    const onBlur = () => handlers.pause('blur');
    const onFocus = () => handlers.clearPauseReason('blur');
    const onOrientation = () => {
        if (portraitMedia.matches)
            handlers.pause('portrait');
        else
            handlers.clearPauseReason('portrait');
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

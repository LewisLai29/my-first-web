export function createHomePopupController({
    popupIds,
    getElement,
    onCancelMode = () => {},
    onUnloadMode = () => {},
} = {}) {
    let activeMode = '';

    const getPopup = (mode) => {
        const popupId = popupIds && popupIds[mode];
        return popupId ? getElement(popupId) : null;
    };

    const isModeOpen = (mode) => {
        const popup = getPopup(mode);
        return activeMode === mode && Boolean(popup && !popup.hidden && popup.classList.contains('open'));
    };

    const isAnyOpen = () => Boolean(activeMode && isModeOpen(activeMode));

    const close = (mode, { clearActive = true } = {}) => {
        const popup = getPopup(mode);
        if (!popup || popup.hidden) {
            if (clearActive && activeMode === mode) {
                activeMode = '';
            }
            return;
        }

        onCancelMode(mode);
        popup.classList.remove('open');
        window.setTimeout(() => {
            if (!popup.classList.contains('open')) {
                popup.hidden = true;
            }
        }, 180);

        if (clearActive && activeMode === mode) {
            activeMode = '';
        }
    };

    const show = (mode) => {
        const popup = getPopup(mode);
        if (!popup) return false;

        popup.hidden = false;
        popup.classList.add('open');
        activeMode = mode;
        return true;
    };

    const prepareExclusive = (mode) => {
        Object.keys(popupIds || {}).forEach((otherMode) => {
            if (otherMode === mode) return;
            close(otherMode, { clearActive: false });
            onUnloadMode(otherMode);
        });

        activeMode = mode;
    };

    const reset = () => {
        activeMode = '';
        Object.keys(popupIds || {}).forEach((mode) => {
            const popup = getPopup(mode);
            if (!popup) return;

            popup.classList.remove('open');
            popup.hidden = true;
        });
    };

    return {
        close,
        getPopup,
        isAnyOpen,
        isModeOpen,
        prepareExclusive,
        reset,
        show,
    };
}

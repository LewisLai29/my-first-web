export function createPopupScrollbarController({
    popupSelector = '.setting-popup',
    scrollBodySelector = '.custom-scrollbar-content',
    trackSelector = '.custom-scrollbar',
    thumbSelector = '.custom-scrollbar-thumb',
} = {}) {
    let resizeObserver = null;
    let mutationObserver = null;

    const getScrollElement = (popup) => (
        popup ? popup.querySelector(scrollBodySelector) : null
    );

    const update = (popup) => {
        const scrollElement = getScrollElement(popup);
        const track = popup ? popup.querySelector(trackSelector) : null;
        const thumb = track ? track.querySelector(thumbSelector) : null;
        if (!scrollElement || !track || !thumb) return;

        const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;
        if (maxScrollTop <= 1) {
            track.hidden = true;
            return;
        }

        track.hidden = false;
        const trackHeight = track.clientHeight;
        const thumbHeight = Math.max(48, Math.round((scrollElement.clientHeight / scrollElement.scrollHeight) * trackHeight));
        const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
        const thumbTop = Math.round((scrollElement.scrollTop / maxScrollTop) * maxThumbTop);

        thumb.style.height = `${thumbHeight}px`;
        thumb.style.transform = `translateY(${thumbTop}px)`;
    };

    const wire = (popup) => {
        const scrollElement = getScrollElement(popup);
        const track = popup ? popup.querySelector(trackSelector) : null;
        const thumb = track ? track.querySelector(thumbSelector) : null;
        if (!popup || !scrollElement || !track || !thumb || popup.dataset.scrollbarWired === 'true') return;

        popup.dataset.scrollbarWired = 'true';
        scrollElement.addEventListener('scroll', () => update(popup));

        thumb.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const startY = event.clientY;
            const startScrollTop = scrollElement.scrollTop;
            const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;
            const maxThumbTop = track.clientHeight - thumb.offsetHeight;
            if (maxScrollTop <= 0 || maxThumbTop <= 0) return;

            thumb.classList.add('dragging');
            thumb.setPointerCapture(event.pointerId);

            const onPointerMove = (moveEvent) => {
                const deltaY = moveEvent.clientY - startY;
                scrollElement.scrollTop = startScrollTop + ((deltaY / maxThumbTop) * maxScrollTop);
            };

            const onPointerUp = () => {
                thumb.classList.remove('dragging');
                thumb.removeEventListener('pointermove', onPointerMove);
                thumb.removeEventListener('pointerup', onPointerUp);
                thumb.removeEventListener('pointercancel', onPointerUp);
            };

            thumb.addEventListener('pointermove', onPointerMove);
            thumb.addEventListener('pointerup', onPointerUp);
            thumb.addEventListener('pointercancel', onPointerUp);
        });

        thumb.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    };

    const refresh = () => {
        document.querySelectorAll(popupSelector).forEach((popup) => {
            wire(popup);
            update(popup);
        });
    };

    const observe = () => {
        if (!resizeObserver && 'ResizeObserver' in window) {
            resizeObserver = new ResizeObserver(refresh);
            document.querySelectorAll(scrollBodySelector).forEach((body) => resizeObserver.observe(body));
        }

        if (!mutationObserver && 'MutationObserver' in window) {
            mutationObserver = new MutationObserver(refresh);
            document.querySelectorAll(scrollBodySelector).forEach((body) => {
                mutationObserver.observe(body, { childList: true, subtree: true, characterData: true });
            });
        }
    };

    const dispose = () => {
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }

        if (mutationObserver) {
            mutationObserver.disconnect();
            mutationObserver = null;
        }
    };

    return {
        observe,
        refresh,
        dispose,
    };
}

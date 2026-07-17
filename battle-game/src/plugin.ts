import type { WordfrontController } from './controller.js';

type PluginLifecycle = {
    cancel?: () => void;
    unload?: () => void;
};

type HomePopupController = {
    close: (mode: string) => void;
    isModeOpen: (mode: string) => boolean;
    prepareExclusive: (mode: string) => void;
    show: (mode: string) => boolean;
};

export type WordfrontPluginContext = {
    document: Document;
    getElement: (id: string) => HTMLElement | null;
    vocabularyUrl: string | URL;
    home: {
        root: HTMLElement;
        features: HTMLElement;
        popupController: HomePopupController;
        registerPopupMode: (mode: string, popupId: string, lifecycle: PluginLifecycle) => () => void;
    };
};

export function activate(context: WordfrontPluginContext) {
    const { document, getElement, home, vocabularyUrl } = context;
    const mode = 'wordfront';
    const playerAsset = new URL('../assets/player/mage-base.png', import.meta.url).href;

    const tile = document.createElement('a');
    tile.id = 'start-wordfront';
    tile.className = 'feature-tile feature-tile-wordfront';
    tile.href = '#wordfront-overlay';
    tile.setAttribute('aria-label', 'Open Wordfront vocabulary battle');
    tile.innerHTML = `
        <span class="feature-tile-top">
            <span class="feature-tile-icon feature-tile-image-icon" aria-hidden="true">
                <img class="feature-tile-image wordfront-tile-image" src="${playerAsset}" alt="">
            </span>
        </span>
        <span class="feature-tile-copy">
            <span class="feature-tile-label">Wordfront</span>
            <span class="feature-tile-description">Defend the line with vocabulary magic</span>
        </span>`;

    const overlay = document.createElement('div');
    overlay.id = 'wordfront-overlay';
    overlay.className = 'setting-popup wordfront-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Wordfront vocabulary battle');
    overlay.hidden = true;
    overlay.innerHTML = `
        <div class="wordfront-overlay-window">
            <button id="wordfront-overlay-fullscreen" class="wordfront-overlay-fullscreen" type="button" aria-label="Enter fullscreen" title="Enter fullscreen" hidden>
                <span aria-hidden="true">&#x26F6;</span>
            </button>
            <button id="wordfront-overlay-close" class="wordfront-overlay-close" type="button" aria-label="Close Wordfront">×</button>
            <div id="wordfront-root" class="wordfront-root"></div>
        </div>`;

    home.features.appendChild(tile);
    home.root.appendChild(overlay);

    let controller: WordfrontController | null = null;
    let controllerPromise: Promise<WordfrontController> | null = null;
    const root = getElement('wordfront-root') as HTMLElement;
    const fullscreenButton = getElement('wordfront-overlay-fullscreen') as HTMLButtonElement;

    const syncFullscreenButton = (): void => {
        const canFullscreen = typeof overlay.requestFullscreen === 'function';
        const isFullscreen = document.fullscreenElement === overlay;
        const label = isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen';
        fullscreenButton.hidden = !canFullscreen;
        fullscreenButton.setAttribute('aria-label', label);
        fullscreenButton.title = label;
        fullscreenButton.classList.toggle('is-fullscreen', isFullscreen);
    };

    const requestFullscreen = (): void => {
        if (document.fullscreenElement || typeof overlay.requestFullscreen !== 'function') return;
        void overlay.requestFullscreen()
            .then(() => {
                if (!home.popupController.isModeOpen(mode)) exitFullscreen();
            })
            .catch(() => {
                // Fullscreen can be denied by browser or embedding policy; the game still works as a modal.
            });
    };
    const exitFullscreen = (): void => {
        if (document.fullscreenElement !== overlay || typeof document.exitFullscreen !== 'function') return;
        void document.exitFullscreen().catch(() => {
            // The browser may already be leaving fullscreen (for example after pressing Escape).
        });
    };
    const toggleFullscreen = (): void => {
        if (document.fullscreenElement === overlay) exitFullscreen();
        else requestFullscreen();
    };
    const close = (): void => {
        exitFullscreen();
        home.popupController.close(mode);
    };
    const getController = async (): Promise<WordfrontController> => {
        if (controller) return controller;
        if (!controllerPromise) {
            controllerPromise = import('./controller.js').then(({ createWordfrontController }) => {
                controller = createWordfrontController({ root, vocabularyUrl, onClose: close });
                return controller;
            }).catch((error: unknown) => {
                controllerPromise = null;
                throw error;
            });
        }
        return controllerPromise;
    };

    const open = (): void => {
        home.popupController.prepareExclusive(mode);
        home.popupController.show(mode);
        requestFullscreen();
        void getController().then((instance) => instance.open()).catch((error: unknown) => {
            root.innerHTML = '<div class="wordfront-load-state" role="alert"><div><p>Wordfront unavailable</p><h2>The game module could not be loaded.</h2></div></div>';
            console.error('Failed to open Wordfront.', error);
        });
    };

    const unregister = home.registerPopupMode(mode, 'wordfront-overlay', {
        cancel: () => {
            exitFullscreen();
            controller?.destroySession();
        },
        unload: () => {
            exitFullscreen();
            controller?.destroySession();
        },
    });

    const onTileClick = (event: Event): void => {
        event.preventDefault();
        open();
    };
    const onFullscreenClick = (): void => toggleFullscreen();
    const onCloseClick = (): void => close();
    const onBackdropClick = (event: Event): void => {
        if (event.target === overlay) close();
    };
    tile.addEventListener('click', onTileClick);
    fullscreenButton.addEventListener('click', onFullscreenClick);
    getElement('wordfront-overlay-close')?.addEventListener('click', onCloseClick);
    overlay.addEventListener('click', onBackdropClick);
    document.addEventListener('fullscreenchange', syncFullscreenButton);
    syncFullscreenButton();

    const quickTools = getElement('home-quick-tools-count');
    if (quickTools) quickTools.textContent = String((Number(quickTools.textContent) || 4) + 1);

    return {
        dispose: () => {
            exitFullscreen();
            controller?.destroy();
            unregister();
            tile.removeEventListener('click', onTileClick);
            fullscreenButton.removeEventListener('click', onFullscreenClick);
            getElement('wordfront-overlay-close')?.removeEventListener('click', onCloseClick);
            overlay.removeEventListener('click', onBackdropClick);
            document.removeEventListener('fullscreenchange', syncFullscreenButton);
            tile.remove();
            overlay.remove();
            if (quickTools) quickTools.textContent = String(Math.max(4, (Number(quickTools.textContent) || 5) - 1));
        },
    };
}

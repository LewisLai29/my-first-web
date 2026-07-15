import type { GamePopupController } from './popup-controller.js';

type HomePopupController = {
    close: (mode: string) => void;
    isModeOpen: (mode: string) => boolean;
    prepareExclusive: (mode: string) => void;
    show: (mode: string) => boolean;
};

export type GameHomeIntegrationOptions = {
    getElement: (id: string) => HTMLElement | null;
    popupController: HomePopupController;
    vocabularyUrl: string | URL;
};

export function createGameHomeIntegration({
    getElement,
    popupController,
    vocabularyUrl,
}: GameHomeIntegrationOptions) {
    let controller: GamePopupController | null = null;
    let controllerPromise: Promise<GamePopupController> | null = null;
    let wiredTile: HTMLElement | null = null;

    const getController = async (): Promise<GamePopupController> => {
        if (controller) return controller;
        if (!controllerPromise) {
            controllerPromise = import('./popup-controller.js').then(({ createGamePopupController }) => {
                controller = createGamePopupController({ getElement, popupController, vocabularyUrl });
                return controller;
            }).catch((error: unknown) => {
                controllerPromise = null;
                throw error;
            });
        }
        return controllerPromise;
    };

    const showModuleError = (error: unknown): void => {
        popupController.prepareExclusive('game');
        popupController.show('game');
        const body = getElement('game-popup-body');
        if (body) {
            body.innerHTML = '<div class="game-load-error" role="alert"><div><h2>Game unavailable</h2><p>The memory game could not be loaded. Please try again.</p></div><button class="game-retry-button" id="game-retry" type="button">Try again</button></div>';
            getElement('game-retry')?.addEventListener('click', open);
        }
        console.error('Failed to open memory game.', error);
    };

    const open = (): void => {
        getController().then((gameController) => gameController.open()).catch(showModuleError);
    };

    const close = (): void => {
        if (controller) controller.close();
        else popupController.close('game');
    };

    const wire = (): void => {
        const tile = getElement('start-game');
        if (!tile || wiredTile === tile) return;
        wiredTile = tile;
        tile.addEventListener('click', (event) => {
            event.preventDefault();
            open();
        });
        getElement('game-popup-close')?.addEventListener('click', close);
        getElement('game-popup')?.addEventListener('click', (event) => {
            if (event.target === getElement('game-popup')) close();
        });
    };

    return {
        wire,
        close,
        destroySession: (): void => controller?.destroySession(),
        destroy: (): void => controller?.destroy(),
    };
}

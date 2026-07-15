export function createGameHomeIntegration({ getElement, popupController, vocabularyUrl, }) {
    let controller = null;
    let controllerPromise = null;
    let wiredTile = null;
    const getController = async () => {
        if (controller)
            return controller;
        if (!controllerPromise) {
            controllerPromise = import('./popup-controller.js').then(({ createGamePopupController }) => {
                controller = createGamePopupController({ getElement, popupController, vocabularyUrl });
                return controller;
            }).catch((error) => {
                controllerPromise = null;
                throw error;
            });
        }
        return controllerPromise;
    };
    const showModuleError = (error) => {
        popupController.prepareExclusive('game');
        popupController.show('game');
        const body = getElement('game-popup-body');
        if (body) {
            body.innerHTML = '<div class="game-load-error" role="alert"><div><h2>Game unavailable</h2><p>The memory game could not be loaded. Please try again.</p></div><button class="game-retry-button" id="game-retry" type="button">Try again</button></div>';
            getElement('game-retry')?.addEventListener('click', open);
        }
        console.error('Failed to open memory game.', error);
    };
    const open = () => {
        getController().then((gameController) => gameController.open()).catch(showModuleError);
    };
    const close = () => {
        if (controller)
            controller.close();
        else
            popupController.close('game');
    };
    const wire = () => {
        const tile = getElement('start-game');
        if (!tile || wiredTile === tile)
            return;
        wiredTile = tile;
        tile.addEventListener('click', (event) => {
            event.preventDefault();
            open();
        });
        getElement('game-popup-close')?.addEventListener('click', close);
        getElement('game-popup')?.addEventListener('click', (event) => {
            if (event.target === getElement('game-popup'))
                close();
        });
    };
    return {
        wire,
        close,
        destroySession: () => controller?.destroySession(),
        destroy: () => controller?.destroy(),
    };
}

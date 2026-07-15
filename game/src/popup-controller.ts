import { mountMemoryGame, type MemoryGameHandle } from './game.js';

type HomePopupController = {
    close: (mode: string) => void;
    isModeOpen: (mode: string) => boolean;
    prepareExclusive: (mode: string) => void;
    show: (mode: string) => boolean;
};

export type GamePopupControllerOptions = {
    getElement: (id: string) => HTMLElement | null;
    popupController: HomePopupController;
    vocabularyUrl: string | URL;
};

export type GamePopupController = {
    open: () => Promise<boolean>;
    close: () => void;
    destroySession: () => void;
    destroy: () => void;
};

export function createGamePopupController({
    getElement,
    popupController,
    vocabularyUrl,
}: GamePopupControllerOptions): GamePopupController {
    const mode = 'game';
    let gameInstance: MemoryGameHandle | null = null;
    let abortController: AbortController | null = null;

    const destroySession = (): void => {
        abortController?.abort();
        abortController = null;
        gameInstance?.destroy();
        gameInstance = null;
        getElement('game-popup-body')?.replaceChildren();
    };

    const renderLoadError = (error: unknown): void => {
        const gameBody = getElement('game-popup-body');
        if (!gameBody || !popupController.isModeOpen(mode)) return;

        gameBody.innerHTML = `
            <div class="game-load-error" role="alert">
                <div>
                    <h2 id="memory-game-title">Game unavailable</h2>
                    <p>The memory game could not be loaded. Please try again.</p>
                </div>
                <button class="game-retry-button" id="game-retry" type="button">Try again</button>
            </div>`;
        getElement('game-retry')?.addEventListener('click', () => {
            startSession().catch((retryError: unknown) => console.error('Failed to retry memory game.', retryError));
        });
        console.error('Failed to load memory game.', error);
    };

    const startSession = async (): Promise<boolean> => {
        const gameBody = getElement('game-popup-body');
        if (!gameBody) return false;

        destroySession();
        gameBody.innerHTML = '<div class="game-loading" role="status"><h2 id="memory-game-title">Loading Memory Match...</h2></div>';
        const requestController = new AbortController();
        abortController = requestController;

        try {
            const instance = await mountMemoryGame(gameBody, {
                vocabularyUrl,
                pairCount: 6,
                mismatchDelay: 800,
                signal: requestController.signal,
            });
            if (requestController.signal.aborted || !popupController.isModeOpen(mode)) {
                instance.destroy();
                return false;
            }

            gameInstance = instance;
            abortController = null;
            return true;
        } catch (error) {
            if ((error as { name?: string })?.name === 'AbortError' || requestController.signal.aborted) return false;
            abortController = null;
            renderLoadError(error);
            return false;
        }
    };

    const open = async (): Promise<boolean> => {
        const popup = getElement('game-popup');
        if (!popup) return false;

        popupController.prepareExclusive(mode);
        popupController.show(mode);
        getElement('game-popup-close')?.focus();
        return startSession();
    };

    const close = (): void => popupController.close(mode);

    return {
        open,
        close,
        destroySession,
        destroy: destroySession,
    };
}

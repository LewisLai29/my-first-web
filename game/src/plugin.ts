import { createGameHomeIntegration } from './home-integration.js';

type PluginLifecycle = {
    cancel?: () => void;
    unload?: () => void;
};

type PluginContext = {
    document: Document;
    getElement: (id: string) => HTMLElement | null;
    vocabularyUrl: string | URL;
    home: {
        root: HTMLElement;
        features: HTMLElement;
        popupController: {
            close: (mode: string) => void;
            isModeOpen: (mode: string) => boolean;
            prepareExclusive: (mode: string) => void;
            show: (mode: string) => boolean;
        };
        registerPopupMode: (mode: string, popupId: string, lifecycle: PluginLifecycle) => () => void;
    };
};

export function activate(context: PluginContext) {
    const { document, getElement, home, vocabularyUrl } = context;
    const tile = document.createElement('a');
    tile.id = 'start-game';
    tile.className = 'feature-tile feature-tile-game';
    tile.href = '#game-popup';
    tile.setAttribute('aria-label', 'Open memory match game');
    tile.innerHTML = `
        <span class="feature-tile-top">
            <span class="feature-tile-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                    <rect x="3.5" y="4" width="7" height="8" rx="1.5"></rect>
                    <rect x="13.5" y="12" width="7" height="8" rx="1.5"></rect>
                    <path d="M15.5 8h4M17.5 6v4M5.8 16h2.4M12 7.5h1.5M10.5 16.5H12"></path>
                </svg>
            </span>
        </span>
        <span class="feature-tile-copy">
            <span class="feature-tile-label">Game</span>
            <span class="feature-tile-description">Match words with their meanings</span>
        </span>`;

    const popup = document.createElement('div');
    popup.id = 'game-popup';
    popup.className = 'setting-popup game-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute('aria-label', 'Memory Match game');
    popup.hidden = true;
    popup.innerHTML = `
        <div class="setting-popup-window game-popup-window">
            <button id="game-popup-close" class="setting-popup-close" type="button" aria-label="Close game">x</button>
            <div id="game-popup-body" class="setting-popup-body game-popup-body"></div>
        </div>`;

    home.features.appendChild(tile);
    home.root.appendChild(popup);

    let integration: ReturnType<typeof createGameHomeIntegration> | null = null;
    const unregister = home.registerPopupMode('game', 'game-popup', {
        cancel: () => integration?.destroySession(),
        unload: () => integration?.destroySession(),
    });
    integration = createGameHomeIntegration({
        getElement,
        popupController: home.popupController,
        vocabularyUrl,
    });
    integration.wire();

    const quickToolsCount = getElement('home-quick-tools-count');
    const originalQuickToolsCount = quickToolsCount?.textContent ?? '4';
    if (quickToolsCount) {
        quickToolsCount.textContent = String((Number(originalQuickToolsCount) || 4) + 1);
    }

    return {
        dispose: () => {
            integration?.destroy();
            unregister();
            tile.remove();
            popup.remove();
            if (quickToolsCount) quickToolsCount.textContent = originalQuickToolsCount;
        },
    };
}

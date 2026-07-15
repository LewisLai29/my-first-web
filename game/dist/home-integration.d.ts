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
export declare function createGameHomeIntegration({ getElement, popupController, vocabularyUrl, }: GameHomeIntegrationOptions): {
    wire: () => void;
    close: () => void;
    destroySession: () => void;
    destroy: () => void;
};
export {};

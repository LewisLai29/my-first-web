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
export declare function createGamePopupController({ getElement, popupController, vocabularyUrl, }: GamePopupControllerOptions): GamePopupController;
export {};

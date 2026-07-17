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
export declare function activate(context: WordfrontPluginContext): {
    dispose: () => void;
};
export {};

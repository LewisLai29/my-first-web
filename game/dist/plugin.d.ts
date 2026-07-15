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
export declare function activate(context: PluginContext): {
    dispose: () => void;
};
export {};

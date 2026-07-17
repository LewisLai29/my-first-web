export type WordfrontControllerOptions = {
    root: HTMLElement;
    vocabularyUrl: string | URL;
    onClose: () => void;
};
export type WordfrontController = {
    open: () => Promise<boolean>;
    destroySession: () => void;
    destroy: () => void;
};
export declare function createWordfrontController({ root, vocabularyUrl, onClose, }: WordfrontControllerOptions): WordfrontController;

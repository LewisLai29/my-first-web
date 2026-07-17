export type WordfrontInputHandlers = {
    onStart: () => void;
    onAnswer: (entryId: string) => void;
    onPause: () => void;
    onResume: () => void;
    onRestart: () => void;
    onClose: () => void;
};
export declare function wireWordfrontInputs(root: HTMLElement, handlers: WordfrontInputHandlers): () => void;

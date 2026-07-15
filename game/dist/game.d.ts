export type VocabularyInput = {
    id?: string | number;
    word?: unknown;
    definition?: unknown;
    w?: unknown;
    m?: unknown;
};
export type VocabularyPair = {
    id: string;
    word: string;
    definition: string;
};
export type MemoryCard = {
    id: string;
    pairId: string;
    kind: 'word' | 'definition';
    label: string;
    revealed: boolean;
    matched: boolean;
};
export type FlipResult = {
    type: 'ignored';
} | {
    type: 'first';
    cardIndex: number;
} | {
    type: 'match';
    cardIndices: [number, number];
    complete: boolean;
} | {
    type: 'mismatch';
    cardIndices: [number, number];
};
export type MountMemoryGameOptions = {
    vocabularyUrl?: string | URL;
    pairCount?: number;
    mismatchDelay?: number;
    random?: () => number;
    now?: () => number;
    signal?: AbortSignal;
};
export type MemoryGameHandle = {
    destroy: () => void;
    restart: () => void;
};
export declare function normalizeVocabulary(items: unknown): VocabularyPair[];
export declare function shuffled<T>(items: readonly T[], random?: () => number): T[];
export declare function createDeck(vocabulary: readonly VocabularyPair[], pairCount?: number, random?: () => number): MemoryCard[];
export declare class MemoryGameRound {
    readonly cards: MemoryCard[];
    moves: number;
    matchedPairs: number;
    startedAt: number | null;
    finishedAt: number | null;
    locked: boolean;
    private firstCardIndex;
    constructor(cards: MemoryCard[]);
    flip(cardIndex: number, now: number): FlipResult;
    resolveMismatch(cardIndices: [number, number]): void;
    elapsedSeconds(now: number): number;
}
export declare function mountMemoryGame(root: HTMLElement, options?: MountMemoryGameOptions): Promise<MemoryGameHandle>;

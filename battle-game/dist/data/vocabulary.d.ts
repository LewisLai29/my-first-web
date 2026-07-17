import type { VocabularyEntry } from '../game/types.js';
export declare function normalizeVocabulary(input: unknown): VocabularyEntry[];
export declare function loadVocabulary(url: string | URL, signal?: AbortSignal): Promise<VocabularyEntry[]>;

import type { VocabularyEntry } from '../game/types.js';

type VocabularyInput = {
    id?: string | number;
    word?: unknown;
    definition?: unknown;
    partOfSpeech?: unknown;
    w?: unknown;
    m?: unknown;
};

const cleanText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const normalizeDefinition = (value: string): string => value
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .toLocaleLowerCase();

const normalizePartOfSpeech = (value: string): string => {
    const tokens = value
        .toLocaleLowerCase()
        .split(/[/.、,\s]+/)
        .map((token) => token.trim())
        .filter(Boolean)
        .sort();
    return [...new Set(tokens)].join('|');
};

export function normalizeVocabulary(input: unknown): VocabularyEntry[] {
    const items = input && typeof input === 'object' && !Array.isArray(input) && 'items' in input
        ? (input as { items?: unknown }).items
        : input;
    if (!Array.isArray(items)) return [];

    const seenWords = new Set<string>();
    const entries: VocabularyEntry[] = [];
    items.forEach((raw, index) => {
        if (!raw || typeof raw !== 'object') return;
        const item = raw as VocabularyInput;
        const word = cleanText(item.word) || cleanText(item.w);
        const definition = cleanText(item.definition) || cleanText(item.m);
        const normalizedWord = word.normalize('NFKC').toLocaleLowerCase();
        if (!word || !definition || seenWords.has(normalizedWord)) return;

        seenWords.add(normalizedWord);
        const partOfSpeech = cleanText(item.partOfSpeech);
        entries.push({
            id: String(item.id ?? index + 1),
            word,
            normalizedWord,
            definition,
            normalizedDefinition: normalizeDefinition(definition),
            partOfSpeech,
            partOfSpeechKey: normalizePartOfSpeech(partOfSpeech),
        });
    });
    return entries;
}

export async function loadVocabulary(
    url: string | URL,
    signal?: AbortSignal,
): Promise<VocabularyEntry[]> {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error('Vocabulary could not be loaded.');
    const entries = normalizeVocabulary(await response.json());
    if (entries.length < 29) throw new Error('At least 29 valid vocabulary entries are required.');
    return entries;
}

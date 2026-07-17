import type { QuestionState, VocabularyEntry } from '../../game/types.js';

export type RandomSource = () => number;

export function shuffled<T>(items: readonly T[], random: RandomSource = Math.random): T[] {
    const output = [...items];
    for (let index = output.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        const current = output[index] as T;
        output[index] = output[swapIndex] as T;
        output[swapIndex] = current;
    }
    return output;
}

function chooseDistractors(
    target: VocabularyEntry,
    entries: readonly VocabularyEntry[],
    random: RandomSource,
): VocabularyEntry[] {
    const candidates = entries.filter((entry) => (
        entry.id !== target.id
        && entry.normalizedWord !== target.normalizedWord
        && entry.normalizedDefinition !== target.normalizedDefinition
    ));
    const samePartOfSpeech = target.partOfSpeechKey
        ? candidates.filter((entry) => entry.partOfSpeechKey === target.partOfSpeechKey)
        : [];
    const selected = shuffled(samePartOfSpeech, random).slice(0, 3);
    if (selected.length < 3) {
        const selectedIds = new Set(selected.map((entry) => entry.id));
        selected.push(...shuffled(
            candidates.filter((entry) => !selectedIds.has(entry.id)),
            random,
        ).slice(0, 3 - selected.length));
    }
    if (selected.length < 3) throw new Error('Vocabulary needs at least four unambiguous entries.');
    return selected;
}

export function createSessionQuestions(
    entries: readonly VocabularyEntry[],
    count: number,
    random: RandomSource = Math.random,
): QuestionState[] {
    if (entries.length < count) throw new Error(`At least ${count} entries are required.`);
    const targets = shuffled(entries, random).slice(0, count);
    return targets.map((target, index) => {
        const options = shuffled([target, ...chooseDistractors(target, entries, random)], random)
            .map((entry) => ({ entryId: entry.id, label: entry.word }));
        return {
            id: `question-${index + 1}-${target.id}`,
            targetEntryId: target.id,
            targetWord: target.word,
            definition: target.definition,
            options,
            eliminatedEntryIds: [],
        };
    });
}

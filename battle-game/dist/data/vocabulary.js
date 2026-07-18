const cleanText = (value) => typeof value === 'string' ? value.trim() : '';
const normalizeDefinition = (value) => value
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .toLocaleLowerCase();
const normalizePartOfSpeech = (value) => {
    const tokens = value
        .toLocaleLowerCase()
        .split(/[/.、,\s]+/)
        .map((token) => token.trim())
        .filter(Boolean)
        .sort();
    return [...new Set(tokens)].join('|');
};
export function normalizeVocabulary(input) {
    const items = input && typeof input === 'object' && !Array.isArray(input) && 'items' in input
        ? input.items
        : input;
    if (!Array.isArray(items))
        return [];
    const seenWords = new Set();
    const entries = [];
    items.forEach((raw, index) => {
        if (!raw || typeof raw !== 'object')
            return;
        const item = raw;
        const word = cleanText(item.word) || cleanText(item.w);
        const definition = cleanText(item.definition) || cleanText(item.m);
        const normalizedWord = word.normalize('NFKC').toLocaleLowerCase();
        if (!word || !definition || seenWords.has(normalizedWord))
            return;
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
export async function loadVocabulary(url, minimumEntries, signal) {
    const response = await fetch(url, { signal });
    if (!response.ok)
        throw new Error('Vocabulary could not be loaded.');
    const entries = normalizeVocabulary(await response.json());
    if (entries.length < minimumEntries) {
        throw new Error(`At least ${minimumEntries} valid vocabulary entries are required.`);
    }
    return entries;
}

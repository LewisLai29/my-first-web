import { seededRandom } from './date-utils.js';

export function normalizeVocabItems(vocabData) {
    const items = Array.isArray(vocabData) ? vocabData : vocabData.items;
    if (!Array.isArray(items)) {
        throw new Error('Invalid vocabulary JSON: missing item array.');
    }

    return items.map((item) => ({
        id: item.id,
        w: item.word || item.w,
        pos: item.partOfSpeech || item.pos || '',
        m: item.definition || item.m || '',
        e: item.example || item.e || '',
        wordFamily: Array.isArray(item.wordFamily) ? item.wordFamily : [],
        collocations: Array.isArray(item.collocations) ? item.collocations : [],
    })).filter((item) => item.w);
}

export function normalizeLookupWord(word) {
    return String(word).trim().toLowerCase();
}

export function buildVocabMeaningMap(items) {
    const map = new Map();
    items.forEach((item) => {
        const key = normalizeLookupWord(item.w);
        if (key && item.m && !map.has(key)) {
            map.set(key, item.m);
        }
    });
    return map;
}

export function pickDailyWords(allVocab, todayString, dailyWordCount) {
    const myRandom = seededRandom(todayString);
    const pool = [...allVocab];

    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(myRandom() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool.slice(0, dailyWordCount).sort(() => Math.random() - 0.5);
}

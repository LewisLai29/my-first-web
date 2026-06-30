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

export const POS_ABBREVIATIONS = {
    '名詞': 'n.',
    '形容詞': 'adj.',
    '動詞': 'v.',
    '副詞': 'adv.',
    '介系詞': 'prep.',
    '連接詞': 'conj.',
    '連詞': 'conj.',
    '代名詞': 'pron.',
    '助動詞': 'aux.',
    '分詞': 'part.',
    '動詞片語': 'phrasal verb',
};

export function getPosAbbreviation(posText) {
    if (!posText) return '';

    return posText
        .split('/')
        .map((text) => text.trim())
        .filter(Boolean)
        .map((pos) => POS_ABBREVIATIONS[pos] || pos)
        .join('/');
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

export function shuffleWords(words, randomFn = Math.random) {
    const pool = [...words];

    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(randomFn() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool;
}

export function pickDailyWords(allVocab, todayString, dailyWordCount) {
    const myRandom = seededRandom(todayString);
    const pool = [...allVocab];

    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(myRandom() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return shuffleWords(pool.slice(0, dailyWordCount), myRandom);
}

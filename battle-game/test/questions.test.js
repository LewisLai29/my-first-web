import assert from 'node:assert/strict';
import test from 'node:test';
import { loadVocabulary, normalizeVocabulary } from '../dist/data/vocabulary.js';
import { createSessionQuestions } from '../dist/features/questions/questions.js';

const vocabulary = Array.from({ length: 40 }, (_, index) => ({
    id: index + 1,
    word: `word-${index + 1}`,
    definition: `meaning-${index + 1}`,
    partOfSpeech: index < 35 ? 'n./v.' : 'adj.',
}));

test('normalizes current and legacy vocabulary fields with stable part-of-speech keys', () => {
    const output = normalizeVocabulary([
        { id: 1, word: ' Analyse ', definition: ' 分析 ', partOfSpeech: 'v./n.' },
        { id: 2, w: 'approach', m: '方法', partOfSpeech: 'n./v.' },
        { id: 3, word: 'analyse', definition: 'duplicate' },
        { id: 4, word: '', definition: 'invalid' },
    ]);
    assert.equal(output.length, 2);
    assert.equal(output[0].word, 'Analyse');
    assert.equal(output[0].partOfSpeechKey, output[1].partOfSpeechKey);
});

test('creates 38 unique questions with four unique options and one answer', () => {
    const entries = normalizeVocabulary(vocabulary);
    const questions = createSessionQuestions(entries, 38, () => 0.42);
    assert.equal(questions.length, 38);
    assert.equal(new Set(questions.map((question) => question.targetEntryId)).size, 38);
    questions.forEach((question) => {
        assert.equal(question.options.length, 4);
        assert.equal(new Set(question.options.map((option) => option.entryId)).size, 4);
        assert.equal(question.options.filter((option) => option.entryId === question.targetEntryId).length, 1);
    });
});

test('rejects a vocabulary source below the configured session requirement', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
        ok: true,
        json: async () => vocabulary.slice(0, 37),
    });
    try {
        await assert.rejects(
            loadVocabulary('/vocabulary.json', 38),
            /At least 38 valid vocabulary entries are required/,
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeck, MemoryGameRound, normalizeVocabulary } from '../dist/game.js';

const vocabulary = Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    word: `word-${index + 1}`,
    definition: `meaning-${index + 1}`,
}));

test('normalizes current and legacy vocabulary while rejecting invalid duplicates', () => {
    const output = normalizeVocabulary({ items: [
        { id: 1, word: ' analyse ', definition: ' 分析 ' },
        { id: 2, w: 'approach', m: '方法' },
        { id: 3, word: 'ANALYSE', definition: '另一個意思' },
        { id: 4, word: '', definition: 'missing word' },
    ] });
    assert.deepEqual(output, [
        { id: '1', word: 'analyse', definition: '分析' },
        { id: '2', word: 'approach', definition: '方法' },
    ]);
});

test('creates six word-meaning pairs and rejects an undersized vocabulary', () => {
    const deck = createDeck(vocabulary, 6, () => 0.5);
    assert.equal(deck.length, 12);
    assert.ok(deck.slice(0, 6).every((card) => card.kind === 'word'));
    assert.ok(deck.slice(6).every((card) => card.kind === 'definition'));
    const grouped = new Map();
    deck.forEach((card) => grouped.set(card.pairId, [...(grouped.get(card.pairId) ?? []), card]));
    assert.equal(grouped.size, 6);
    grouped.forEach((cards) => assert.deepEqual(new Set(cards.map((card) => card.kind)), new Set(['word', 'definition'])));
    assert.throws(() => createDeck(vocabulary.slice(0, 2), 6), /At least 6/);
});

test('counts attempts, locks mismatches and completes matched pairs', () => {
    const cards = createDeck(vocabulary.slice(0, 2), 2, () => 0.5);
    const round = new MemoryGameRound(cards);
    const firstIndex = 0;
    const mismatchIndex = cards.findIndex((card) => card.pairId !== cards[firstIndex].pairId);
    assert.equal(round.flip(firstIndex, 1000).type, 'first');
    const mismatch = round.flip(mismatchIndex, 1200);
    assert.equal(mismatch.type, 'mismatch');
    assert.equal(round.moves, 1);
    assert.equal(round.locked, true);
    assert.equal(round.flip(2, 1300).type, 'ignored');
    round.resolveMismatch(mismatch.cardIndices);
    assert.equal(round.locked, false);

    for (const pairId of new Set(cards.map((card) => card.pairId))) {
        const indices = cards.map((card, index) => card.pairId === pairId ? index : -1).filter((index) => index >= 0);
        round.flip(indices[0], 2000);
        round.flip(indices[1], 2500);
    }
    assert.equal(round.matchedPairs, 2);
    assert.equal(round.finishedAt, 2500);
    assert.equal(round.elapsedSeconds(9000), 1);
});

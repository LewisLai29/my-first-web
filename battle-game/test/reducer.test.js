import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeVocabulary } from '../dist/data/vocabulary.js';
import { ENEMY_CATALOG } from '../dist/entities/enemy/enemy-catalog.js';
import { DEFAULT_CONFIG } from '../dist/game/config.js';
import { createInitialState, reduceGame } from '../dist/game/reducer.js';
import { createSessionQuestions } from '../dist/features/questions/questions.js';
import { countWaveHp, createWaves } from '../dist/features/waves/waves.js';

const entries = normalizeVocabulary(Array.from({ length: 40 }, (_, index) => ({
    id: index + 1,
    word: `word-${index + 1}`,
    definition: `meaning-${index + 1}`,
    partOfSpeech: 'n.',
})));

const createState = () => createInitialState(
    DEFAULT_CONFIG,
    createSessionQuestions(entries, 29, () => 0.37),
);

const reduce = (state, action) => reduceGame(state, action, DEFAULT_CONFIG).state;

test('builds three waves with ten enemies and 29 total HP', () => {
    const waves = createWaves(DEFAULT_CONFIG.waves);
    assert.equal(waves.length, 3);
    assert.equal(waves.reduce((total, wave) => total + wave.enemies.length, 0), 10);
    assert.equal(countWaveHp(waves), 29);
    assert.deepEqual({
        normal: ENEMY_CATALOG.normal.damage,
        strong: ENEMY_CATALOG.strong.damage,
        boss: ENEMY_CATALOG.boss.damage,
    }, { normal: 10, strong: 15, boss: 20 });
});

test('wrong answer locks input while timeout still damages the player and preserves the question', () => {
    let state = reduce(createState(), { type: 'START', now: 0 });
    const questionId = state.question.id;
    const wrongOption = state.question.options.find((option) => option.entryId !== state.question.targetEntryId);
    state = reduce(state, { type: 'SUBMIT_ANSWER', entryId: wrongOption.entryId, now: 1_000 });
    assert.equal(state.stats.wrongSelections, 1);
    assert.equal(state.penaltyDeadlineGameMs, 4_000);
    assert.deepEqual(state.question.eliminatedEntryIds, [wrongOption.entryId]);

    state = reduce(state, { type: 'QUESTION_TIMEOUT', now: 10_000 });
    assert.equal(state.phase, 'resolving-enemy-attack');
    assert.equal(state.player.hp, 90);
    assert.equal(state.question.id, questionId);
    assert.equal(state.penaltyDeadlineGameMs, 4_000);

    state = reduce(state, { type: 'ENEMY_ATTACK_FINISHED', now: 10_500 });
    assert.equal(state.phase, 'playing');
    assert.equal(state.question.id, questionId);
    assert.equal(state.questionDeadlineGameMs, 20_500);
});

test('29 correct answers clear all waves without healing and end in victory', () => {
    let now = 0;
    let state = reduce(createState(), { type: 'START', now });
    while (state.phase !== 'victory') {
        if (state.phase === 'playing') {
            now += 100;
            state = reduce(state, { type: 'SUBMIT_ANSWER', entryId: state.question.targetEntryId, now });
        } else if (state.phase === 'resolving-player-attack') {
            now += 500;
            state = reduce(state, { type: 'PLAYER_ATTACK_FINISHED', now });
        } else if (state.phase === 'wave-transition') {
            now += 3_000;
            state = reduce(state, { type: 'WAVE_TRANSITION_FINISHED', now });
        } else {
            assert.fail(`Unexpected phase ${state.phase}`);
        }
    }
    assert.equal(state.stats.correctSelections, 29);
    assert.equal(state.player.hp, 100);
    assert.equal(state.currentWaveIndex, 2);
});

test('player HP reaching zero enters defeat', () => {
    let now = 0;
    let state = reduce(createState(), { type: 'START', now });
    for (let attack = 0; attack < 10; attack += 1) {
        now += 10_000;
        state = reduce(state, { type: 'QUESTION_TIMEOUT', now });
        assert.equal(state.phase, 'resolving-enemy-attack');
        now += 500;
        state = reduce(state, { type: 'ENEMY_ATTACK_FINISHED', now });
    }
    assert.equal(state.player.hp, 0);
    assert.equal(state.phase, 'defeat');
    assert.equal(state.stats.finishedAtGameMs, now);
});

test('pause reasons must be cleared before the prior phase resumes', () => {
    let state = reduce(createState(), { type: 'START', now: 0 });
    state = reduce(state, { type: 'PAUSE', reason: 'hidden' });
    state = reduce(state, { type: 'PAUSE', reason: 'portrait' });
    assert.equal(state.phase, 'paused');
    assert.deepEqual(state.pauseReasons, ['hidden', 'portrait']);
    state = reduce(state, { type: 'CLEAR_PAUSE_REASON', reason: 'hidden' });
    state = reduce(state, { type: 'RESUME', now: 1_000 });
    assert.equal(state.phase, 'paused');
    state = reduce(state, { type: 'CLEAR_PAUSE_REASON', reason: 'portrait' });
    state = reduce(state, { type: 'RESUME', now: 1_000 });
    assert.equal(state.phase, 'playing');
});

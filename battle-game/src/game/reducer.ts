import { isEnemyDefeated } from '../entities/enemy/enemy.js';
import { addCorrectAnswer, createPlayer, resetCorrectStreak } from '../entities/player/player.js';
import { resolveEnemyAttack } from '../features/combat/enemy-attack.js';
import { resolvePlayerAttack } from '../features/combat/player-attack.js';
import { createWaves } from '../features/waves/waves.js';
import type { WordfrontConfig } from './config.js';
import type {
    GameAction,
    GameEffect,
    GameState,
    QuestionState,
    ReduceResult,
    ResumePhase,
    WaveState,
} from './types.js';

export function createInitialState(
    config: WordfrontConfig,
    questions: readonly QuestionState[],
): GameState {
    return {
        phase: 'intro',
        resumePhase: null,
        pauseReasons: [],
        player: createPlayer(),
        waves: createWaves(config.waves),
        currentWaveIndex: 0,
        questions,
        questionCursor: 0,
        question: null,
        questionDeadlineGameMs: null,
        penaltyDeadlineGameMs: null,
        waveDeadlineGameMs: null,
        stats: {
            correctSelections: 0,
            wrongSelections: 0,
            wrongEntryIds: [],
            startedAtGameMs: null,
            finishedAtGameMs: null,
        },
        revision: 0,
    };
}

function unchanged(state: GameState): ReduceResult {
    return { state, effects: [] };
}

function revised(state: GameState, changes: Partial<GameState>, effects: readonly GameEffect[] = []): ReduceResult {
    return {
        state: { ...state, ...changes, revision: state.revision + 1 },
        effects,
    };
}

function activeWave(state: GameState): WaveState | null {
    return state.waves[state.currentWaveIndex] ?? null;
}

function activeEnemy(state: GameState) {
    const wave = activeWave(state);
    return wave?.enemies[wave.activeEnemyIndex] ?? null;
}

function replaceCurrentWave(state: GameState, wave: WaveState): readonly WaveState[] {
    return state.waves.map((candidate, index) => index === state.currentWaveIndex ? wave : candidate);
}

function startQuestion(
    state: GameState,
    cursor: number,
    now: number,
    config: WordfrontConfig,
): ReduceResult {
    const question = state.questions[cursor];
    if (!question) throw new Error(`Missing question at index ${cursor}.`);
    return revised(state, {
        phase: 'playing',
        questionCursor: cursor,
        question: { ...question, eliminatedEntryIds: [] },
        questionDeadlineGameMs: now + config.questionDurationMs,
        penaltyDeadlineGameMs: null,
        waveDeadlineGameMs: null,
    }, [{ type: 'FOCUS', target: 'first-answer' }]);
}

export function reduceGame(
    state: GameState,
    action: GameAction,
    config: WordfrontConfig,
): ReduceResult {
    if (action.type === 'DESTROY') {
        return revised(state, {
            phase: 'destroyed',
            resumePhase: null,
            pauseReasons: [],
            questionDeadlineGameMs: null,
            penaltyDeadlineGameMs: null,
            waveDeadlineGameMs: null,
        });
    }
    if (state.phase === 'destroyed') return unchanged(state);

    if (action.type === 'PAUSE') {
        if (state.phase === 'victory' || state.phase === 'defeat') return unchanged(state);
        const reasons = state.pauseReasons.includes(action.reason)
            ? state.pauseReasons
            : [...state.pauseReasons, action.reason];
        if (state.phase === 'paused') return revised(state, { pauseReasons: reasons });
        return revised(state, {
            phase: 'paused',
            resumePhase: state.phase as ResumePhase,
            pauseReasons: reasons,
        }, [{ type: 'FOCUS', target: 'resume' }]);
    }

    if (action.type === 'CLEAR_PAUSE_REASON') {
        if (state.phase !== 'paused') return unchanged(state);
        return revised(state, {
            pauseReasons: state.pauseReasons.filter((reason) => reason !== action.reason),
        });
    }

    if (action.type === 'RESUME') {
        if (state.phase !== 'paused' || state.pauseReasons.length > 0 || !state.resumePhase) return unchanged(state);
        return revised(state, {
            phase: state.resumePhase,
            resumePhase: null,
        }, state.resumePhase === 'playing' ? [{ type: 'FOCUS', target: 'first-answer' }] : []);
    }

    if (state.phase === 'paused') return unchanged(state);

    switch (action.type) {
        case 'START': {
            if (state.phase !== 'intro') return unchanged(state);
            const result = startQuestion(state, 0, action.now, config);
            return {
                ...result,
                state: {
                    ...result.state,
                    stats: { ...result.state.stats, startedAtGameMs: action.now },
                },
            };
        }
        case 'SUBMIT_ANSWER': {
            if (state.phase !== 'playing' || !state.question) return unchanged(state);
            if (state.questionDeadlineGameMs !== null && action.now >= state.questionDeadlineGameMs) return unchanged(state);
            if (state.penaltyDeadlineGameMs !== null && action.now < state.penaltyDeadlineGameMs) return unchanged(state);
            if (state.question.eliminatedEntryIds.includes(action.entryId)) return unchanged(state);

            if (action.entryId !== state.question.targetEntryId) {
                const wrongEntryIds = state.stats.wrongEntryIds.includes(state.question.targetEntryId)
                    ? state.stats.wrongEntryIds
                    : [...state.stats.wrongEntryIds, state.question.targetEntryId];
                return revised(state, {
                    player: resetCorrectStreak(state.player),
                    question: {
                        ...state.question,
                        eliminatedEntryIds: [...state.question.eliminatedEntryIds, action.entryId],
                    },
                    penaltyDeadlineGameMs: action.now + config.wrongPenaltyMs,
                    stats: {
                        ...state.stats,
                        wrongSelections: state.stats.wrongSelections + 1,
                        wrongEntryIds,
                    },
                }, [{ type: 'ANNOUNCE', message: 'Wrong answer. Streak lost and attack reset to 5.' }]);
            }

            const wave = activeWave(state);
            const enemy = activeEnemy(state);
            if (!wave || !enemy) return unchanged(state);
            const player = addCorrectAnswer(state.player);
            const attack = resolvePlayerAttack(player, enemy);
            const nextWave: WaveState = {
                ...wave,
                enemies: wave.enemies.map((candidate, index) => (
                    index === wave.activeEnemyIndex ? attack.enemy : candidate
                )),
            };
            const effects: GameEffect[] = [
                { type: 'ANIMATE_PLAYER_ATTACK', word: state.question.targetWord, enemyId: enemy.id },
                { type: 'ANNOUNCE', message: `Correct. ${state.question.targetWord}. Streak ${player.correctStreak}. Attack ${player.attack}. ${attack.damage} damage.` },
            ];
            if (isEnemyDefeated(attack.enemy)) {
                effects.push({ type: 'ANIMATE_ENEMY_DEATH', enemyId: enemy.id });
            }
            return revised(state, {
                phase: 'resolving-player-attack',
                player,
                waves: replaceCurrentWave(state, nextWave),
                questionDeadlineGameMs: null,
                penaltyDeadlineGameMs: null,
                stats: {
                    ...state.stats,
                    correctSelections: state.stats.correctSelections + 1,
                },
            }, effects);
        }
        case 'QUESTION_TIMEOUT': {
            if (state.phase !== 'playing') return unchanged(state);
            const wave = activeWave(state);
            const enemy = activeEnemy(state);
            if (!wave || !enemy) return unchanged(state);
            const attack = resolveEnemyAttack(enemy, resetCorrectStreak(state.player));
            const nextWave: WaveState = {
                ...wave,
                enemies: wave.enemies.map((candidate, index) => (
                    index === wave.activeEnemyIndex ? attack.enemy : candidate
                )),
            };
            return revised(state, {
                phase: 'resolving-enemy-attack',
                player: attack.player,
                waves: replaceCurrentWave(state, nextWave),
                questionDeadlineGameMs: null,
            }, [
                { type: 'ANIMATE_ENEMY_ATTACK', enemyId: enemy.id, advance: attack.enemy.advanceStep > enemy.advanceStep },
                { type: 'ANNOUNCE', message: `Monster attack. ${attack.damage} damage. Streak lost and attack reset to 5.` },
            ]);
        }
        case 'PLAYER_ATTACK_FINISHED': {
            if (state.phase !== 'resolving-player-attack') return unchanged(state);
            const wave = activeWave(state);
            const enemy = activeEnemy(state);
            if (!wave || !enemy) return unchanged(state);
            const nextCursor = state.questionCursor + 1;
            if (!isEnemyDefeated(enemy)) return startQuestion(state, nextCursor, action.now, config);

            const nextEnemyIndex = wave.activeEnemyIndex + 1;
            if (nextEnemyIndex < wave.enemies.length) {
                const nextWave = { ...wave, activeEnemyIndex: nextEnemyIndex };
                return startQuestion({ ...state, waves: replaceCurrentWave(state, nextWave) }, nextCursor, action.now, config);
            }

            if (state.currentWaveIndex >= state.waves.length - 1) {
                return revised(state, {
                    phase: 'victory',
                    question: null,
                    questionCursor: nextCursor,
                    stats: { ...state.stats, finishedAtGameMs: action.now },
                }, [{ type: 'FOCUS', target: 'play-again' }, { type: 'ANNOUNCE', message: 'Victory!' }]);
            }

            return revised(state, {
                phase: 'wave-transition',
                question: null,
                questionCursor: nextCursor,
                waveDeadlineGameMs: action.now + config.waveTransitionMs,
            }, [{ type: 'ANNOUNCE', message: 'Wave clear.' }]);
        }
        case 'ENEMY_ATTACK_FINISHED': {
            if (state.phase !== 'resolving-enemy-attack') return unchanged(state);
            if (state.player.hp <= 0) {
                return revised(state, {
                    phase: 'defeat',
                    stats: { ...state.stats, finishedAtGameMs: action.now },
                }, [{ type: 'FOCUS', target: 'play-again' }, { type: 'ANNOUNCE', message: 'Defeat.' }]);
            }
            return revised(state, {
                phase: 'playing',
                questionDeadlineGameMs: action.now + config.questionDurationMs,
            }, [{ type: 'FOCUS', target: 'first-answer' }]);
        }
        case 'WAVE_TRANSITION_FINISHED': {
            if (state.phase !== 'wave-transition') return unchanged(state);
            const nextWaveIndex = state.currentWaveIndex + 1;
            return startQuestion({ ...state, currentWaveIndex: nextWaveIndex }, state.questionCursor, action.now, config);
        }
        default:
            return unchanged(state);
    }
}

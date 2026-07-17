import type { EnemyState } from '../entities/enemy/enemy-types.js';
import type { PlayerState } from '../entities/player/player-types.js';

export type VocabularyEntry = {
    id: string;
    word: string;
    normalizedWord: string;
    definition: string;
    normalizedDefinition: string;
    partOfSpeech: string;
    partOfSpeechKey: string;
};

export type QuestionOption = {
    entryId: string;
    label: string;
};

export type QuestionState = {
    id: string;
    targetEntryId: string;
    targetWord: string;
    definition: string;
    options: readonly QuestionOption[];
    eliminatedEntryIds: readonly string[];
};

export type WaveState = {
    index: number;
    enemies: readonly EnemyState[];
    activeEnemyIndex: number;
};

export type GamePhase =
    | 'intro'
    | 'playing'
    | 'resolving-player-attack'
    | 'resolving-enemy-attack'
    | 'wave-transition'
    | 'paused'
    | 'victory'
    | 'defeat'
    | 'destroyed';

export type ResumePhase = Exclude<GamePhase, 'paused' | 'destroyed'>;
export type PauseReason = 'manual' | 'hidden' | 'blur' | 'portrait';

export type GameStats = {
    correctSelections: number;
    wrongSelections: number;
    wrongEntryIds: readonly string[];
    startedAtGameMs: number | null;
    finishedAtGameMs: number | null;
};

export type GameState = {
    phase: GamePhase;
    resumePhase: ResumePhase | null;
    pauseReasons: readonly PauseReason[];
    player: PlayerState;
    waves: readonly WaveState[];
    currentWaveIndex: number;
    questions: readonly QuestionState[];
    questionCursor: number;
    question: QuestionState | null;
    questionDeadlineGameMs: number | null;
    penaltyDeadlineGameMs: number | null;
    waveDeadlineGameMs: number | null;
    stats: GameStats;
    revision: number;
};

export type GameAction =
    | { type: 'START'; now: number }
    | { type: 'SUBMIT_ANSWER'; entryId: string; now: number }
    | { type: 'QUESTION_TIMEOUT'; now: number }
    | { type: 'PLAYER_ATTACK_FINISHED'; now: number }
    | { type: 'ENEMY_ATTACK_FINISHED'; now: number }
    | { type: 'WAVE_TRANSITION_FINISHED'; now: number }
    | { type: 'PAUSE'; reason: PauseReason }
    | { type: 'CLEAR_PAUSE_REASON'; reason: PauseReason }
    | { type: 'RESUME'; now: number }
    | { type: 'DESTROY' };

export type GameEffect =
    | { type: 'ANIMATE_PLAYER_ATTACK'; word: string; enemyId: string }
    | { type: 'ANIMATE_ENEMY_ATTACK'; enemyId: string; advance: boolean }
    | { type: 'ANIMATE_ENEMY_DEATH'; enemyId: string }
    | { type: 'ANNOUNCE'; message: string }
    | { type: 'FOCUS'; target: 'first-answer' | 'resume' | 'play-again' };

export type ReduceResult = {
    state: GameState;
    effects: readonly GameEffect[];
};

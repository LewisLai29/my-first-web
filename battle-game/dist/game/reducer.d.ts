import type { WordfrontConfig } from './config.js';
import type { GameAction, GameState, QuestionState, ReduceResult } from './types.js';
export declare function createInitialState(config: WordfrontConfig, questions: readonly QuestionState[]): GameState;
export declare function reduceGame(state: GameState, action: GameAction, config: WordfrontConfig): ReduceResult;

import type { QuestionState, VocabularyEntry } from '../../game/types.js';
export type RandomSource = () => number;
export declare function shuffled<T>(items: readonly T[], random?: RandomSource): T[];
export declare function createSessionQuestions(entries: readonly VocabularyEntry[], count: number, random?: RandomSource): QuestionState[];

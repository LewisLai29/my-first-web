export type EnemyKind = 'normal' | 'strong' | 'boss';

export type EnemyDefinition = {
    kind: EnemyKind;
    hp: number;
    attack: number;
    defense: number;
    maxAdvanceStep: number;
};

export type EnemyState = {
    id: string;
    kind: EnemyKind;
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    advanceStep: number;
    maxAdvanceStep: number;
};

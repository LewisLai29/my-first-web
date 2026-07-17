export type EnemyKind = 'normal' | 'strong' | 'boss';

export type EnemyDefinition = {
    kind: EnemyKind;
    hp: number;
    damage: number;
    maxAdvanceStep: number;
};

export type EnemyState = {
    id: string;
    kind: EnemyKind;
    hp: number;
    maxHp: number;
    attackDamage: number;
    advanceStep: number;
    maxAdvanceStep: number;
};

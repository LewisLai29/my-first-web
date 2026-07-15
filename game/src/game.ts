export type VocabularyInput = {
    id?: string | number;
    word?: unknown;
    definition?: unknown;
    w?: unknown;
    m?: unknown;
};

export type VocabularyPair = {
    id: string;
    word: string;
    definition: string;
};

export type MemoryCard = {
    id: string;
    pairId: string;
    kind: 'word' | 'definition';
    label: string;
    revealed: boolean;
    matched: boolean;
};

export type FlipResult =
    | { type: 'ignored' }
    | { type: 'first'; cardIndex: number }
    | { type: 'match'; cardIndices: [number, number]; complete: boolean }
    | { type: 'mismatch'; cardIndices: [number, number] };

export type MountMemoryGameOptions = {
    vocabularyUrl?: string | URL;
    pairCount?: number;
    mismatchDelay?: number;
    random?: () => number;
    now?: () => number;
    signal?: AbortSignal;
};

export type MemoryGameHandle = {
    destroy: () => void;
    restart: () => void;
};

const cleanText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export function normalizeVocabulary(items: unknown): VocabularyPair[] {
    if (items && typeof items === 'object' && !Array.isArray(items) && 'items' in items) {
        items = (items as { items?: unknown }).items;
    }
    if (!Array.isArray(items)) return [];

    const seenWords = new Set<string>();
    const seenDefinitions = new Set<string>();
    const pairs: VocabularyPair[] = [];

    items.forEach((rawItem, index) => {
        if (!rawItem || typeof rawItem !== 'object') return;
        const item = rawItem as VocabularyInput;
        const word = cleanText(item.word) || cleanText(item.w);
        const definition = cleanText(item.definition) || cleanText(item.m);
        const wordKey = word.toLocaleLowerCase();
        const definitionKey = definition.toLocaleLowerCase();

        if (!word || !definition || seenWords.has(wordKey) || seenDefinitions.has(definitionKey)) return;

        seenWords.add(wordKey);
        seenDefinitions.add(definitionKey);
        pairs.push({
            id: String(item.id ?? index + 1),
            word,
            definition,
        });
    });

    return pairs;
}

export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
    const output = [...items];
    for (let index = output.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        const current = output[index];
        output[index] = output[swapIndex] as T;
        output[swapIndex] = current as T;
    }
    return output;
}

export function createDeck(
    vocabulary: readonly VocabularyPair[],
    pairCount = 6,
    random: () => number = Math.random,
): MemoryCard[] {
    if (vocabulary.length < pairCount) {
        throw new Error(`At least ${pairCount} valid vocabulary pairs are required.`);
    }

    const selected = shuffled(vocabulary, random).slice(0, pairCount);
    const pairs = selected.map((pair, index) => {
        const pairId = `${pair.id}-${index}`;
        return {
            word: { id: `${pairId}-word`, pairId, kind: 'word' as const, label: pair.word, revealed: false, matched: false },
            definition: { id: `${pairId}-definition`, pairId, kind: 'definition' as const, label: pair.definition, revealed: false, matched: false },
        };
    });
    return [
        ...shuffled(pairs.map((pair) => pair.word), random),
        ...shuffled(pairs.map((pair) => pair.definition), random),
    ];
}

export class MemoryGameRound {
    readonly cards: MemoryCard[];
    moves = 0;
    matchedPairs = 0;
    startedAt: number | null = null;
    finishedAt: number | null = null;
    locked = false;
    private firstCardIndex: number | null = null;

    constructor(cards: MemoryCard[]) {
        this.cards = cards.map((card) => ({ ...card }));
    }

    flip(cardIndex: number, now: number): FlipResult {
        const card = this.cards[cardIndex];
        if (!card || this.locked || card.revealed || card.matched || this.finishedAt !== null) {
            return { type: 'ignored' };
        }

        if (this.startedAt === null) this.startedAt = now;
        card.revealed = true;

        if (this.firstCardIndex === null) {
            this.firstCardIndex = cardIndex;
            return { type: 'first', cardIndex };
        }

        const firstIndex = this.firstCardIndex;
        const firstCard = this.cards[firstIndex] as MemoryCard;
        this.moves += 1;

        if (firstCard.pairId === card.pairId && firstCard.kind !== card.kind) {
            firstCard.matched = true;
            card.matched = true;
            this.matchedPairs += 1;
            this.firstCardIndex = null;
            const complete = this.matchedPairs === this.cards.length / 2;
            if (complete) this.finishedAt = now;
            return { type: 'match', cardIndices: [firstIndex, cardIndex], complete };
        }

        this.locked = true;
        return { type: 'mismatch', cardIndices: [firstIndex, cardIndex] };
    }

    resolveMismatch(cardIndices: [number, number]): void {
        cardIndices.forEach((index) => {
            const card = this.cards[index];
            if (card && !card.matched) card.revealed = false;
        });
        this.firstCardIndex = null;
        this.locked = false;
    }

    elapsedSeconds(now: number): number {
        if (this.startedAt === null) return 0;
        return Math.max(0, Math.floor(((this.finishedAt ?? now) - this.startedAt) / 1000));
    }
}

export async function mountMemoryGame(
    root: HTMLElement,
    options: MountMemoryGameOptions = {},
): Promise<MemoryGameHandle> {
    const pairCount = options.pairCount ?? 6;
    const mismatchDelay = options.mismatchDelay ?? 800;
    const random = options.random ?? Math.random;
    const now = options.now ?? Date.now;
    const vocabularyUrl = options.vocabularyUrl ?? new URL('../../pte_vocab.json', import.meta.url);
    const response = await fetch(vocabularyUrl, { signal: options.signal });
    if (!response.ok) throw new Error('Vocabulary could not be loaded.');

    const vocabulary = normalizeVocabulary(await response.json());
    if (vocabulary.length < pairCount) {
        throw new Error(`At least ${pairCount} valid vocabulary pairs are required.`);
    }

    let round: MemoryGameRound;
    let destroyed = false;
    let timerId: number | null = null;
    let mismatchTimerId: number | null = null;
    let completionTimerId: number | null = null;

    root.innerHTML = `
        <section class="memory-game" aria-labelledby="memory-game-title">
            <div class="memory-game-header">
                <div>
                    <p class="memory-game-eyebrow">Vocabulary challenge</p>
                    <h2 id="memory-game-title">Memory Match</h2>
                    <p class="memory-game-instructions">Match each English word with its Chinese meaning.</p>
                </div>
                <div class="memory-game-stats" aria-label="Game statistics">
                    <span>Moves <strong data-game-moves>0</strong></span>
                    <span>Time <strong data-game-time>0s</strong></span>
                </div>
            </div>
            <div class="memory-game-board" data-game-board aria-label="Memory card board"></div>
            <p class="memory-game-status visually-hidden" data-game-status role="status" aria-live="polite"></p>
            <div class="memory-game-result" data-game-result hidden>
                <p class="memory-game-result-label">Board complete</p>
                <h3>Great memory!</h3>
                <p data-game-summary></p>
                <button class="memory-game-restart" data-game-restart type="button">Play again</button>
            </div>
        </section>`;

    const board = root.querySelector<HTMLElement>('[data-game-board]') as HTMLElement;
    const moves = root.querySelector<HTMLElement>('[data-game-moves]') as HTMLElement;
    const time = root.querySelector<HTMLElement>('[data-game-time]') as HTMLElement;
    const status = root.querySelector<HTMLElement>('[data-game-status]') as HTMLElement;
    const result = root.querySelector<HTMLElement>('[data-game-result]') as HTMLElement;
    const summary = root.querySelector<HTMLElement>('[data-game-summary]') as HTMLElement;
    const restartButton = root.querySelector<HTMLButtonElement>('[data-game-restart]') as HTMLButtonElement;

    const updateStats = (): void => {
        moves.textContent = String(round.moves);
        time.textContent = `${round.elapsedSeconds(now())}s`;
    };

    const createCardButton = (card: MemoryCard, index: number): HTMLButtonElement => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'memory-card';
            button.dataset.cardIndex = String(index);
            const inner = document.createElement('span');
            inner.className = 'memory-card-inner';
            const front = document.createElement('span');
            front.className = 'memory-card-face memory-card-front';
            front.textContent = '?';
            const back = document.createElement('span');
            back.className = 'memory-card-face memory-card-back';
            back.textContent = card.label;
            inner.append(front, back);
            button.appendChild(inner);
            return button;
    };

    const buildBoard = (): void => {
        const createGroup = (kind: MemoryCard['kind'], title: string): HTMLElement => {
            const group = document.createElement('section');
            group.className = `memory-game-card-group memory-game-card-group-${kind}`;
            group.setAttribute('aria-label', title);
            const heading = document.createElement('p');
            heading.className = 'memory-game-card-group-title';
            heading.textContent = title;
            const grid = document.createElement('div');
            grid.className = 'memory-game-card-grid';
            round.cards.forEach((card, index) => {
                if (card.kind === kind) grid.appendChild(createCardButton(card, index));
            });
            group.append(heading, grid);
            return group;
        };
        board.replaceChildren(
            createGroup('word', 'English words'),
            createGroup('definition', 'Chinese meanings'),
        );
    };

    const renderBoard = (focusIndex?: number): void => {
        round.cards.forEach((card, index) => {
            const button = board.querySelector<HTMLButtonElement>(`[data-card-index="${index}"]`);
            if (!button) return;
            const visible = card.revealed || card.matched;
            button.classList.toggle('is-revealed', visible);
            button.classList.toggle('is-matched', card.matched);
            button.disabled = card.matched || round.locked;
            button.setAttribute('aria-pressed', String(visible));
            button.setAttribute('aria-label', visible
                ? `${card.kind === 'word' ? 'Word' : 'Meaning'}: ${card.label}${card.matched ? ', matched' : ''}`
                : `Hidden ${card.kind === 'word' ? 'word' : 'meaning'} card ${index + 1}`);
        });
        if (focusIndex !== undefined) {
            board.querySelector<HTMLButtonElement>(`[data-card-index="${focusIndex}"]`)?.focus();
        }
        updateStats();
    };

    const stopTimers = (): void => {
        if (timerId !== null) window.clearInterval(timerId);
        if (mismatchTimerId !== null) window.clearTimeout(mismatchTimerId);
        if (completionTimerId !== null) window.clearTimeout(completionTimerId);
        timerId = null;
        mismatchTimerId = null;
        completionTimerId = null;
    };

    const startTimer = (): void => {
        if (timerId !== null) return;
        timerId = window.setInterval(updateStats, 250);
    };

    const restart = (): void => {
        stopTimers();
        round = new MemoryGameRound(createDeck(vocabulary, pairCount, random));
        result.hidden = true;
        board.hidden = false;
        status.textContent = 'New game started.';
        buildBoard();
        renderBoard();
    };

    const handleBoardClick = (event: Event): void => {
        const button = (event.target as Element).closest<HTMLButtonElement>('[data-card-index]');
        if (!button || !board.contains(button)) return;
        const cardIndex = Number(button.dataset.cardIndex);
        const flipResult = round.flip(cardIndex, now());
        if (flipResult.type === 'ignored') return;
        startTimer();
        renderBoard(cardIndex);

        if (flipResult.type === 'first') {
            status.textContent = 'First card revealed. Choose its match.';
            return;
        }
        if (flipResult.type === 'match') {
            status.textContent = 'Match found.';
            if (flipResult.complete) {
                stopTimers();
                updateStats();
                summary.textContent = `You matched all ${pairCount} pairs in ${round.moves} moves and ${round.elapsedSeconds(now())} seconds.`;
                status.textContent = summary.textContent;
                completionTimerId = window.setTimeout(() => {
                    if (destroyed) return;
                    completionTimerId = null;
                    board.hidden = true;
                    result.hidden = false;
                    restartButton.focus();
                }, 520);
            }
            return;
        }

        status.textContent = 'Not a match. The cards will turn back over.';
        mismatchTimerId = window.setTimeout(() => {
            if (destroyed) return;
            round.resolveMismatch(flipResult.cardIndices);
            mismatchTimerId = null;
            renderBoard(flipResult.cardIndices[0]);
            status.textContent = 'Cards hidden. Try again.';
        }, mismatchDelay);
    };

    const handleRestart = (): void => restart();
    board.addEventListener('click', handleBoardClick);
    restartButton.addEventListener('click', handleRestart);
    restart();

    return {
        restart,
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            stopTimers();
            board.removeEventListener('click', handleBoardClick);
            restartButton.removeEventListener('click', handleRestart);
            root.replaceChildren();
        },
    };
}

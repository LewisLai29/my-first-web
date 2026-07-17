import type { EngineView } from '../game/engine.js';
import type { GameEffect, GamePhase, GameState, VocabularyEntry, WaveState } from '../game/types.js';
import { ENEMY_ASSET_URLS, PLAYER_ASSET_URL, PLAYER_ATTACK_ASSET_URLS } from './asset-catalog.js';
import { WordfrontAnimations } from './animations.js';
import { wireWordfrontInputs, type WordfrontInputHandlers } from './input.js';

const required = <T extends Element>(root: ParentNode, selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Wordfront element is missing: ${selector}`);
    return element;
};

const formatSeconds = (milliseconds: number): string => `${(Math.max(0, milliseconds) / 1000).toFixed(1)}s`;

export class DomWordfrontView implements EngineView {
    private readonly entriesById: ReadonlyMap<string, VocabularyEntry>;
    private readonly animations: WordfrontAnimations;
    private readonly cleanupInput: () => void;
    private lastQuestionId = '';
    private lastWaveKey = '';
    private lastResultRevision = -1;

    constructor(
        private readonly root: HTMLElement,
        entries: readonly VocabularyEntry[],
        handlers: WordfrontInputHandlers,
        private readonly questionDurationMs: number,
    ) {
        this.entriesById = new Map(entries.map((entry) => [entry.id, entry]));
        this.root.innerHTML = `
            <section class="wordfront-game" aria-labelledby="wordfront-title">
                <header class="wordfront-hud">
                    <div class="wordfront-brand">
                        <span class="wordfront-brand-mark" aria-hidden="true">W</span>
                        <div><p>Vocabulary defense</p><h2 id="wordfront-title">Wordfront</h2></div>
                    </div>
                    <div class="wordfront-hud-stats">
                        <div><span>Wave</span><strong data-wordfront-wave>1 / 3</strong></div>
                        <div class="wordfront-player-health">
                            <span>HP</span><strong data-wordfront-player-hp>100 / 100</strong>
                            <span class="wordfront-health-track" aria-hidden="true"><span data-wordfront-player-health-bar></span></span>
                        </div>
                    </div>
                    <div class="wordfront-hud-actions">
                        <button type="button" data-wordfront-action="pause">Pause</button>
                        <button type="button" data-wordfront-action="close">Exit</button>
                    </div>
                </header>

                <main class="wordfront-battlefield" data-wordfront-battlefield>
                    <div class="wordfront-asset-preload" aria-hidden="true">
                        ${PLAYER_ATTACK_ASSET_URLS.map((url) => `<img src="${url}" alt="">`).join('')}
                    </div>
                    <div class="wordfront-question-panel" data-wordfront-question-panel hidden>
                        <span class="wordfront-question-label">Choose the English word</span>
                        <p data-wordfront-definition></p>
                        <div class="wordfront-timer-row">
                            <span class="wordfront-timer-track"><span data-wordfront-timer-bar></span></span>
                            <strong data-wordfront-timer>10.0s</strong>
                        </div>
                    </div>

                    <div class="wordfront-player-zone">
                        <div class="wordfront-player" data-wordfront-player>
                            <img src="${PLAYER_ASSET_URL}" alt="Word mage">
                        </div>
                        <div class="wordfront-answer-panel">
                            <p class="wordfront-penalty" data-wordfront-penalty hidden></p>
                            <div class="wordfront-answers" data-wordfront-answers></div>
                        </div>
                    </div>

                    <div class="wordfront-enemies" data-wordfront-enemies aria-label="Enemy wave"></div>
                    <div class="wordfront-ground" aria-hidden="true"></div>
                </main>

                <p class="visually-hidden" data-wordfront-status role="status" aria-live="polite"></p>

                <div class="wordfront-screen wordfront-intro" data-wordfront-intro>
                    <div class="wordfront-screen-card">
                        <p class="wordfront-kicker">Three waves. Twenty-nine words.</p>
                        <h3>Defend the Wordfront</h3>
                        <div class="wordfront-rules">
                            <span><strong>1</strong> Read the Chinese meaning.</span>
                            <span><strong>2</strong> Choose the correct English word.</span>
                            <span><strong>3</strong> Answer before the monster attacks.</span>
                        </div>
                        <button type="button" class="wordfront-primary" data-wordfront-action="start">Start Battle</button>
                    </div>
                </div>

                <div class="wordfront-screen" data-wordfront-pause hidden>
                    <div class="wordfront-screen-card wordfront-small-card">
                        <p class="wordfront-kicker">Battle paused</p>
                        <h3>Ready to continue?</h3>
                        <p data-wordfront-pause-message>Your timers are frozen.</p>
                        <button type="button" class="wordfront-primary" data-wordfront-action="resume">Resume</button>
                        <button type="button" class="wordfront-secondary" data-wordfront-action="close">Exit Battle</button>
                    </div>
                </div>

                <div class="wordfront-screen wordfront-wave-clear" data-wordfront-wave-clear hidden>
                    <div><p>Wave Clear</p><strong data-wordfront-next-wave></strong></div>
                </div>

                <div class="wordfront-screen" data-wordfront-result hidden>
                    <div class="wordfront-screen-card wordfront-result-card">
                        <p class="wordfront-kicker" data-wordfront-result-kicker></p>
                        <h3 data-wordfront-result-title></h3>
                        <div class="wordfront-result-stats" data-wordfront-result-stats></div>
                        <div class="wordfront-review" data-wordfront-review></div>
                        <div class="wordfront-result-actions">
                            <button type="button" class="wordfront-primary" data-wordfront-action="restart">Play Again</button>
                            <button type="button" class="wordfront-secondary" data-wordfront-action="close">Exit Battle</button>
                        </div>
                    </div>
                </div>

                <div class="wordfront-rotate" data-wordfront-rotate hidden>
                    <span aria-hidden="true">↻</span><strong>Rotate your device</strong><p>Wordfront plays in landscape mode.</p>
                </div>
            </section>`;
        this.animations = new WordfrontAnimations(this.root);
        this.cleanupInput = wireWordfrontInputs(this.root, handlers);
    }

    render(state: Readonly<GameState>, now: number): void {
        const effectivePhase = state.phase === 'paused' ? state.resumePhase ?? 'intro' : state.phase;
        const wave = state.waves[state.currentWaveIndex] ?? state.waves[0];
        const game = required<HTMLElement>(this.root, '.wordfront-game');
        game.dataset.phase = state.phase;

        required<HTMLElement>(this.root, '[data-wordfront-wave]').textContent = `${state.currentWaveIndex + 1} / ${state.waves.length}`;
        required<HTMLElement>(this.root, '[data-wordfront-player-hp]').textContent = `${state.player.hp} / ${state.player.maxHp}`;
        required<HTMLElement>(this.root, '[data-wordfront-player-health-bar]').style.width = `${state.player.hp / state.player.maxHp * 100}%`;
        this.renderWave(wave);
        this.renderQuestion(state, now, effectivePhase);
        this.renderScreens(state, now, effectivePhase);
    }

    play(effect: GameEffect): Promise<void> {
        if (effect.type === 'ANNOUNCE') {
            required<HTMLElement>(this.root, '[data-wordfront-status]').textContent = effect.message;
            return Promise.resolve();
        }
        if (effect.type === 'FOCUS') {
            window.requestAnimationFrame(() => {
                if (effect.target === 'first-answer') {
                    this.root.querySelector<HTMLButtonElement>('[data-wordfront-action="answer"]:not(:disabled)')?.focus();
                } else if (effect.target === 'resume') {
                    this.root.querySelector<HTMLButtonElement>('[data-wordfront-action="resume"]')?.focus();
                } else {
                    this.root.querySelector<HTMLButtonElement>('[data-wordfront-action="restart"]')?.focus();
                }
            });
            return Promise.resolve();
        }
        return this.animations.play(effect);
    }

    setAnimationsPaused(paused: boolean): void {
        this.animations.setPaused(paused);
    }

    destroy(): void {
        this.cleanupInput();
        this.animations.destroy();
        this.root.replaceChildren();
    }

    private renderWave(wave: WaveState | undefined): void {
        if (!wave) return;
        const key = `${wave.index}:${wave.enemies.map((enemy) => enemy.id).join('|')}`;
        const container = required<HTMLElement>(this.root, '[data-wordfront-enemies]');
        if (key !== this.lastWaveKey) {
            this.lastWaveKey = key;
            container.replaceChildren(...wave.enemies.map((enemy, index) => {
                const element = document.createElement('article');
                element.className = `wordfront-enemy wordfront-enemy-${enemy.kind}`;
                element.dataset.enemyId = enemy.id;
                element.dataset.enemyIndex = String(index);
                element.innerHTML = `
                    <div class="wordfront-enemy-health" aria-label="Enemy health">
                        <span><span data-enemy-health-bar></span></span><strong data-enemy-health></strong>
                    </div>
                    <img src="${ENEMY_ASSET_URLS[enemy.kind]}" alt="${enemy.kind === 'boss' ? 'Boss monster' : `${enemy.kind} monster`}">`;
                return element;
            }));
        }

        wave.enemies.forEach((enemy, index) => {
            const element = container.querySelector<HTMLElement>(`[data-enemy-id="${enemy.id}"]`);
            if (!element) return;
            element.classList.toggle('is-active', index === wave.activeEnemyIndex);
            element.classList.toggle('is-defeated', enemy.hp <= 0 && index < wave.activeEnemyIndex);
            element.style.setProperty('--queue-index', String(index - wave.activeEnemyIndex));
            element.style.setProperty('--advance-step', String(index === wave.activeEnemyIndex ? enemy.advanceStep : 0));
            required<HTMLElement>(element, '[data-enemy-health]').textContent = `${enemy.hp}/${enemy.maxHp}`;
            required<HTMLElement>(element, '[data-enemy-health-bar]').style.width = `${enemy.hp / enemy.maxHp * 100}%`;
        });
    }

    private renderQuestion(state: Readonly<GameState>, now: number, effectivePhase: GamePhase): void {
        const panel = required<HTMLElement>(this.root, '[data-wordfront-question-panel]');
        const definition = required<HTMLElement>(this.root, '[data-wordfront-definition]');
        const answers = required<HTMLElement>(this.root, '[data-wordfront-answers]');
        const questionVisible = Boolean(state.question) && !['intro', 'wave-transition', 'victory', 'defeat'].includes(effectivePhase);
        panel.hidden = !questionVisible;
        if (!state.question) {
            definition.textContent = '';
            answers.replaceChildren();
            this.lastQuestionId = '';
            return;
        }

        definition.textContent = state.question.definition;
        if (this.lastQuestionId !== state.question.id) {
            this.lastQuestionId = state.question.id;
            answers.replaceChildren(...state.question.options.map((option, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.dataset.wordfrontAction = 'answer';
                button.dataset.entryId = option.entryId;
                button.innerHTML = `<span>${index + 1}</span><strong></strong>`;
                required<HTMLElement>(button, 'strong').textContent = option.label;
                return button;
            }));
        }

        const inPenalty = state.penaltyDeadlineGameMs !== null && now < state.penaltyDeadlineGameMs;
        const penalty = required<HTMLElement>(this.root, '[data-wordfront-penalty]');
        penalty.hidden = !inPenalty;
        penalty.textContent = inPenalty ? `Try again in ${Math.ceil(((state.penaltyDeadlineGameMs as number) - now) / 1000)}s` : '';
        answers.querySelectorAll<HTMLButtonElement>('[data-entry-id]').forEach((button) => {
            const entryId = button.dataset.entryId ?? '';
            const eliminated = state.question?.eliminatedEntryIds.includes(entryId) ?? false;
            const resolvingCorrect = effectivePhase === 'resolving-player-attack' && entryId === state.question?.targetEntryId;
            button.classList.toggle('is-wrong', eliminated);
            button.classList.toggle('is-correct', resolvingCorrect);
            button.disabled = effectivePhase !== 'playing' || inPenalty || eliminated;
        });

        const remaining = state.questionDeadlineGameMs === null
            ? 0
            : Math.max(0, state.questionDeadlineGameMs - now);
        const timer = required<HTMLElement>(this.root, '[data-wordfront-timer]');
        const timerBar = required<HTMLElement>(this.root, '[data-wordfront-timer-bar]');
        timer.textContent = effectivePhase === 'playing' ? formatSeconds(remaining) : 'Resolving';
        timerBar.style.width = `${Math.min(100, remaining / this.questionDurationMs * 100)}%`;
        timerBar.classList.toggle('is-urgent', remaining > 0 && remaining <= 3_000);
    }

    private renderScreens(state: Readonly<GameState>, now: number, effectivePhase: GamePhase): void {
        const intro = required<HTMLElement>(this.root, '[data-wordfront-intro]');
        const pause = required<HTMLElement>(this.root, '[data-wordfront-pause]');
        const waveClear = required<HTMLElement>(this.root, '[data-wordfront-wave-clear]');
        const result = required<HTMLElement>(this.root, '[data-wordfront-result]');
        const rotate = required<HTMLElement>(this.root, '[data-wordfront-rotate]');
        const portrait = state.pauseReasons.includes('portrait');

        intro.hidden = effectivePhase !== 'intro';
        pause.hidden = state.phase !== 'paused' || portrait;
        rotate.hidden = !portrait;
        waveClear.hidden = effectivePhase !== 'wave-transition';
        result.hidden = effectivePhase !== 'victory' && effectivePhase !== 'defeat';

        if (state.phase === 'paused' && !portrait) {
            const blockers = state.pauseReasons.filter((reason) => reason !== 'manual');
            const resume = required<HTMLButtonElement>(pause, '[data-wordfront-action="resume"]');
            resume.disabled = blockers.length > 0;
            required<HTMLElement>(pause, '[data-wordfront-pause-message]').textContent = blockers.length > 0
                ? 'Return to this window before resuming.'
                : 'Your timers are frozen.';
        }

        if (effectivePhase === 'wave-transition') {
            const remaining = state.waveDeadlineGameMs === null ? 0 : state.waveDeadlineGameMs - now;
            required<HTMLElement>(waveClear, '[data-wordfront-next-wave]').textContent = `Wave ${state.currentWaveIndex + 2} in ${Math.max(1, Math.ceil(remaining / 1000))}`;
        }

        if ((effectivePhase === 'victory' || effectivePhase === 'defeat') && this.lastResultRevision !== state.revision) {
            this.lastResultRevision = state.revision;
            this.renderResult(state, effectivePhase);
        }
    }

    private renderResult(state: Readonly<GameState>, phase: GamePhase): void {
        const correct = state.stats.correctSelections;
        const wrong = state.stats.wrongSelections;
        const attempts = correct + wrong;
        const accuracy = attempts === 0 ? 0 : Math.round(correct / attempts * 100);
        const elapsed = (state.stats.finishedAtGameMs ?? 0) - (state.stats.startedAtGameMs ?? 0);
        required<HTMLElement>(this.root, '[data-wordfront-result-kicker]').textContent = phase === 'victory' ? 'Battle complete' : 'The line has fallen';
        required<HTMLElement>(this.root, '[data-wordfront-result-title]').textContent = phase === 'victory' ? 'Victory!' : 'Defeat';
        required<HTMLElement>(this.root, '[data-wordfront-result-stats]').innerHTML = `
            <div><span>Time</span><strong>${Math.floor(elapsed / 1000)}s</strong></div>
            <div><span>Correct</span><strong>${correct}</strong></div>
            <div><span>Wrong</span><strong>${wrong}</strong></div>
            <div><span>Accuracy</span><strong>${accuracy}%</strong></div>
            <div><span>HP</span><strong>${state.player.hp}</strong></div>`;

        const review = required<HTMLElement>(this.root, '[data-wordfront-review]');
        const missed = state.stats.wrongEntryIds
            .map((id) => this.entriesById.get(id))
            .filter((entry): entry is VocabularyEntry => Boolean(entry));
        review.innerHTML = missed.length === 0
            ? '<h4>Word review</h4><p>No missed words. Excellent work.</p>'
            : `<h4>Word review</h4><ul>${missed.map((entry) => `<li><strong>${this.escape(entry.word)}</strong><span>${this.escape(entry.definition)}</span></li>`).join('')}</ul>`;
    }

    private escape(value: string): string {
        const element = document.createElement('span');
        element.textContent = value;
        return element.innerHTML;
    }
}

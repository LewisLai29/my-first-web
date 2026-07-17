import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { normalizeVocabulary } from '../dist/data/vocabulary.js';
import { DEFAULT_CONFIG } from '../dist/game/config.js';
import { createInitialState, reduceGame } from '../dist/game/reducer.js';
import { createSessionQuestions } from '../dist/features/questions/questions.js';
import { activate } from '../dist/plugin.js';
import { WordfrontAnimations } from '../dist/ui/animations.js';
import { DomWordfrontView } from '../dist/ui/view.js';

const entries = normalizeVocabulary(Array.from({ length: 40 }, (_, index) => ({
    id: index + 1,
    word: `word-${index + 1}`,
    definition: `中文解釋-${index + 1}`,
    partOfSpeech: 'n.',
})));

function installDom(markup) {
    const dom = new JSDOM(markup, {
        pretendToBeVisual: true,
        url: 'http://localhost/',
    });
    dom.window.matchMedia = () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
    });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.Element = dom.window.Element;
    globalThis.HTMLElement = dom.window.HTMLElement;
    return () => {
        dom.window.close();
        delete globalThis.window;
        delete globalThis.document;
        delete globalThis.Element;
        delete globalThis.HTMLElement;
    };
}

test('renders the battle HUD, current wave, artwork and four answer buttons', () => {
    const cleanup = installDom('<div id="wordfront-root"></div>');
    try {
        const root = document.querySelector('#wordfront-root');
        const selected = [];
        const view = new DomWordfrontView(root, entries, {
            onStart() {},
            onAnswer(entryId) { selected.push(entryId); },
            onPause() {},
            onResume() {},
            onRestart() {},
            onClose() {},
        }, DEFAULT_CONFIG.questionDurationMs);
        const questions = createSessionQuestions(entries, 29, () => 0.37);
        let state = createInitialState(DEFAULT_CONFIG, questions);
        state = reduceGame(state, { type: 'START', now: 0 }, DEFAULT_CONFIG).state;

        view.render(state, 0);

        const panel = root.querySelector('[data-wordfront-question-panel]');
        const answers = [...root.querySelectorAll('[data-wordfront-action="answer"]')];
        assert.equal(panel.hidden, false);
        assert.equal(root.querySelector('[data-wordfront-definition]').textContent, state.question.definition);
        assert.equal(answers.length, 4);
        assert.equal(root.querySelectorAll('.wordfront-enemy').length, 3);
        assert.equal(root.querySelectorAll('.wordfront-asset-preload img').length, 6);
        assert.match(root.querySelector('.wordfront-player img').src, /mage-base\.png$/);
        assert.match(root.querySelector('.wordfront-enemy img').src, /normal-base\.png$/);

        answers[0].click();
        assert.deepEqual(selected, [answers[0].dataset.entryId]);
        view.destroy();
    } finally {
        cleanup();
    }
});

test('registers Wordfront as an independent home tile and removes it on dispose', () => {
    const cleanup = installDom(`
        <main id="home-root">
            <div id="home-features"></div>
            <span id="home-quick-tools-count">4</span>
        </main>`);
    try {
        const modes = new Map();
        const context = {
            document,
            getElement: (id) => document.getElementById(id),
            vocabularyUrl: '/pte_vocab.json',
            home: {
                root: document.getElementById('home-root'),
                features: document.getElementById('home-features'),
                popupController: {
                    close() {},
                    isModeOpen() { return false; },
                    prepareExclusive() {},
                    show() { return true; },
                },
                registerPopupMode(mode, popupId, lifecycle) {
                    modes.set(mode, { popupId, lifecycle });
                    return () => modes.delete(mode);
                },
            },
        };

        const plugin = activate(context);
        assert.ok(document.getElementById('start-wordfront'));
        assert.ok(document.getElementById('wordfront-overlay'));
        assert.ok(document.getElementById('wordfront-overlay-fullscreen'));
        assert.equal(document.getElementById('wordfront-overlay-fullscreen').hidden, true);
        assert.equal(modes.get('wordfront').popupId, 'wordfront-overlay');
        assert.equal(document.getElementById('home-quick-tools-count').textContent, '5');

        plugin.dispose();
        assert.equal(document.getElementById('start-wordfront'), null);
        assert.equal(document.getElementById('wordfront-overlay'), null);
        assert.equal(modes.size, 0);
        assert.equal(document.getElementById('home-quick-tools-count').textContent, '4');
    } finally {
        cleanup();
    }
});

test('offers a fullscreen toggle when the browser supports element fullscreen', async () => {
    const cleanup = installDom(`
        <main id="home-root">
            <div id="home-features"></div>
        </main>`);
    let fullscreenElement = null;
    let requestCount = 0;
    let exitCount = 0;
    Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => fullscreenElement,
    });
    Element.prototype.requestFullscreen = function requestFullscreen() {
        requestCount += 1;
        fullscreenElement = this;
        document.dispatchEvent(new window.Event('fullscreenchange'));
        return Promise.resolve();
    };
    document.exitFullscreen = function exitFullscreen() {
        exitCount += 1;
        fullscreenElement = null;
        document.dispatchEvent(new window.Event('fullscreenchange'));
        return Promise.resolve();
    };
    try {
        const context = {
            document,
            getElement: (id) => document.getElementById(id),
            vocabularyUrl: '/pte_vocab.json',
            home: {
                root: document.getElementById('home-root'),
                features: document.getElementById('home-features'),
                popupController: {
                    close() {},
                    isModeOpen() { return true; },
                    prepareExclusive() {},
                    show() { return true; },
                },
                registerPopupMode() { return () => {}; },
            },
        };

        const plugin = activate(context);
        const button = document.getElementById('wordfront-overlay-fullscreen');
        assert.equal(button.hidden, false);
        assert.equal(button.getAttribute('aria-label'), 'Enter fullscreen');

        button.click();
        await Promise.resolve();
        assert.equal(requestCount, 1);
        assert.equal(button.getAttribute('aria-label'), 'Exit fullscreen');

        fullscreenElement = null;
        document.dispatchEvent(new window.Event('fullscreenchange'));
        assert.equal(button.getAttribute('aria-label'), 'Enter fullscreen');

        button.click();
        await Promise.resolve();
        assert.equal(requestCount, 2);
        assert.equal(button.getAttribute('aria-label'), 'Exit fullscreen');

        button.click();
        await Promise.resolve();
        assert.equal(exitCount, 1);

        plugin.dispose();
    } finally {
        delete Element.prototype.requestFullscreen;
        cleanup();
    }
});

test('player attack animates casting, the word projectile and impact in sequence', async () => {
    const cleanup = installDom(`
        <div id="root">
            <div data-wordfront-battlefield>
                <div class="wordfront-player" data-wordfront-player><img src="/mage-base.png" alt=""></div>
                <div data-enemy-id="enemy-1"></div>
            </div>
        </div>`);
    const calls = [];
    const frameCallbacks = new Map();
    let nextFrameRequest = 0;
    let spriteAnimation;
    let finishSpriteAnimation;
    window.requestAnimationFrame = (callback) => {
        const requestId = ++nextFrameRequest;
        frameCallbacks.set(requestId, callback);
        return requestId;
    };
    window.cancelAnimationFrame = (requestId) => frameCallbacks.delete(requestId);
    Element.prototype.animate = function animate(frames, options) {
        calls.push({ className: this.className, tagName: this.tagName, frames, options, src: this.src });
        if (this.tagName === 'IMG') {
            const finished = new Promise((resolve) => { finishSpriteAnimation = resolve; });
            spriteAnimation = {
                currentTime: 0,
                playState: 'running',
                finished,
                pause() { this.playState = 'paused'; },
                play() { this.playState = 'running'; },
                cancel() { this.playState = 'idle'; finishSpriteAnimation(); },
            };
            return spriteAnimation;
        }
        return {
            finished: Promise.resolve(),
            pause() {},
            play() {},
            cancel() {},
        };
    };
    try {
        const root = document.getElementById('root');
        const animations = new WordfrontAnimations(root);
        const attack = animations.play({
            type: 'ANIMATE_PLAYER_ATTACK',
            word: 'analyse',
            enemyId: 'enemy-1',
        });
        const playerImage = root.querySelector('[data-wordfront-player] img');
        const frameName = (source) => source.match(/mage-cast-\d{2}\.png/)?.[0];
        const displayedFrames = [frameName(playerImage.src)];
        for (const elapsed of [115, 230, 345, 460, 575]) {
            spriteAnimation.currentTime = elapsed;
            const callbacks = [...frameCallbacks.values()];
            frameCallbacks.clear();
            callbacks.forEach((callback) => callback(elapsed));
            displayedFrames.push(frameName(playerImage.src));
        }
        spriteAnimation.currentTime = 690;
        spriteAnimation.playState = 'finished';
        [...frameCallbacks.values()].forEach((callback) => callback(690));
        frameCallbacks.clear();
        finishSpriteAnimation();
        await attack;

        assert.equal(calls[0].className, 'wordfront-player');
        const spriteDriver = calls.find((call) => call.tagName === 'IMG');
        assert.ok(spriteDriver);
        assert.equal(spriteDriver.options.duration, 690);
        assert.ok(calls.some((call) => call.className === 'wordfront-cast-burst' && call.options.delay === 70));
        assert.ok(calls.some((call) => call.className === 'wordfront-projectile' && call.options.delay === 180));
        assert.ok(calls.some((call) => call.className === 'wordfront-impact' && call.options.delay === 640));
        assert.deepEqual(displayedFrames, [
            'mage-cast-01.png',
            'mage-cast-02.png',
            'mage-cast-03.png',
            'mage-cast-04.png',
            'mage-cast-05.png',
            'mage-cast-06.png',
        ]);
        assert.match(playerImage.src, /mage-base\.png$/);
        assert.equal(playerImage.style.visibility, '');
        assert.equal(root.querySelector('[data-wordfront-cast-burst]'), null);
        assert.equal(root.querySelector('[data-wordfront-projectile]'), null);
        assert.equal(root.querySelector('[data-wordfront-impact]'), null);
        animations.destroy();
    } finally {
        delete Element.prototype.animate;
        cleanup();
    }
});

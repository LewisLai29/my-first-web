import { loadVocabulary } from './data/vocabulary.js';
import { DEFAULT_CONFIG } from './game/config.js';
import { createEngine } from './game/engine.js';
import { createSessionQuestions } from './features/questions/questions.js';
import { countWaveHp, createWaves } from './features/waves/waves.js';
import { PausableGameClock } from './platform/clock.js';
import { bindGameLifecycle } from './platform/lifecycle.js';
import { DomWordfrontView } from './ui/view.js';
export function createWordfrontController({ root, vocabularyUrl, onClose, }) {
    let engine = null;
    let view = null;
    let abortController = null;
    let cleanupLifecycle = null;
    let vocabulary = null;
    let sessionToken = 0;
    const destroyRuntime = () => {
        cleanupLifecycle?.();
        cleanupLifecycle = null;
        engine?.destroy();
        engine = null;
        view?.destroy();
        view = null;
    };
    const destroySession = () => {
        sessionToken += 1;
        abortController?.abort();
        abortController = null;
        destroyRuntime();
        root.replaceChildren();
    };
    const mountSession = (entries) => {
        destroyRuntime();
        const token = ++sessionToken;
        const questionCount = countWaveHp(createWaves(DEFAULT_CONFIG.waves));
        const questions = createSessionQuestions(entries, questionCount);
        const clock = new PausableGameClock();
        const pause = (reason) => engine?.pause(reason);
        const clearPauseReason = (reason) => engine?.clearPauseReason(reason);
        const restart = () => {
            if (token !== sessionToken)
                return;
            mountSession(entries);
        };
        view = new DomWordfrontView(root, entries, {
            onStart: () => engine?.start(),
            onAnswer: (entryId) => engine?.submitAnswer(entryId),
            onPause: () => pause('manual'),
            onResume: () => {
                clearPauseReason('manual');
                engine?.resume();
            },
            onRestart: restart,
            onClose,
        }, DEFAULT_CONFIG.questionDurationMs);
        engine = createEngine({ config: DEFAULT_CONFIG, questions, clock, view });
        cleanupLifecycle = bindGameLifecycle({ pause, clearPauseReason });
    };
    const renderError = (error) => {
        root.innerHTML = `
            <div class="wordfront-load-state" role="alert">
                <div><p>Wordfront unavailable</p><h2>The battle could not be loaded.</h2><span>Please check the vocabulary source and try again.</span></div>
                <button type="button" data-wordfront-retry>Try Again</button>
            </div>`;
        root.querySelector('[data-wordfront-retry]')?.addEventListener('click', () => {
            void open();
        }, { once: true });
        console.error('Failed to load Wordfront.', error);
    };
    const open = async () => {
        destroySession();
        root.innerHTML = '<div class="wordfront-load-state" role="status"><div><p>Preparing the battlefield</p><h2>Loading Wordfront...</h2></div></div>';
        if (vocabulary) {
            mountSession(vocabulary);
            return true;
        }
        const token = sessionToken;
        const request = new AbortController();
        abortController = request;
        try {
            const entries = await loadVocabulary(vocabularyUrl, request.signal);
            if (request.signal.aborted || token !== sessionToken)
                return false;
            vocabulary = entries;
            abortController = null;
            mountSession(entries);
            return true;
        }
        catch (error) {
            if (request.signal.aborted || error?.name === 'AbortError')
                return false;
            abortController = null;
            renderError(error);
            return false;
        }
    };
    return { open, destroySession, destroy: destroySession };
}

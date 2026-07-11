import { getClozeEndlessMode, setClozeEndlessMode } from './settings.js';

export function createExamsController({
    getElement,
    onRefresh = () => {},
} = {}) {
    let mode = 'home';
    let eventsWired = false;

    function getPopupBody() {
        return getElement('tests-popup-body');
    }

    function getSessionBody() {
        return getElement('tests-session-body');
    }

    function getMode() {
        return mode;
    }

    function setView(nextMode) {
        mode = nextMode;

        const popupBody = getPopupBody();
        const homeView = getElement('tests-home-view');
        const sessionView = getElement('tests-session-view');
        const headerCopy = getElement('header-copy');

        if (popupBody) {
            popupBody.dataset.testsState = nextMode;
        }

        if (homeView) {
            homeView.hidden = nextMode !== 'home';
        }

        if (sessionView) {
            sessionView.hidden = nextMode === 'home';
        }

        if (headerCopy) {
            headerCopy.hidden = nextMode === 'home';
        }
    }

    function showHome({ unloadSession = true, onUnloadSession = () => {} } = {}) {
        if (unloadSession) {
            onUnloadSession();
        }

        setView('home');
        onRefresh();
    }

    function transitionView(nextMode, renderNextView) {
        const popupBody = getPopupBody();
        const reduceMotion = typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!popupBody || reduceMotion) {
            renderNextView();
            return Promise.resolve();
        }

        popupBody.classList.add('is-switching');
        return new Promise((resolve) => {
            window.setTimeout(() => {
                renderNextView();
                popupBody.classList.remove('is-switching');
                resolve();
            }, 120);
        });
    }

    function wireEvents({
        onOpenVocabExam = () => {},
        onOpenClozeExam = () => {},
        onOpenHistory = () => {},
        onBack = () => showHome(),
    } = {}) {
        if (eventsWired) return;
        eventsWired = true;

        const vocabExamButton = getElement('start-daily-quiz');
        const clozeExamButton = getElement('start-daily-exam');
        const endlessModeToggle = getElement('cloze-endless-mode');
        const historyButton = getElement('open-exam-history');
        const backButton = getElement('tests-back');

        if (endlessModeToggle) {
            endlessModeToggle.checked = getClozeEndlessMode();
            endlessModeToggle.addEventListener('change', () => {
                setClozeEndlessMode(endlessModeToggle.checked);
            });
        }

        if (vocabExamButton) {
            vocabExamButton.addEventListener('click', onOpenVocabExam);
        }

        if (clozeExamButton) {
            clozeExamButton.addEventListener('click', onOpenClozeExam);
        }

        if (historyButton) {
            historyButton.addEventListener('click', onOpenHistory);
        }

        if (backButton) {
            backButton.addEventListener('click', onBack);
        }
    }

    function reset() {
        mode = 'home';
        eventsWired = false;
    }

    return {
        getMode,
        getPopupBody,
        getSessionBody,
        reset,
        setView,
        showHome,
        transitionView,
        wireEvents,
    };
}

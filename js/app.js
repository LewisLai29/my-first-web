import {
    CLOZE_EXAM_PARTIAL,
    COLLOCA_PRACTICE_PARTIAL,
    EXAMS_HTML_FUNCTIONS,
    EXAM_HISTORY_PARTIAL,
    EXAMS_PARTIAL,
    FAVORITES_HTML_FUNCTIONS,
    FAVORITES_PARTIAL,
    FEATURE_HTML_FUNCTIONS,
    HOME_HTML_FUNCTIONS,
    PRACTICE_POPUP_PARTIALS,
    PRACTICE_MENU_PARTIAL,
    PRACTICE_HTML_FUNCTIONS,
    REVIEW_HTML_FUNCTIONS,
    SETTING_HTML_FUNCTIONS,
    SETTING_PARTIAL,
    VOCAB_EXAM_HTML_FUNCTIONS,
    VOCAB_EXAM_POPUP_PARTIALS,
    VOCAB_SOURCE,
} from './config.js';
import { getDateStringWithOffset } from './date-utils.js';
import { createHomePopupController } from './home-popup-controller.js';
import { loadHtmlFunctions } from './html-functions.js';
import { loadOptionalPlugins } from './optional-plugin-loader.js';
import { setupAuthUI } from './auth.js';
import { createExamsController } from './exams.js';
import { createExamHistoryController, renderExamHistory } from './exam-history.js';
import { createFavoritesController } from './favorites.js';
import { renderFavoritesScreen } from './favorites-ui.js';
import { createLookupController, hideLookupPopup } from './lookup.js';
import { fetchHtmlPartial, fetchHtmlParts } from './partial-loader.js';
import { createPopupScrollbarController } from './popup-scrollbar.js';
import { createQuizAttemptsController } from './exam-attempts.js';
import { renderQuizResultScreen } from './vocab-exam-ui.js';
import { renderReviewList } from './review-list.js';
import { getDailyWordCount } from './settings.js';
import { wireSettingEvents } from './setting-ui.js';
import { createSpeechController, canSpeak } from './speech.js';
import { renderTermList } from './terms.js';
import {
    buildVocabMeaningMap,
    normalizeLookupWord,
    normalizeVocabItems,
    pickDailyWords,
    shuffleWords,
} from './vocab.js';

const deckSessions = new Map();

let activeSession = null;
let activeDeckKey = '';
let dailyWords = [];
let currentIndex = 0;
let score = 0;
let reviewedWords = [];
let vocabMeaningMap = new Map();
let activeDeckOffset = 0;
let activeDeckDateString = '';
let pendingWordRenderTimer = null;
let activeLoadToken = 0;
let bootPromise = null;
let wiredAppRoot = null;
let bootedPageMode = '';
let quizDateString = '';
let quizIsSaving = false;
let quizIsLoading = false;
let quizIsResetting = false;
let activeRuntimeMode = '';
let activePracticeMode = 'menu';
let activeOptionalPlugins = [];

const homePopupIds = {
    setting: 'setting-popup',
    practice: 'practice-popup',
    favorites: 'favorites-popup',
    tests: 'tests-popup',
};
const optionalPopupLifecycles = new Map();

const favoritesController = createFavoritesController(() => {
    updateFavoriteButton();
    renderFavoritesPage();
});

const quizAttemptsController = createQuizAttemptsController(() => {
    renderQuizPageState();
});

const lookupController = createLookupController((word) => (
    vocabMeaningMap.get(normalizeLookupWord(word)) || ''
));

const speechController = createSpeechController(() => dailyWords[currentIndex]);

const popupScrollbarController = createPopupScrollbarController();
const cardScrollbarController = createPopupScrollbarController({
    popupSelector: '.card-back',
    scrollBodySelector: '.card-back-scroll-content',
    trackSelector: '.card-scrollbar',
    thumbSelector: '.card-scrollbar-thumb',
});

const homePopupController = createHomePopupController({
    getElement,
    onCancelMode: cancelPopupWork,
    onUnloadMode: unloadPopupContent,
    popupIds: homePopupIds,
});

const examsController = createExamsController({
    getElement,
    onRefresh: () => popupScrollbarController.refresh(),
});

const examHistoryController = createExamHistoryController((state) => {
    renderExamHistory(state);
    popupScrollbarController.refresh();
});

function getElement(id) {
    return document.getElementById(id);
}

function registerOptionalPopupMode(mode, popupId, lifecycle = {}) {
    homePopupIds[mode] = popupId;
    optionalPopupLifecycles.set(mode, lifecycle);
    return () => {
        homePopupController.close(mode);
        optionalPopupLifecycles.delete(mode);
        delete homePopupIds[mode];
    };
}

function disposeOptionalPlugins() {
    activeOptionalPlugins.splice(0).reverse().forEach((plugin) => plugin.dispose());
}

async function loadHomeOptionalPlugins() {
    const root = getElement('home-screen');
    const features = root?.querySelector('.home-features');
    if (!root || !features) return;

    disposeOptionalPlugins();
    activeOptionalPlugins = await loadOptionalPlugins(
        new URL('../plugins.json', import.meta.url),
        {
            document,
            getElement,
            vocabularyUrl: VOCAB_SOURCE,
            home: {
                root,
                features,
                popupController: homePopupController,
                registerPopupMode: registerOptionalPopupMode,
            },
        },
    );
}

function getPageMode() {
    const appRoot = getElement('app');
    const pageMode = appRoot && appRoot.dataset ? appRoot.dataset.page : '';

    if (pageMode === 'review' || pageMode === 'practice-menu' || pageMode === 'feature' || pageMode === 'setting' || pageMode === 'favorites' || pageMode === 'quiz' || pageMode === 'exams') {
        return pageMode;
    }

    return 'home';
}

function setHidden(id, hidden) {
    const element = getElement(id);
    if (element) {
        element.hidden = hidden;
    }
}

function syncHomeDailyWordCount(count = getDailyWordCount()) {
    const dailyWordCount = getElement('home-daily-word-count');
    if (dailyWordCount) {
        dailyWordCount.innerText = String(count);
    }
}

function setHomeVisible(visible) {
    if (!visible && isHomePopupOpen()) {
        return;
    }

    setHidden('home-screen', !visible);
}

function setQuizVisible(visible) {
    setHidden('quiz-box', !visible);
    setHidden('review-list-section', !visible);
    setHidden('header-copy', !visible);
}

function setResultVisible(visible) {
    setHidden('result-box', !visible);
}

function resetRuntimeState() {
    disposeOptionalPlugins();
    activeSession = null;
    activeRuntimeMode = '';
    activePracticeMode = 'menu';
    activeDeckKey = '';
    dailyWords = [];
    currentIndex = 0;
    score = 0;
    reviewedWords = [];
    vocabMeaningMap = new Map();
    activeDeckOffset = 0;
    activeDeckDateString = '';
    quizDateString = '';
    quizIsSaving = false;
    quizIsLoading = false;
    quizIsResetting = false;
    examsController.reset();
    activeLoadToken++;
    clearPendingWordRender();
    hideLookupPopup();
    wiredAppRoot = null;
    deckSessions.clear();
}

function isAppShellMounted() {
    const pageMode = getPageMode();

    if (pageMode === 'home') {
        return Boolean(getElement('home-screen') && getElement('start-review') && getElement('start-tests'));
    }

    if (pageMode === 'feature') {
        return Boolean(getElement('feature-screen') && getElement('auth-dialog'));
    }

    if (pageMode === 'setting') {
        return Boolean(getElement('setting-screen') && getElement('auth-dialog'));
    }

    if (pageMode === 'favorites') {
        return Boolean(getElement('favorites-screen') && getElement('auth-dialog'));
    }

    if (pageMode === 'practice-menu') {
        return Boolean(getElement('practice-menu') && getElement('auth-dialog'));
    }

    if (pageMode === 'exams') {
        return Boolean(getElement('tests-home-view') && getElement('auth-dialog'));
    }

    if (pageMode === 'quiz') {
        return Boolean(
            getElement('quiz-gate')
            && getElement('quiz-box')
            && getElement('quiz-result-box')
            && getElement('quiz-reset-attempt')
            && getElement('lookup-popup')
            && getElement('auth-dialog')
        );
    }

    return Boolean(
        getElement('quiz-box')
        && getElement('result-box')
        && getElement('lookup-popup')
        && getElement('auth-dialog')
    );
}

function showHome() {
    clearPendingWordRender();
    hideLookupPopup();
    setHomeVisible(true);
    setQuizVisible(false);
    setResultVisible(false);
}

function resetHomeShellState() {
    homePopupController.reset();

    const headerCopy = getElement('header-copy');
    if (headerCopy) {
        headerCopy.hidden = true;
    }
}

function showReviewView() {
    setHomeVisible(false);
    setQuizVisible(true);
    setResultVisible(false);
}

function renderCurrentReviewList() {
    renderReviewList(reviewedWords, dailyWords, currentIndex, jumpToWord);
}

document.addEventListener('pte:review-filter-change', renderCurrentReviewList);

function calculateScore(correctCount, totalCount) {
    return totalCount > 0 ? Math.round((correctCount * 100) / totalCount) : 0;
}

function getReviewedAnswers() {
    return dailyWords.map((word, index) => {
        const reviewedWord = reviewedWords.find((item) => item.index === index);
        return {
            id: word.id,
            w: word.w,
            pos: word.pos || '',
            m: word.m || '',
            e: word.e || '',
            isRight: Boolean(reviewedWord && reviewedWord.isRight),
        };
    });
}

function setQuizGateVisible(visible, message = '') {
    setHidden('quiz-gate', !visible);
    const messageElement = getElement('quiz-gate-message');
    if (messageElement && message) {
        messageElement.innerText = message;
    }
}

function setQuizExamVisible(visible) {
    setHidden('quiz-box', !visible);
}

function setQuizResultVisible(visible) {
    setHidden('quiz-result-box', !visible);
}

function setQuizHeader() {
    const headerCopy = getElement('header-copy');
    if (headerCopy) {
        headerCopy.hidden = false;
    }

    const headerTitle = document.querySelector('#header-copy h1');
    if (headerTitle) {
        headerTitle.innerText = 'PTE vocabulary exam';
    }

    const dateBadge = getElement('today-date');
    if (dateBadge) {
        dateBadge.innerText = quizDateString || getDateStringWithOffset(0);
    }

    const deckSwitcher = document.querySelector('.deck-switcher');
    if (deckSwitcher) {
        deckSwitcher.hidden = true;
    }

    const hintText = document.querySelector('.hint-text');
    if (hintText) {
        hintText.innerText = 'Tap the card to check the answer, then mark the question correct or wrong.';
    }
}

function setExamHeader() {
    const headerCopy = getElement('header-copy');
    if (headerCopy) {
        headerCopy.hidden = false;
    }

    const headerTitle = document.querySelector('#header-copy h1');
    if (headerTitle) {
        headerTitle.innerText = 'PTE cloze exam';
    }

    const dateBadge = getElement('today-date');
    if (dateBadge) {
        dateBadge.innerText = getDateStringWithOffset(0);
    }

    const deckSwitcher = document.querySelector('.deck-switcher');
    if (deckSwitcher) {
        deckSwitcher.hidden = true;
    }

    const hintText = document.querySelector('.hint-text');
    if (hintText) {
        hintText.innerText = 'Choose the word that best completes the example sentence.';
    }
}

function setPracticeHeader() {
    const headerCopy = getElement('header-copy');
    if (headerCopy) {
        headerCopy.hidden = false;
    }

    const headerTitle = document.querySelector('#header-copy h1');
    if (headerTitle) {
        headerTitle.innerText = 'PTE vocabulary daily review';
    }

    const deckSwitcher = document.querySelector('.deck-switcher');
    if (deckSwitcher) {
        deckSwitcher.hidden = false;
    }

    const dateRow = document.querySelector('#header-copy .header-date-row');
    if (dateRow) {
        dateRow.hidden = false;
    }

    const hintText = document.querySelector('.hint-text');
    if (hintText) {
        hintText.innerText = 'Tap the card to check the answer, then mark whether you remembered it.';
    }
}

function setQuizResetStatus(message, isError = false) {
    const status = getElement('quiz-reset-status');
    if (!status) return;

    status.innerText = message;
    status.classList.toggle('quiz-reset-status-error', isError);
}

function updateQuizResetButton() {
    const resetButton = getElement('quiz-reset-attempt');
    if (!resetButton) return;

    const canReset = Boolean(quizAttemptsController.getUser()) && quizAttemptsController.isReady() && !quizIsResetting;
    resetButton.disabled = !canReset;
}

function setFavoriteStatus(message, isError = false) {
    const status = getElement('favorite-status');
    if (!status) return;

    status.innerText = message;
    status.classList.toggle('favorite-status-error', isError);
}

function setCollocationPracticeHeader() {
    const headerCopy = getElement('header-copy');
    if (headerCopy) {
        headerCopy.hidden = false;
    }

    const headerTitle = document.querySelector('#header-copy h1');
    if (headerTitle) {
        headerTitle.innerText = 'PTE collocation practice';
    }

    const dateRow = document.querySelector('#header-copy .header-date-row');
    if (dateRow) {
        dateRow.hidden = true;
    }

    const hintText = document.querySelector('.hint-text');
    if (hintText) {
        hintText.innerText = 'Each card is selected at random. Keep practicing for as long as you like.';
    }
}

function wirePracticeMenuLinks() {
    const isStandaloneMenu = getPageMode() === 'practice-menu';
    const vocabLink = getElement('open-vocab-practice');
    const collocationLink = getElement('open-colloca-practice');

    if (vocabLink) {
        vocabLink.href = isStandaloneMenu ? 'vocab_practice.html' : 'pages/vocab_practice.html';
    }

    if (collocationLink) {
        collocationLink.href = isStandaloneMenu ? 'colloca_practice.html' : 'pages/colloca_practice.html';
    }
}

function switchPracticeDeck(offset) {
    if (isPracticePopupOpen() && activePracticeMode === 'collocation') {
        return;
    }

    loadAndInitQuiz(offset).catch((error) => console.error('Failed to switch vocabulary deck.', error));
}

function setPracticePopupView(mode) {
    activePracticeMode = mode;
    const menu = getElement('practice-menu');
    const sessionView = getElement('practice-session-view');
    const headerCopy = getElement('header-copy');

    if (menu) menu.hidden = mode !== 'menu';
    if (sessionView) sessionView.hidden = mode === 'menu';
    if (headerCopy) headerCopy.hidden = mode === 'menu';
}

function clearPracticePopupSession() {
    activeLoadToken++;
    clearPendingWordRender();
    hideLookupPopup();
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    const sessionBody = getElement('practice-session-body');
    if (sessionBody) sessionBody.innerHTML = '';

    const popupBody = getElement('practice-popup-body');
    if (popupBody) delete popupBody.dataset.reviewWired;
    setPracticePopupView('menu');
    popupScrollbarController.refresh();
}

async function openVocabPracticeSession() {
    const popupBody = getElement('practice-popup-body');
    const sessionBody = getElement('practice-session-body');
    if (!popupBody || !sessionBody) return;

    clearPracticePopupSession();
    setPracticePopupView('vocab');
    moveHeaderCopyToPopup(popupBody);
    setPracticeHeader();

    sessionBody.innerHTML = '<p class="practice-session-loading" role="status">Loading vocabulary practice...</p>';
    try {
        const htmlParts = await fetchHtmlParts(PRACTICE_POPUP_PARTIALS);
        const reviewBody = document.createElement('div');
        reviewBody.id = 'practice-popup-review-body';
        reviewBody.innerHTML = htmlParts.join('\n');
        sessionBody.innerHTML = '';
        sessionBody.appendChild(reviewBody);
        wireReviewSessionEvents();
        await loadDeck(0);
        popupScrollbarController.refresh();
    } catch (error) {
        sessionBody.innerHTML = '<p class="practice-session-error" role="alert">Vocabulary practice could not be loaded. Please try again.</p>';
        throw error;
    }
}

async function openCollocationPracticeSession() {
    const popupBody = getElement('practice-popup-body');
    const sessionBody = getElement('practice-session-body');
    if (!popupBody || !sessionBody) return;

    clearPracticePopupSession();
    setPracticePopupView('collocation');
    moveHeaderCopyToPopup(popupBody);
    setCollocationPracticeHeader();
    sessionBody.innerHTML = await fetchHtmlPartial(COLLOCA_PRACTICE_PARTIAL, 'Failed to load collocation practice.');

    const collocationModule = await import('./colloca_practice.js');
    await collocationModule.boot(sessionBody);
    popupScrollbarController.refresh();
}

function wirePracticeMenuEvents() {
    const popupBody = getElement('practice-popup-body');
    if (!popupBody || popupBody.dataset.practiceMenuWired === 'true') return;
    popupBody.dataset.practiceMenuWired = 'true';

    getElement('open-vocab-practice')?.addEventListener('click', (event) => {
        event.preventDefault();
        openVocabPracticeSession().catch((error) => console.error('Failed to open vocabulary practice.', error));
    });
    getElement('open-colloca-practice')?.addEventListener('click', (event) => {
        event.preventDefault();
        openCollocationPracticeSession().catch((error) => console.error('Failed to open collocation practice.', error));
    });
    getElement('practice-back')?.addEventListener('click', clearPracticePopupSession);
}

function syncFavoriteButtonVisibility(wordCard = getElement('word-card')) {
    const favoriteButton = getElement('favorite-toggle');
    if (!favoriteButton) return;

    const current = dailyWords[currentIndex];
    const isFlipped = Boolean(wordCard?.classList.contains('flipped'));
    favoriteButton.hidden = !favoritesController.getUser() || !current || isFlipped;

    if (favoriteButton.hidden && document.activeElement === favoriteButton && wordCard) {
        wordCard.focus();
    }
}

function setCardFlipped(wordCard, isFlipped) {
    if (!wordCard) return;

    wordCard.classList.toggle('flipped', isFlipped);
    syncFavoriteButtonVisibility(wordCard);
}

function toggleCardFlipped(wordCard) {
    if (!wordCard) return;

    setCardFlipped(wordCard, !wordCard.classList.contains('flipped'));
}

function updateFavoriteButton() {
    const favoriteButton = getElement('favorite-toggle');
    if (!favoriteButton) return;

    const current = dailyWords[currentIndex];
    const isSignedIn = Boolean(favoritesController.getUser());
    syncFavoriteButtonVisibility();
    if (!isSignedIn || !current) {
        favoriteButton.classList.remove('active');
        return;
    }

    const isFavorite = favoritesController.hasFavorite(current);
    favoriteButton.innerHTML = isFavorite
        ? '<svg class="favorite-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 17.3 6.2 20.8l1.6-6.6L2.7 9.7l6.8-.6L12 3l2.5 6.1 6.8.6-5.1 4.5 1.6 6.6z" fill="currentColor"></path></svg><span class="visually-hidden">Remove from favorites</span>'
        : '<svg class="favorite-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 17.3 6.2 20.8l1.6-6.6L2.7 9.7l6.8-.6L12 3l2.5 6.1 6.8.6-5.1 4.5 1.6 6.6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path></svg><span class="visually-hidden">Add to favorites</span>';
    favoriteButton.classList.toggle('active', isFavorite);
    favoriteButton.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Add to favorites');
    favoriteButton.setAttribute('aria-pressed', String(isFavorite));
    syncFavoriteButtonVisibility();
}

function renderFavoritesPage() {
    const pageMode = getPageMode();
    if (pageMode !== 'favorites' && !isFavoritesPopupOpen()) return;
    if (!getElement('favorites-screen')) return;

    renderFavoritesScreen({
        user: favoritesController.getUser(),
        favorites: favoritesController.getFavorites(),
        onRemoveFavorite: (favorite) => favoritesController.removeFavorite(favorite),
    });
}

function recomputeScore() {
    score = reviewedWords.reduce((count, reviewedWord) => (
        reviewedWord.isRight ? count + 1 : count
    ), 0);
}

function createDeckSession(dailyWordsForDeck) {
    return {
        dailyWords: dailyWordsForDeck,
        currentIndex: 0,
        score: 0,
        reviewedWords: [],
    };
}

function persistActiveSession() {
    if (!activeSession || activeRuntimeMode !== 'practice') return;

    recomputeScore();
    activeSession.dailyWords = dailyWords;
    activeSession.currentIndex = currentIndex;
    activeSession.score = score;
    activeSession.reviewedWords = reviewedWords;
}

function activateSession(session, deckKey, deckOffset) {
    activeSession = session;
    activeRuntimeMode = 'practice';
    activeDeckKey = deckKey;
    activeDeckOffset = deckOffset;
    activeDeckDateString = deckKey;
    dailyWords = session.dailyWords;
    currentIndex = session.currentIndex;
    reviewedWords = session.reviewedWords;
    score = session.score;
    recomputeScore();
    session.score = score;
}

function updateDeckSwitcher() {
    const buttons = document.querySelectorAll('.deck-switch-button');
    buttons.forEach((button) => {
        const offset = Number(button.dataset.offset);
        const isActive = offset === activeDeckOffset;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

function updateDeckLabels() {
    const dateBadge = document.getElementById('today-date');
    if (dateBadge) {
        dateBadge.innerText = activeDeckDateString;
    }

    const resultNote = document.getElementById('result-note');
    if (resultNote) {
        resultNote.innerText = `You are reviewing ${activeDeckDateString}.`;
    }
}

function clearPendingWordRender() {
    if (pendingWordRenderTimer !== null) {
        clearTimeout(pendingWordRenderTimer);
        pendingWordRenderTimer = null;
    }
}

function showWord() {
    if (currentIndex >= dailyWords.length) {
        showResult();
        return;
    }

    const wordCard = getElement('word-card');
    const wordTarget = getElement('word-target');
    const wordExample = getElement('word-example');
    const wordMeaning = getElement('word-meaning');
    if (!wordCard || !wordTarget || !wordExample || !wordMeaning) {
        return;
    }

    showReviewView();
    hideLookupPopup();
    setCardFlipped(wordCard, false);
    clearPendingWordRender();
    setFavoriteStatus('');

    const current = dailyWords[currentIndex];
    wordTarget.innerText = current.w;

    const wordPos = getElement('word-pos');
    if (wordPos) {
        wordPos.innerText = current.pos ? `(${current.pos})` : '';
    }

    wordMeaning.innerText = current.m;
    lookupController.renderExampleText(wordExample, current.e);
    renderTermList(getElement('word-family'), current.wordFamily);
    renderTermList(getElement('word-collocations'), current.collocations);

    getElement('card-index').innerText = `Card: ${currentIndex + 1} / ${dailyWords.length}`;
    getElement('score-count').innerText = `Correct: ${score}`;
    getElement('progress').style.width = `${(currentIndex / dailyWords.length) * 100}%`;
    renderCurrentReviewList();
    updateFavoriteButton();
    speechController.updateSpeakButton();
    cardScrollbarController.refresh();
}

function markCurrentWordReviewed(isRight) {
    const reviewedWord = reviewedWords.find((word) => word.index === currentIndex);
    if (reviewedWord) {
        reviewedWord.isRight = isRight;
        return;
    }

    reviewedWords.push({
        index: currentIndex,
        isRight,
    });
}

function nextWord(isRight) {
    markCurrentWordReviewed(isRight);
    recomputeScore();
    currentIndex++;
    persistActiveSession();
    showWord();
}

function jumpToWord(wordIndex) {
    currentIndex = wordIndex;
    persistActiveSession();
    showWord();
}

function showResult() {
    hideLookupPopup();
    clearPendingWordRender();
    renderCurrentReviewList();
    setHomeVisible(false);
    setHidden('quiz-box', true);
    setHidden('review-list-section', false);
    setHidden('header-copy', false);
    setResultVisible(true);

    recomputeScore();
    updateDeckLabels();
}

function renderQuizResult(attempt) {
    if (!attempt) return;

    setQuizGateVisible(false);
    setQuizExamVisible(false);
    setQuizResultVisible(true);
    setQuizHeader();
    hideLookupPopup();
    clearPendingWordRender();

    renderQuizResultScreen(attempt, {
        renderExampleText: lookupController.renderExampleText,
    });
    updateQuizResetButton();
}

function showQuizWord() {
    if (currentIndex >= dailyWords.length) {
        submitQuizAttempt();
        return;
    }

    const wordCard = getElement('word-card');
    const wordTarget = getElement('word-target');
    const wordExample = getElement('word-example');
    const wordMeaning = getElement('word-meaning');
    if (!wordCard || !wordTarget || !wordExample || !wordMeaning) {
        return;
    }

    setQuizGateVisible(false);
    setQuizExamVisible(true);
    setQuizResultVisible(false);
    setQuizHeader();
    hideLookupPopup();
    setCardFlipped(wordCard, false);
    clearPendingWordRender();

    const current = dailyWords[currentIndex];
    wordTarget.innerText = current.w;

    const wordPos = getElement('word-pos');
    if (wordPos) {
        wordPos.innerText = current.pos ? `(${current.pos})` : '';
    }

    wordMeaning.innerText = current.m;
    lookupController.renderExampleText(wordExample, current.e);

    getElement('card-index').innerText = `Question: ${currentIndex + 1} / ${dailyWords.length}`;
    getElement('score-count').innerText = `Correct: ${score}`;
    getElement('progress').style.width = `${(currentIndex / dailyWords.length) * 100}%`;
    speechController.updateSpeakButton();
    updateQuizResetButton();
    cardScrollbarController.refresh();
}

async function submitQuizAttempt() {
    if (quizIsSaving || quizAttemptsController.getAttempt()) {
        renderQuizResult(quizAttemptsController.getAttempt());
        return;
    }

    quizIsSaving = true;
    recomputeScore();
    const answers = getReviewedAnswers();
    const attempt = {
        date: quizDateString,
        totalCount: dailyWords.length,
        correctCount: score,
        score: calculateScore(score, dailyWords.length),
        answers,
    };

    setQuizGateVisible(true, 'Saving vocabulary exam result...');
    setQuizExamVisible(false);
    setQuizResultVisible(false);

    try {
        const savedAttempt = await quizAttemptsController.saveAttempt(attempt);
        renderQuizResult(savedAttempt);
    } catch (error) {
        console.error('Failed to save vocabulary exam attempt.', error);
        setQuizGateVisible(true, 'Could not save your vocabulary exam result. Please check Firebase permissions and try again.');
    } finally {
        quizIsSaving = false;
    }
}

function nextQuizWord(isRight) {
    if (quizAttemptsController.getAttempt() || quizIsSaving) return;

    markCurrentWordReviewed(isRight);
    recomputeScore();
    currentIndex++;
    showQuizWord();
}

async function loadQuizDeck() {
    if (!isQuizContextActive()) return;

    if (quizIsLoading) return;
    quizIsLoading = true;
    const loadToken = ++activeLoadToken;
    activeRuntimeMode = 'quiz';
    clearPendingWordRender();
    quizDateString = getDateStringWithOffset(0);
    activeDeckKey = quizDateString;
    activeDeckDateString = quizDateString;
    setQuizHeader();

    try {
        const response = await fetch(VOCAB_SOURCE);
        if (!response.ok) throw new Error('Failed to load vocabulary JSON.');
        const vocabData = await response.json();
        const allVocab = normalizeVocabItems(vocabData);
        vocabMeaningMap = buildVocabMeaningMap(allVocab);

        if (loadToken !== activeLoadToken) return;
        if (!isQuizContextActive()) return;

        dailyWords = pickDailyWords(allVocab, quizDateString, getDailyWordCount());
        currentIndex = 0;
        score = 0;
        reviewedWords = [];
        speechController.retryLoadVoices();
        showQuizWord();
    } catch (error) {
        if (loadToken !== activeLoadToken) return;
        if (!isQuizContextActive()) return;
        setQuizGateVisible(true, 'Please confirm the vocabulary JSON can be loaded.');
        setQuizExamVisible(false);
        setQuizResultVisible(false);
        console.error(error);
    } finally {
        if (loadToken === activeLoadToken) {
            quizIsLoading = false;
        }
    }
}

function renderQuizPageState() {
    if (!isQuizContextActive()) return;
    if (!getElement('quiz-gate')) return;

    setQuizHeader();
    updateQuizResetButton();

    if (!quizAttemptsController.isReady()) {
        setQuizGateVisible(true, 'Loading today vocabulary exam...');
        setQuizExamVisible(false);
        setQuizResultVisible(false);
        return;
    }

    if (!quizAttemptsController.getUser()) {
        dailyWords = [];
        currentIndex = 0;
        score = 0;
        reviewedWords = [];
        setQuizGateVisible(true, 'Please sign in to start today vocabulary exam.');
        setQuizExamVisible(false);
        setQuizResultVisible(false);
        setQuizResetStatus('');
        updateQuizResetButton();
        return;
    }

    const attempt = quizAttemptsController.getAttempt();
    if (attempt) {
        renderQuizResult(attempt);
        return;
    }

    if (dailyWords.length === 0 && !quizIsSaving && !quizIsLoading) {
        loadQuizDeck();
        return;
    }

    if (dailyWords.length > 0 && !quizIsSaving && !quizIsLoading) {
        showQuizWord();
    }
}

async function resetTodayQuizAttempt() {
    if (quizIsResetting) return;

    if (!quizAttemptsController.getUser()) {
        setQuizResetStatus('Please sign in before resetting today vocabulary exam.', true);
        updateQuizResetButton();
        return;
    }

    quizIsResetting = true;
    updateQuizResetButton();
    setQuizResetStatus('Resetting today vocabulary exam...');

    activeLoadToken++;
    dailyWords = [];
    currentIndex = 0;
    score = 0;
    reviewedWords = [];
    quizIsSaving = false;
    quizIsLoading = false;

    try {
        await quizAttemptsController.resetAttempt(quizDateString || getDateStringWithOffset(0));
        setQuizResetStatus('Today vocabulary exam has been reset.');
        setQuizGateVisible(true, 'Loading today vocabulary exam...');
        setQuizExamVisible(false);
        setQuizResultVisible(false);
        renderQuizPageState();
    } catch (error) {
        console.error('Failed to reset quiz attempt.', error);
        setQuizResetStatus('Reset failed. Please check Firebase permissions.', true);
    } finally {
        quizIsResetting = false;
        updateQuizResetButton();
    }
}

function restartActiveDeck() {
    if (!activeSession) return;

    activeSession.dailyWords = shuffleWords(activeSession.dailyWords);
    activeSession.currentIndex = 0;
    activeSession.score = 0;
    activeSession.reviewedWords = [];
    activateSession(activeSession, activeDeckKey, activeDeckOffset);
    showReviewView();
    updateDeckSwitcher();
    updateDeckLabels();
    clearPendingWordRender();
    renderCurrentReviewList();
    showWord();
}

function wireCardFlipEvents() {
    const wordCard = getElement('word-card');
    if (!wordCard) return;

    wordCard.addEventListener('click', () => {
        toggleCardFlipped(wordCard);
    });

    wordCard.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleCardFlipped(wordCard);
        }
    });
}

async function handleFavoriteToggleClick(event) {
    event.stopPropagation();

    const favoriteButton = event.currentTarget;
    const wordCard = getElement('word-card');
    const current = dailyWords[currentIndex];
    if (
        !current
        || favoriteButton.hidden
        || favoriteButton.disabled
        || wordCard?.classList.contains('flipped')
    ) {
        return;
    }

    favoriteButton.disabled = true;
    try {
        const isFavorite = await favoritesController.toggleFavorite(current);
        setFavoriteStatus(isFavorite ? 'Added to favorites.' : 'Removed from favorites.');
    } catch (error) {
        setFavoriteStatus('Favorite update failed. Please check Firebase permissions.', true);
        console.error('Failed to update favorite.', error);
    } finally {
        favoriteButton.disabled = false;
        updateFavoriteButton();
    }
}

function wireSharedCardEvents() {
    const speakButton = getElement('speak-word');
    const voiceSelect = getElement('voice-select');

    if (speakButton) {
        speakButton.addEventListener('click', speechController.speakCurrentWord);
    }

    if (voiceSelect) {
        voiceSelect.addEventListener('change', (event) => speechController.setSelectedVoice(event.target.value, event));
        voiceSelect.addEventListener('click', (event) => event.stopPropagation());
    }

    document.addEventListener('click', (event) => {
        const popup = getElement('lookup-popup');
        if (
            popup
            && !popup.hidden
            && !popup.contains(event.target)
            && !event.target.closest('.example-word')
        ) {
            hideLookupPopup();
        }
    });

    if (canSpeak()) {
        window.speechSynthesis.onvoiceschanged = speechController.retryLoadVoices;
    }
}

function isPracticePopupOpen() {
    return homePopupController.isModeOpen('practice');
}

function isQuizPopupOpen() {
    return homePopupController.isModeOpen('tests') && examsController.getMode() === 'vocab-exam';
}

function isFavoritesPopupOpen() {
    return homePopupController.isModeOpen('favorites');
}

function isExamPopupOpen() {
    return homePopupController.isModeOpen('tests') && examsController.getMode() === 'cloze-exam';
}

function isHomePopupOpen() {
    return homePopupController.isAnyOpen();
}

function isReviewContextActive() {
    return getPageMode() === 'review' || isPracticePopupOpen();
}

function isQuizContextActive() {
    return getPageMode() === 'quiz' || isQuizPopupOpen();
}

function wireReviewSessionEvents() {
    const popupBody = getElement('practice-popup-body');
    if (!popupBody || popupBody.dataset.reviewWired === 'true') return;

    popupBody.dataset.reviewWired = 'true';
    wireCardFlipEvents();
    wireSharedCardEvents();

    getElement('mark-wrong').addEventListener('click', () => nextWord(false));
    getElement('mark-right').addEventListener('click', () => nextWord(true));
    getElement('deck-today').addEventListener('click', () => switchPracticeDeck(0));
    getElement('deck-yesterday').addEventListener('click', () => switchPracticeDeck(-1));
    getElement('review-again').addEventListener('click', restartActiveDeck);
    getElement('favorite-toggle').addEventListener('click', handleFavoriteToggleClick);
}

function cancelPopupWork(mode) {
    if (mode === 'practice' || mode === 'tests') {
        activeLoadToken++;
        hideLookupPopup();
        clearPendingWordRender();
    }

    optionalPopupLifecycles.get(mode)?.cancel?.();
}

function unloadPopupContent(mode) {
    if (mode === 'practice') {
        unloadPracticePopupContent();
    }

    if (mode === 'tests') {
        unloadTestsSessionContent();
    }

    optionalPopupLifecycles.get(mode)?.unload?.();
}

function closeSettingPopup() {
    homePopupController.close('setting');
}

function closePracticePopup() {
    homePopupController.close('practice');
}

function closeQuizPopup() {
    closeTestsPopup();
}

function closeFavoritesPopup() {
    homePopupController.close('favorites');
}

function closeExamPopup() {
    closeTestsPopup();
}

function closeTestsPopup() {
    homePopupController.close('tests');
    window.setTimeout(() => {
        if (!homePopupController.isModeOpen('tests')) {
            examsController.showHome({
                unloadSession: true,
                onUnloadSession: unloadTestsSessionContent,
            });
        }
    }, 180);
}

function removePopupContent(contentId, popupBodyId, loadedDatasetKey = 'loaded') {
    const content = getElement(contentId);
    if (content) {
        content.remove();
    }

    const popupBody = getElement(popupBodyId);
    if (popupBody) {
        delete popupBody.dataset[loadedDatasetKey];
    }
}

function unloadPracticePopupContent() {
    removePopupContent('practice-popup-review-body', 'practice-popup-body');
    removePopupContent('practice-popup-menu-body', 'practice-popup-body');
    const popupBody = getElement('practice-popup-body');
    if (popupBody) {
        delete popupBody.dataset.reviewWired;
        delete popupBody.dataset.practiceMenuWired;
    }
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    activePracticeMode = 'menu';
}

function unloadQuizPopupContent() {
    removePopupContent('quiz-popup-content', 'quiz-popup-body');
    const popupBody = getElement('quiz-popup-body');
    if (popupBody) {
        delete popupBody.dataset.quizWired;
    }
}

function unloadExamPopupContent() {
    if (window.PteExamApp && typeof window.PteExamApp.dispose === 'function') {
        window.PteExamApp.dispose();
    }

    removePopupContent('exam-popup-content', 'exam-popup-body');
}

function unloadTestsSessionContent() {
    if (examsController.getMode() === 'cloze-exam') {
        unloadExamPopupContent();
    }

    removePopupContent('quiz-popup-content', 'tests-session-body');
    removePopupContent('exam-popup-content', 'tests-session-body');
    removePopupContent('exam-history-screen', 'tests-session-body');

    const sessionBody = getElement('tests-session-body');
    if (sessionBody) {
        delete sessionBody.dataset.quizWired;
        delete sessionBody.dataset.loaded;
    }

    if (examsController.getMode() !== 'cloze-exam' && window.PteExamApp && typeof window.PteExamApp.dispose === 'function') {
        window.PteExamApp.dispose();
    }
}

function moveHeaderCopyToPopup(popupBody) {
    const headerCopy = getElement('header-copy');
    if (!headerCopy || !popupBody || popupBody.contains(headerCopy)) return;

    popupBody.prepend(headerCopy);

    const homeLink = headerCopy.querySelector('.header-home-link');
    if (homeLink) {
        homeLink.remove();
    }
}

async function ensurePracticePopupLoaded() {
    const popupBody = getElement('practice-popup-body');
    if (!popupBody) return false;

    if (popupBody.dataset.loaded !== 'true') {
        const menuBody = document.createElement('div');
        menuBody.id = 'practice-popup-menu-body';
        menuBody.innerHTML = await fetchHtmlPartial(PRACTICE_MENU_PARTIAL, 'Failed to load practice menu.');
        popupBody.appendChild(menuBody);
        popupBody.dataset.loaded = 'true';
    }
    wirePracticeMenuLinks();
    wirePracticeMenuEvents();
    setPracticePopupView('menu');
    return true;
}

function wireQuizSessionEvents() {
    const popupBody = examsController.getSessionBody();
    if (!popupBody || popupBody.dataset.quizWired === 'true') return;

    popupBody.dataset.quizWired = 'true';
    wireCardFlipEvents();
    wireSharedCardEvents();
    getElement('mark-wrong').addEventListener('click', () => nextQuizWord(false));
    getElement('mark-right').addEventListener('click', () => nextQuizWord(true));
    getElement('quiz-reset-attempt').addEventListener('click', resetTodayQuizAttempt);
}

async function ensureQuizPopupLoaded() {
    const popupBody = examsController.getSessionBody();
    if (!popupBody) return false;

    moveHeaderCopyToPopup(examsController.getPopupBody());

    if (popupBody.dataset.loaded !== 'true') {
        const htmlParts = await fetchHtmlParts(VOCAB_EXAM_POPUP_PARTIALS);
        const quizBody = document.createElement('div');
        quizBody.id = 'quiz-popup-content';
        quizBody.innerHTML = htmlParts.join('\n');
        popupBody.appendChild(quizBody);
        popupBody.dataset.loaded = 'true';
    }

    setQuizHeader();
    wireQuizSessionEvents();
    return true;
}

async function ensureFavoritesPopupLoaded() {
    const popupBody = getElement('favorites-popup-body');
    if (!popupBody) return false;

    if (popupBody.dataset.loaded !== 'true') {
        popupBody.innerHTML = await fetchHtmlPartial(FAVORITES_PARTIAL, 'Failed to load favorites popup.');
        popupBody.dataset.loaded = 'true';

        const backLink = popupBody.querySelector('.favorites-back-link');
        if (backLink) {
            backLink.remove();
        }
    }

    renderFavoritesPage();
    return true;
}

async function ensureExamPopupLoaded() {
    const popupBody = examsController.getSessionBody();
    if (!popupBody) return false;

    moveHeaderCopyToPopup(examsController.getPopupBody());
    setExamHeader();

    if (popupBody.dataset.loaded !== 'true') {
        const examBody = document.createElement('div');
        examBody.id = 'exam-popup-content';
        examBody.innerHTML = await fetchHtmlPartial(CLOZE_EXAM_PARTIAL, 'Failed to load cloze exam popup.');
        popupBody.appendChild(examBody);
        popupBody.dataset.loaded = 'true';
    }

    const examModule = await import('./cloze-exam.js');
    await examModule.boot();
    return true;
}

async function openPracticePopup() {
    const popup = getElement('practice-popup');
    const closeButton = getElement('practice-popup-close');
    if (!popup) return;

    try {
        homePopupController.prepareExclusive('practice');
        const loaded = await ensurePracticePopupLoaded();
        if (!loaded) return;

        homePopupController.show('practice');
        if (closeButton) {
            closeButton.focus();
        }
        popupScrollbarController.refresh();
    } catch (error) {
        console.error('Failed to open practice popup.', error);
        window.location.href = 'pages/practice.html';
    }
}

async function ensureTestsPopupLoaded() {
    const popupBody = examsController.getPopupBody();
    if (!popupBody) return false;

    if (popupBody.dataset.loaded !== 'true') {
        popupBody.innerHTML = await fetchHtmlPartial(EXAMS_PARTIAL, 'Failed to load exams popup.');
        popupBody.dataset.loaded = 'true';
    }

    examsController.wireEvents({
        onOpenVocabExam: openQuizPopup,
        onOpenClozeExam: openExamPopup,
        onOpenHistory: openExamHistoryPopup,
        onBack: () => {
            examsController.showHome({
                unloadSession: true,
                onUnloadSession: unloadTestsSessionContent,
            });
        },
    });

    return true;
}

async function ensureExamHistoryLoaded() {
    const sessionBody = examsController.getSessionBody();
    if (!sessionBody) return false;

    if (!getElement('exam-history-screen')) {
        sessionBody.innerHTML = await fetchHtmlPartial(EXAM_HISTORY_PARTIAL, 'Failed to load exam history.');
    }

    await examHistoryController.init();
    renderExamHistory(examHistoryController.getState());
    await examHistoryController.refresh();
    popupScrollbarController.refresh();
    return true;
}

async function openExamHistoryPopup() {
    try {
        await examsController.transitionView('exam-history', () => {
            unloadTestsSessionContent();
            examsController.setView('exam-history');
        });
        await ensureExamHistoryLoaded();
    } catch (error) {
        console.error('Failed to open exam history.', error);
    }
}

async function openTestsPopup() {
    const popup = getElement('tests-popup');
    const closeButton = getElement('tests-popup-close');
    if (!popup) return;

    try {
        homePopupController.prepareExclusive('tests');
        const loaded = await ensureTestsPopupLoaded();
        if (!loaded) return;

        examsController.showHome({
            unloadSession: true,
            onUnloadSession: unloadTestsSessionContent,
        });
        homePopupController.show('tests');
        if (closeButton) {
            closeButton.focus();
        }
        popupScrollbarController.refresh();
    } catch (error) {
        console.error('Failed to open exams popup.', error);
        window.location.href = 'pages/vocab-exam.html';
    }
}

async function openQuizPopup() {
    const popup = getElement('tests-popup');
    if (!popup) {
        window.location.href = 'pages/vocab-exam.html';
        return;
    }

    try {
        if (!homePopupController.isModeOpen('tests')) {
            homePopupController.prepareExclusive('tests');
            await ensureTestsPopupLoaded();
            homePopupController.show('tests');
        }

        await examsController.transitionView('vocab-exam', () => {
            unloadTestsSessionContent();
            examsController.setView('vocab-exam');
        });
        persistActiveSession();
        activeRuntimeMode = 'quiz';
        dailyWords = [];
        currentIndex = 0;
        score = 0;
        reviewedWords = [];
        quizIsSaving = false;
        quizIsLoading = false;
        const loaded = await ensureQuizPopupLoaded();
        if (!loaded) return;

        quizDateString = getDateStringWithOffset(0);
        setQuizHeader();
        await quizAttemptsController.init(quizDateString);
        renderQuizPageState();
        popupScrollbarController.refresh();
    } catch (error) {
        console.error('Failed to open quiz popup.', error);
        window.location.href = 'pages/vocab-exam.html';
    }
}

async function openFavoritesPopup() {
    const popup = getElement('favorites-popup');
    const closeButton = getElement('favorites-popup-close');
    if (!popup) return;

    try {
        homePopupController.prepareExclusive('favorites');
        const loaded = await ensureFavoritesPopupLoaded();
        if (!loaded) return;

        homePopupController.show('favorites');
        renderFavoritesPage();
        if (closeButton) {
            closeButton.focus();
        }
        popupScrollbarController.refresh();
    } catch (error) {
        console.error('Failed to open favorites popup.', error);
        window.location.href = 'pages/favorites.html';
    }
}

async function openExamPopup() {
    const popup = getElement('tests-popup');
    if (!popup) {
        window.location.href = 'pages/cloze-exam.html';
        return;
    }

    try {
        if (!homePopupController.isModeOpen('tests')) {
            homePopupController.prepareExclusive('tests');
            await ensureTestsPopupLoaded();
            homePopupController.show('tests');
        }

        await examsController.transitionView('cloze-exam', () => {
            unloadTestsSessionContent();
            examsController.setView('cloze-exam');
        });
        const loaded = await ensureExamPopupLoaded();
        if (!loaded) return;

        popupScrollbarController.refresh();
    } catch (error) {
        console.error('Failed to open exam popup.', error);
        window.location.href = 'pages/cloze-exam.html';
    }
}

async function ensureSettingPopupLoaded() {
    const popupBody = getElement('setting-popup-body');
    if (!popupBody) return false;

    if (popupBody.dataset.loaded === 'true') {
        return true;
    }

    popupBody.innerHTML = await fetchHtmlPartial(SETTING_PARTIAL, 'Failed to load setting popup.');
    popupBody.dataset.loaded = 'true';

    const homeLink = popupBody.querySelector('.setting-home-link');
    if (homeLink) {
        homeLink.remove();
    }

    wireSettingEvents();
    return true;
}

async function openSettingPopup() {
    const popup = getElement('setting-popup');
    const closeButton = getElement('setting-popup-close');
    if (!popup) return;

    try {
        homePopupController.prepareExclusive('setting');
        const loaded = await ensureSettingPopupLoaded();
        if (!loaded) return;

        homePopupController.show('setting');
        if (closeButton) {
            closeButton.focus();
        }
        popupScrollbarController.refresh();
    } catch (error) {
        console.error('Failed to open setting popup.', error);
        window.location.href = 'pages/setting.html';
    }
}

function wireHomeEvents() {
    resetHomeShellState();

    syncHomeDailyWordCount();
    window.addEventListener('pte:daily-word-count-change', (event) => {
        syncHomeDailyWordCount(event.detail?.dailyWordCount);
    });

    const practiceTile = getElement('start-review');
    const testsTile = getElement('start-tests');
    const favoritesTile = getElement('start-favorites');
    const settingTile = getElement('start-setting');
    const settingPopup = getElement('setting-popup');
    const settingCloseButton = getElement('setting-popup-close');
    const practicePopup = getElement('practice-popup');
    const practiceCloseButton = getElement('practice-popup-close');
    const favoritesPopup = getElement('favorites-popup');
    const favoritesCloseButton = getElement('favorites-popup-close');
    const testsPopup = getElement('tests-popup');
    const testsCloseButton = getElement('tests-popup-close');

    if (practiceTile) {
        practiceTile.addEventListener('click', (event) => {
            event.preventDefault();
            openPracticePopup();
        });
    }

    if (testsTile) {
        testsTile.addEventListener('click', (event) => {
            event.preventDefault();
            openTestsPopup();
        });
    }

    if (favoritesTile) {
        favoritesTile.addEventListener('click', (event) => {
            event.preventDefault();
            openFavoritesPopup();
        });
    }

    if (settingTile) {
        settingTile.addEventListener('click', (event) => {
            event.preventDefault();
            openSettingPopup();
        });
    }

    if (settingCloseButton) {
        settingCloseButton.addEventListener('click', closeSettingPopup);
    }

    if (practiceCloseButton) {
        practiceCloseButton.addEventListener('click', closePracticePopup);
    }

    if (favoritesCloseButton) {
        favoritesCloseButton.addEventListener('click', closeFavoritesPopup);
    }

    if (testsCloseButton) {
        testsCloseButton.addEventListener('click', closeTestsPopup);
    }

    if (settingPopup) {
        settingPopup.addEventListener('click', (event) => {
            if (event.target === settingPopup) {
                closeSettingPopup();
            }
        });
    }

    if (practicePopup) {
        practicePopup.addEventListener('click', (event) => {
            if (event.target === practicePopup) {
                closePracticePopup();
            }
        });
    }

    if (favoritesPopup) {
        favoritesPopup.addEventListener('click', (event) => {
            if (event.target === favoritesPopup) {
                closeFavoritesPopup();
            }
        });
    }

    if (testsPopup) {
        testsPopup.addEventListener('click', (event) => {
            if (event.target === testsPopup) {
                closeTestsPopup();
            }
        });
    }

    popupScrollbarController.observe();
    cardScrollbarController.observe();
    popupScrollbarController.refresh();
    cardScrollbarController.refresh();

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeSettingPopup();
            closePracticePopup();
            closeFavoritesPopup();
            closeTestsPopup();
            optionalPopupLifecycles.forEach((_lifecycle, mode) => homePopupController.close(mode));
        }
    });
}

function wireExamsPageEvents() {
    examsController.wireEvents({
        onOpenVocabExam: () => {
            window.location.href = 'vocab-exam.html';
        },
        onOpenClozeExam: () => {
            window.location.href = 'cloze-exam.html';
        },
        onOpenHistory: openExamHistoryPopup,
    });
    examsController.setView('home');
}

function wireEvents() {
    const appRoot = getElement('app');
    if (!appRoot || wiredAppRoot === appRoot) {
        return;
    }
    wiredAppRoot = appRoot;

    const pageMode = getPageMode();
    if (pageMode === 'home') {
        wireHomeEvents();
        return;
    }

    if (pageMode === 'setting') {
        wireSettingEvents();
        return;
    }

    if (pageMode === 'exams') {
        wireExamsPageEvents();
        return;
    }

    if (pageMode !== 'review' && pageMode !== 'quiz') {
        return;
    }

    wireCardFlipEvents();
    wireSharedCardEvents();

    if (pageMode === 'quiz') {
        getElement('mark-wrong').addEventListener('click', () => nextQuizWord(false));
        getElement('mark-right').addEventListener('click', () => nextQuizWord(true));
        getElement('quiz-reset-attempt').addEventListener('click', resetTodayQuizAttempt);
        return;
    }

    getElement('mark-wrong').addEventListener('click', () => nextWord(false));
    getElement('mark-right').addEventListener('click', () => nextWord(true));
    getElement('deck-today').addEventListener('click', () => switchPracticeDeck(0));
    getElement('deck-yesterday').addEventListener('click', () => switchPracticeDeck(-1));
    getElement('review-again').addEventListener('click', restartActiveDeck);
    getElement('favorite-toggle').addEventListener('click', handleFavoriteToggleClick);
}

async function loadAndInitQuiz(deckOffset = 0) {
    await boot();
    return loadDeck(deckOffset);
}

async function loadDeck(deckOffset = 0) {
    if (!isReviewContextActive()) return;

    const loadToken = ++activeLoadToken;
    persistActiveSession();
    clearPendingWordRender();
    showReviewView();

    const deckKey = getDateStringWithOffset(deckOffset);
    activeDeckOffset = deckOffset;
    activeDeckDateString = deckKey;

    updateDeckSwitcher();
    updateDeckLabels();

    try {
        const response = await fetch(VOCAB_SOURCE);
        if (!response.ok) throw new Error('Failed to load vocabulary JSON.');
        const vocabData = await response.json();
        const allVocab = normalizeVocabItems(vocabData);
        vocabMeaningMap = buildVocabMeaningMap(allVocab);

        if (loadToken !== activeLoadToken) return;
        if (!isReviewContextActive()) return;

        let session = deckSessions.get(deckKey);
        if (!session) {
            session = createDeckSession(pickDailyWords(allVocab, deckKey, getDailyWordCount()));
            session.dailyWords = shuffleWords(session.dailyWords);
            deckSessions.set(deckKey, session);
        }

        activateSession(session, deckKey, deckOffset);
        clearPendingWordRender();
        speechController.retryLoadVoices();
        renderCurrentReviewList();
        showWord();
    } catch (error) {
        if (loadToken !== activeLoadToken) return;
        if (!isReviewContextActive()) return;
        const wordTarget = getElement('word-target');
        const wordExample = getElement('word-example');
        if (wordTarget) wordTarget.innerText = 'Error';
        if (wordExample) wordExample.innerText = 'Please confirm the vocabulary JSON can be loaded.';
        console.error(error);
    }
}

async function boot() {
    const pageMode = getPageMode();
    if (bootPromise && isAppShellMounted() && bootedPageMode === pageMode) return bootPromise;

    if (!isAppShellMounted()) {
        resetRuntimeState();
    }
    bootedPageMode = pageMode;

    bootPromise = (async () => {
        const functionPaths = pageMode === 'review'
            ? REVIEW_HTML_FUNCTIONS
            : pageMode === 'practice-menu'
                ? PRACTICE_HTML_FUNCTIONS
            : pageMode === 'quiz'
                ? VOCAB_EXAM_HTML_FUNCTIONS
                : pageMode === 'feature'
                    ? FEATURE_HTML_FUNCTIONS
                    : pageMode === 'setting'
                        ? SETTING_HTML_FUNCTIONS
                    : pageMode === 'favorites'
                        ? FAVORITES_HTML_FUNCTIONS
                    : pageMode === 'exams'
                        ? EXAMS_HTML_FUNCTIONS
                        : HOME_HTML_FUNCTIONS;

        await loadHtmlFunctions(functionPaths);
        if (pageMode === 'home') {
            await loadHomeOptionalPlugins();
        }
        if (pageMode === 'practice-menu') {
            wirePracticeMenuLinks();
        }
        await setupAuthUI();
        await favoritesController.init();
        renderFavoritesPage();
        if (pageMode === 'quiz') {
            quizDateString = getDateStringWithOffset(0);
            setQuizHeader();
            wireEvents();
            await quizAttemptsController.init(quizDateString);
            renderQuizPageState();
            return;
        }

        if (pageMode === 'setting') {
            wireEvents();
            return;
        }

        if (pageMode !== 'review') {
            wireEvents();
            return;
        }

        wireEvents();
        await loadDeck(0);
    })();

    return bootPromise;
}

window.PteVocabApp = {
    boot,
    loadAndInitQuiz,
    showHome,
    startReview: () => {
        if (getPageMode() === 'review') {
            return loadAndInitQuiz(0);
        }

        return openPracticePopup();
    },
    lookupExampleWordMeaning: lookupController.lookupExampleWordMeaning,
    speakCurrentWord: speechController.speakCurrentWord,
    nextWord,
    restartActiveDeck,
    getDailyWords: () => dailyWords,
    getCurrentIndex: () => currentIndex,
    getActiveDeckOffset: () => activeDeckOffset,
    getActiveDeckDateString: () => activeDeckDateString,
    getActiveDeckKey: () => activeDeckKey,
    getFavorites: favoritesController.getFavorites,
    getQuizAttempt: quizAttemptsController.getAttempt,
    dispose: () => {
        favoritesController.dispose();
        quizAttemptsController.dispose();
        examHistoryController.dispose();
        popupScrollbarController.dispose();
        cardScrollbarController.dispose();
        disposeOptionalPlugins();
    },
};

document.addEventListener('DOMContentLoaded', boot);

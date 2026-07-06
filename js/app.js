import {
    DAILY_WORD_COUNT,
    FAVORITES_HTML_FUNCTIONS,
    FEATURE_HTML_FUNCTIONS,
    HOME_HTML_FUNCTIONS,
    QUIZ_HTML_FUNCTIONS,
    REVIEW_HTML_FUNCTIONS,
    VOCAB_SOURCE,
} from './config.js';
import { getDateStringWithOffset } from './date-utils.js';
import { loadHtmlFunctions } from './html-functions.js';
import { setupAuthUI } from './auth.js';
import { createFavoritesController } from './favorites.js';
import { createLookupController, hideLookupPopup } from './lookup.js';
import { createQuizAttemptsController } from './quiz-attempts.js';
import { renderReviewList } from './review-list.js';
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

function getElement(id) {
    return document.getElementById(id);
}

function getPageMode() {
    const appRoot = getElement('app');
    const pageMode = appRoot && appRoot.dataset ? appRoot.dataset.page : '';

    if (pageMode === 'review' || pageMode === 'feature' || pageMode === 'favorites' || pageMode === 'quiz') {
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

function setHomeVisible(visible) {
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
    activeSession = null;
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
    activeLoadToken++;
    clearPendingWordRender();
    hideLookupPopup();
    wiredAppRoot = null;
    deckSessions.clear();
}

function isAppShellMounted() {
    const pageMode = getPageMode();

    if (pageMode === 'home') {
        return Boolean(getElement('home-screen') && getElement('start-review') && getElement('start-practice'));
    }

    if (pageMode === 'feature') {
        return Boolean(getElement('feature-screen') && getElement('auth-dialog'));
    }

    if (pageMode === 'favorites') {
        return Boolean(getElement('favorites-screen') && getElement('auth-dialog'));
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

function showReviewView() {
    setHomeVisible(false);
    setQuizVisible(true);
    setResultVisible(false);
}

function renderCurrentReviewList() {
    renderReviewList(reviewedWords, dailyWords, currentIndex, jumpToWord);
}

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
        headerTitle.innerText = 'PTE vocabulary daily quiz';
    }

    const dateBadge = getElement('today-date');
    if (dateBadge) {
        dateBadge.innerText = quizDateString || getDateStringWithOffset(0);
    }

    const deckSwitcher = document.querySelector('.deck-switcher');
    if (deckSwitcher) {
        deckSwitcher.remove();
    }

    const hintText = document.querySelector('.hint-text');
    if (hintText) {
        hintText.innerText = 'Tap the card to check the answer, then mark the question correct or wrong.';
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

function updateFavoriteButton() {
    const favoriteButton = getElement('favorite-toggle');
    if (!favoriteButton) return;

    const current = dailyWords[currentIndex];
    const isSignedIn = Boolean(favoritesController.getUser());
    favoriteButton.hidden = !isSignedIn || !current;
    if (!isSignedIn || !current) return;

    const isFavorite = favoritesController.hasFavorite(current);
    favoriteButton.innerHTML = isFavorite
        ? '<svg class="favorite-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 17.3 6.2 20.8l1.6-6.6L2.7 9.7l6.8-.6L12 3l2.5 6.1 6.8.6-5.1 4.5 1.6 6.6z" fill="currentColor"></path></svg><span class="visually-hidden">Remove from favorites</span>'
        : '<svg class="favorite-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 17.3 6.2 20.8l1.6-6.6L2.7 9.7l6.8-.6L12 3l2.5 6.1 6.8.6-5.1 4.5 1.6 6.6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path></svg><span class="visually-hidden">Add to favorites</span>';
    favoriteButton.classList.toggle('active', isFavorite);
    favoriteButton.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Add to favorites');
    favoriteButton.setAttribute('aria-pressed', String(isFavorite));
}

function renderFavoriteTermList(list, terms) {
    list.innerHTML = '';
    renderTermList(list, terms);
    if (list.children.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'favorite-term-empty';
        emptyItem.innerText = 'No entries';
        list.appendChild(emptyItem);
    }
}

function renderFavoritesPage() {
    const pageMode = getPageMode();
    if (pageMode !== 'favorites') return;

    const status = getElement('favorites-status');
    const list = getElement('favorites-list');
    if (!status || !list) return;

    const user = favoritesController.getUser();
    const favorites = favoritesController.getFavorites();
    list.innerHTML = '';

    if (!user) {
        status.innerText = 'Please sign in to view favorites.';
        return;
    }

    if (favorites.length === 0) {
        status.innerText = 'No favorite words yet.';
        return;
    }

    status.innerText = `${favorites.length} favorite word${favorites.length === 1 ? '' : 's'}.`;

    favorites.forEach((favorite) => {
        const item = document.createElement('li');
        item.className = 'favorite-item';

        const details = document.createElement('details');
        details.className = 'favorite-details-toggle';

        const summary = document.createElement('summary');
        summary.className = 'favorite-summary';

        const heading = document.createElement('div');
        heading.className = 'favorite-item-heading';

        const title = document.createElement('h2');
        title.innerText = favorite.w;

        const pos = document.createElement('span');
        pos.className = 'favorite-pos';
        pos.innerText = favorite.pos ? `(${favorite.pos})` : '';

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'favorite-remove';
        removeButton.innerText = 'Remove';
        removeButton.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            removeButton.disabled = true;
            try {
                await favoritesController.removeFavorite(favorite);
            } catch (error) {
                removeButton.disabled = false;
                console.error('Failed to remove favorite.', error);
            }
        });

        heading.append(title, pos, removeButton);

        const meaning = document.createElement('p');
        meaning.className = 'favorite-meaning';
        meaning.innerText = favorite.m || 'No meaning';

        summary.append(heading, meaning);

        const fullContent = document.createElement('div');
        fullContent.className = 'favorite-full-content';

        const example = document.createElement('p');
        example.className = 'favorite-example';
        example.innerText = favorite.e || 'No example';

        const familyTitle = document.createElement('h3');
        familyTitle.innerText = 'Word family';
        const familyList = document.createElement('ul');
        familyList.className = 'detail-list';
        renderFavoriteTermList(familyList, favorite.wordFamily);

        const collocationTitle = document.createElement('h3');
        collocationTitle.innerText = 'Collocations';
        const collocationList = document.createElement('ul');
        collocationList.className = 'detail-list';
        renderFavoriteTermList(collocationList, favorite.collocations);

        fullContent.append(example, familyTitle, familyList, collocationTitle, collocationList);
        details.append(summary, fullContent);
        item.append(details);
        list.appendChild(item);
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
    if (!activeSession) return;

    recomputeScore();
    activeSession.dailyWords = dailyWords;
    activeSession.currentIndex = currentIndex;
    activeSession.score = score;
    activeSession.reviewedWords = reviewedWords;
}

function activateSession(session, deckKey, deckOffset) {
    activeSession = session;
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
    wordCard.classList.remove('flipped');
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

function renderQuizAnalysisList(answers) {
    const list = getElement('quiz-analysis-list');
    if (!list) return;

    list.innerHTML = '';
    answers.forEach((answer, index) => {
        const item = document.createElement('li');
        item.className = answer.isRight ? 'quiz-analysis-item quiz-analysis-right' : 'quiz-analysis-item quiz-analysis-wrong';

        const heading = document.createElement('div');
        heading.className = 'quiz-analysis-heading';

        const word = document.createElement('strong');
        word.innerText = `${index + 1}. ${answer.w}`;

        const pos = document.createElement('span');
        pos.className = 'quiz-analysis-pos';
        pos.innerText = answer.pos ? `(${answer.pos})` : '';

        const result = document.createElement('span');
        result.className = 'quiz-analysis-result';
        result.innerText = answer.isRight ? 'Correct' : 'Wrong';

        heading.append(word, pos, result);

        const meaning = document.createElement('p');
        meaning.className = 'quiz-analysis-meaning';
        meaning.innerText = answer.m || 'No explanation';

        const example = document.createElement('p');
        example.className = 'example quiz-analysis-example';
        lookupController.renderExampleText(example, answer.e || 'No example');

        item.append(heading, meaning, example);
        list.appendChild(item);
    });
}

function renderQuizResult(attempt) {
    if (!attempt) return;

    setQuizGateVisible(false);
    setQuizExamVisible(false);
    setQuizResultVisible(true);
    setQuizHeader();
    hideLookupPopup();
    clearPendingWordRender();

    const scoreElement = getElement('quiz-score');
    if (scoreElement) {
        scoreElement.innerText = `${attempt.score} points`;
    }

    const noteElement = getElement('quiz-result-note');
    if (noteElement) {
        noteElement.innerText = `${attempt.correctCount} / ${attempt.totalCount} correct`;
    }

    renderQuizAnalysisList(Array.isArray(attempt.answers) ? attempt.answers : []);
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
    wordCard.classList.remove('flipped');
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

    setQuizGateVisible(true, 'Saving quiz result...');
    setQuizExamVisible(false);
    setQuizResultVisible(false);

    try {
        const savedAttempt = await quizAttemptsController.saveAttempt(attempt);
        renderQuizResult(savedAttempt);
    } catch (error) {
        console.error('Failed to save quiz attempt.', error);
        setQuizGateVisible(true, 'Could not save your quiz result. Please check Firebase permissions and try again.');
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
    if (quizIsLoading) return;
    quizIsLoading = true;
    const loadToken = ++activeLoadToken;
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

        dailyWords = pickDailyWords(allVocab, quizDateString, DAILY_WORD_COUNT);
        currentIndex = 0;
        score = 0;
        reviewedWords = [];
        speechController.retryLoadVoices();
        showQuizWord();
    } catch (error) {
        if (loadToken !== activeLoadToken) return;
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
    if (getPageMode() !== 'quiz' || !getElement('quiz-gate')) return;

    setQuizHeader();
    updateQuizResetButton();

    if (!quizAttemptsController.isReady()) {
        setQuizGateVisible(true, 'Loading today quiz...');
        setQuizExamVisible(false);
        setQuizResultVisible(false);
        return;
    }

    if (!quizAttemptsController.getUser()) {
        dailyWords = [];
        currentIndex = 0;
        score = 0;
        reviewedWords = [];
        setQuizGateVisible(true, 'Please sign in to start today quiz.');
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
    }
}

async function resetTodayQuizAttempt() {
    if (quizIsResetting) return;

    if (!quizAttemptsController.getUser()) {
        setQuizResetStatus('Please sign in before resetting today quiz.', true);
        updateQuizResetButton();
        return;
    }

    quizIsResetting = true;
    updateQuizResetButton();
    setQuizResetStatus('Resetting today quiz...');

    activeLoadToken++;
    dailyWords = [];
    currentIndex = 0;
    score = 0;
    reviewedWords = [];
    quizIsSaving = false;
    quizIsLoading = false;

    try {
        await quizAttemptsController.resetAttempt(quizDateString || getDateStringWithOffset(0));
        setQuizResetStatus('Today quiz has been reset.');
        setQuizGateVisible(true, 'Loading today quiz...');
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
        wordCard.classList.toggle('flipped');
    });

    wordCard.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            wordCard.classList.toggle('flipped');
        }
    });
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

function wireEvents() {
    const appRoot = getElement('app');
    if (!appRoot || wiredAppRoot === appRoot) {
        return;
    }
    wiredAppRoot = appRoot;

    const pageMode = getPageMode();
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
    getElement('deck-today').addEventListener('click', () => loadAndInitQuiz(0));
    getElement('deck-yesterday').addEventListener('click', () => loadAndInitQuiz(-1));
    getElement('review-again').addEventListener('click', restartActiveDeck);
    getElement('favorite-toggle').addEventListener('click', async (event) => {
        event.stopPropagation();

        const favoriteButton = event.currentTarget;
        const current = dailyWords[currentIndex];
        if (!current || favoriteButton.disabled) return;

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
    });
}

async function loadAndInitQuiz(deckOffset = 0) {
    await boot();
    return loadDeck(deckOffset);
}

async function loadDeck(deckOffset = 0) {
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

        let session = deckSessions.get(deckKey);
        if (!session) {
            session = createDeckSession(pickDailyWords(allVocab, deckKey, DAILY_WORD_COUNT));
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
            : pageMode === 'quiz'
                ? QUIZ_HTML_FUNCTIONS
                : pageMode === 'feature'
                    ? FEATURE_HTML_FUNCTIONS
                    : pageMode === 'favorites'
                        ? FAVORITES_HTML_FUNCTIONS
                        : HOME_HTML_FUNCTIONS;

        await loadHtmlFunctions(functionPaths);
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

        if (pageMode !== 'review') {
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

        window.location.href = 'pages/practice.html';
        return Promise.resolve();
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
    },
};

document.addEventListener('DOMContentLoaded', boot);

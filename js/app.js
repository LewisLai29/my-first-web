import {
    DAILY_WORD_COUNT,
    FAVORITES_HTML_FUNCTIONS,
    FEATURE_HTML_FUNCTIONS,
    HOME_HTML_FUNCTIONS,
    REVIEW_HTML_FUNCTIONS,
    VOCAB_SOURCE,
} from './config.js';
import { getDateStringWithOffset } from './date-utils.js';
import { loadHtmlFunctions } from './html-functions.js';
import { setupAuthUI } from './auth.js';
import { createFavoritesController } from './favorites.js';
import { createLookupController, hideLookupPopup } from './lookup.js';
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
let activeDeckLabel = 'Today';
let pendingWordRenderTimer = null;
let activeLoadToken = 0;
let bootPromise = null;
let wiredAppRoot = null;
let bootedPageMode = '';

const favoritesController = createFavoritesController(() => {
    updateFavoriteButton();
    renderFavoritesPage();
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
    const pageMode = appRoot?.dataset.page;

    if (pageMode === 'review' || pageMode === 'feature' || pageMode === 'favorites') {
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
    activeDeckLabel = 'Today';
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
    favoriteButton.innerText = isFavorite ? '★' : '☆';
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
    activeDeckLabel = getDeckLabel(deckOffset);
    activeDeckDateString = deckKey;
    dailyWords = session.dailyWords;
    currentIndex = session.currentIndex;
    reviewedWords = session.reviewedWords;
    score = session.score;
    recomputeScore();
    session.score = score;
}

function getDeckLabel(offsetDays) {
    if (offsetDays === 0) return 'Today';
    if (offsetDays === -1) return 'Yesterday';
    return getDateStringWithOffset(offsetDays);
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
        dateBadge.innerText = `${activeDeckLabel}: ${activeDeckDateString}`;
    }

    const resultNote = document.getElementById('result-note');
    if (resultNote) {
        resultNote.innerText = `You are reviewing ${activeDeckLabel.toLowerCase()}'s set: ${activeDeckDateString}.`;
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

function wireEvents() {
    const appRoot = getElement('app');
    if (!appRoot || wiredAppRoot === appRoot) {
        return;
    }
    wiredAppRoot = appRoot;

    if (getPageMode() !== 'review') {
        return;
    }

    getElement('word-card').addEventListener('click', () => {
        getElement('word-card').classList.toggle('flipped');
    });

    getElement('word-card').addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            getElement('word-card').classList.toggle('flipped');
        }
    });

    getElement('speak-word').addEventListener('click', speechController.speakCurrentWord);
    getElement('voice-select').addEventListener('change', (event) => speechController.setSelectedVoice(event.target.value, event));
    getElement('voice-select').addEventListener('click', (event) => event.stopPropagation());
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
    activeDeckLabel = getDeckLabel(deckOffset);
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
            : pageMode === 'feature'
                ? FEATURE_HTML_FUNCTIONS
                : pageMode === 'favorites'
                    ? FAVORITES_HTML_FUNCTIONS
                    : HOME_HTML_FUNCTIONS;

        await loadHtmlFunctions(functionPaths);
        await setupAuthUI();
        await favoritesController.init();
        renderFavoritesPage();
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
    dispose: () => {
        favoritesController.dispose();
    },
};

document.addEventListener('DOMContentLoaded', boot);

import { DAILY_WORD_COUNT, HOME_HTML_FUNCTIONS, REVIEW_HTML_FUNCTIONS, VOCAB_SOURCE } from './config.js';
import { getDateStringWithOffset } from './date-utils.js';
import { loadHtmlFunctions } from './html-functions.js';
import { setupAuthUI } from './auth.js';
import { createLookupController, hideLookupPopup } from './lookup.js';
import { renderReviewList } from './review-list.js';
import { createSpeechController, canSpeak } from './speech.js';
import { renderTermList } from './terms.js';
import {
    buildVocabMeaningMap,
    normalizeLookupWord,
    normalizeVocabItems,
    pickDailyWords,
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

const lookupController = createLookupController((word) => (
    vocabMeaningMap.get(normalizeLookupWord(word)) || ''
));

const speechController = createSpeechController(() => dailyWords[currentIndex]);

function getElement(id) {
    return document.getElementById(id);
}

function getPageMode() {
    const appRoot = getElement('app');
    return appRoot?.dataset.page === 'review' ? 'review' : 'home';
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
    if (getPageMode() === 'home') {
        return Boolean(getElement('home-screen') && getElement('start-review'));
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
    const accuracy = dailyWords.length > 0 ? Math.round((score / dailyWords.length) * 100) : 0;
    const finalAccuracy = getElement('final-accuracy');
    if (finalAccuracy) {
        finalAccuracy.innerText = `${accuracy}%`;
    }
    updateDeckLabels();
}

function restartActiveDeck() {
    if (!activeSession) return;

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
        await loadHtmlFunctions(pageMode === 'review' ? REVIEW_HTML_FUNCTIONS : HOME_HTML_FUNCTIONS);
        await setupAuthUI();
        if (pageMode === 'home') {
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

        window.location.href = 'review.html';
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
};

document.addEventListener('DOMContentLoaded', boot);

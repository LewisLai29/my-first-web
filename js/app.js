import { DAILY_WORD_COUNT, VOCAB_SOURCE } from './config.js';
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

const lookupController = createLookupController((word) => (
    vocabMeaningMap.get(normalizeLookupWord(word)) || ''
));

const speechController = createSpeechController(() => dailyWords[currentIndex]);

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

    document.getElementById('quiz-box').hidden = false;
    document.getElementById('result-box').hidden = true;
    hideLookupPopup();
    document.getElementById('word-card').classList.remove('flipped');
    clearPendingWordRender();

    const current = dailyWords[currentIndex];
    const loadToken = activeLoadToken;
    pendingWordRenderTimer = setTimeout(() => {
        if (loadToken !== activeLoadToken) return;
        document.getElementById('word-target').innerText = current.w;
        document.getElementById('word-pos').innerText = current.pos ? `(${current.pos})` : '';
        document.getElementById('word-meaning').innerText = current.m;
        lookupController.renderExampleText(document.getElementById('word-example'), current.e);
        renderTermList(document.getElementById('word-family'), current.wordFamily);
        renderTermList(document.getElementById('word-collocations'), current.collocations);
        speechController.updateSpeakButton();
    }, 150);

    document.getElementById('card-index').innerText = `Card: ${currentIndex + 1} / ${dailyWords.length}`;
    document.getElementById('score-count').innerText = `Correct: ${score}`;
    document.getElementById('progress').style.width = `${(currentIndex / dailyWords.length) * 100}%`;
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
    document.getElementById('quiz-box').hidden = true;
    document.getElementById('result-box').hidden = false;

    recomputeScore();
    const accuracy = dailyWords.length > 0 ? Math.round((score / dailyWords.length) * 100) : 0;
    document.getElementById('final-accuracy').innerText = `${accuracy}%`;
    updateDeckLabels();
}

function restartActiveDeck() {
    if (!activeSession) return;

    activeSession.currentIndex = 0;
    activeSession.score = 0;
    activeSession.reviewedWords = [];
    activateSession(activeSession, activeDeckKey, activeDeckOffset);
    document.getElementById('quiz-box').hidden = false;
    document.getElementById('result-box').hidden = true;
    updateDeckSwitcher();
    updateDeckLabels();
    clearPendingWordRender();
    renderCurrentReviewList();
    showWord();
}

function wireEvents() {
    document.getElementById('word-card').addEventListener('click', () => {
        document.getElementById('word-card').classList.toggle('flipped');
    });

    document.getElementById('word-card').addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            document.getElementById('word-card').classList.toggle('flipped');
        }
    });

    document.getElementById('speak-word').addEventListener('click', speechController.speakCurrentWord);
    document.getElementById('voice-select').addEventListener('change', (event) => speechController.setSelectedVoice(event.target.value, event));
    document.getElementById('voice-select').addEventListener('click', (event) => event.stopPropagation());
    document.getElementById('mark-wrong').addEventListener('click', () => nextWord(false));
    document.getElementById('mark-right').addEventListener('click', () => nextWord(true));
    document.getElementById('deck-today').addEventListener('click', () => loadAndInitQuiz(0));
    document.getElementById('deck-yesterday').addEventListener('click', () => loadAndInitQuiz(-1));
    document.getElementById('review-again').addEventListener('click', restartActiveDeck);

    document.addEventListener('click', (event) => {
        const popup = document.getElementById('lookup-popup');
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
    const loadToken = ++activeLoadToken;
    persistActiveSession();
    clearPendingWordRender();

    const deckKey = getDateStringWithOffset(deckOffset);
    activeDeckOffset = deckOffset;
    activeDeckLabel = getDeckLabel(deckOffset);
    activeDeckDateString = deckKey;

    document.getElementById('quiz-box').hidden = false;
    document.getElementById('result-box').hidden = true;
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
        document.getElementById('word-target').innerText = 'Error';
        document.getElementById('word-example').innerText = 'Please confirm the vocabulary JSON can be loaded.';
        console.error(error);
    }
}

async function boot() {
    await loadHtmlFunctions();
    await setupAuthUI();
    wireEvents();
    await loadAndInitQuiz();
}

window.PteVocabApp = {
    boot,
    loadAndInitQuiz,
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

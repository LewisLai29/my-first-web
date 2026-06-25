import { DAILY_WORD_COUNT, VOCAB_SOURCE } from './config.js';
import { getTodayString } from './date-utils.js';
import { loadHtmlFunctions } from './html-functions.js';
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

let dailyWords = [];
let currentIndex = 0;
let score = 0;
let reviewedWords = [];
let vocabMeaningMap = new Map();

const lookupController = createLookupController((word) => (
    vocabMeaningMap.get(normalizeLookupWord(word)) || ''
));

const speechController = createSpeechController(() => dailyWords[currentIndex]);

function renderCurrentReviewList() {
    renderReviewList(reviewedWords, dailyWords, currentIndex, jumpToWord);
}

function showWord() {
    if (currentIndex >= dailyWords.length) {
        showResult();
        return;
    }

    hideLookupPopup();
    document.getElementById('word-card').classList.remove('flipped');

    const current = dailyWords[currentIndex];
    setTimeout(() => {
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
    if (isRight) score++;
    currentIndex++;
    showWord();
}

function jumpToWord(wordIndex) {
    currentIndex = wordIndex;
    showWord();
}

function showResult() {
    hideLookupPopup();
    document.getElementById('quiz-box').hidden = true;
    document.getElementById('result-box').hidden = false;

    const accuracy = dailyWords.length > 0 ? Math.round((score / dailyWords.length) * 100) : 0;
    document.getElementById('final-accuracy').innerText = `${accuracy}%`;
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

async function loadAndInitQuiz() {
    const todayStr = getTodayString();
    document.getElementById('today-date').innerText = `Today: ${todayStr}`;

    try {
        const response = await fetch(VOCAB_SOURCE);
        if (!response.ok) throw new Error('Failed to load vocabulary JSON.');
        const vocabData = await response.json();
        const allVocab = normalizeVocabItems(vocabData);
        vocabMeaningMap = buildVocabMeaningMap(allVocab);

        dailyWords = pickDailyWords(allVocab, todayStr, DAILY_WORD_COUNT);
        currentIndex = 0;
        score = 0;
        reviewedWords = [];
        speechController.retryLoadVoices();
        renderCurrentReviewList();
        showWord();
    } catch (error) {
        document.getElementById('word-target').innerText = 'Error';
        document.getElementById('word-example').innerText = 'Please confirm the vocabulary JSON can be loaded.';
        console.error(error);
    }
}

async function boot() {
    await loadHtmlFunctions();
    wireEvents();
    await loadAndInitQuiz();
}

window.PteVocabApp = {
    boot,
    loadAndInitQuiz,
    lookupExampleWordMeaning: lookupController.lookupExampleWordMeaning,
    speakCurrentWord: speechController.speakCurrentWord,
    nextWord,
    getDailyWords: () => dailyWords,
    getCurrentIndex: () => currentIndex,
};

document.addEventListener('DOMContentLoaded', boot);

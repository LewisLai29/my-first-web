import { getDateStringWithOffset, seededRandom } from './date-utils.js';
import { setupAuthUI } from './auth.js';
import { createQuizAttemptsController } from './exam-attempts.js';
import { getClozeEndlessMode, getDailyWordCount } from './settings.js';
import { normalizeVocabItems, pickDailyWords } from './vocab.js';
import { VOCAB_SOURCE } from './config.js';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const BLANK_TEXT = '_____';

export const EXAM_REQUIRES_SIGN_IN = true;

let allVocab = [];
let examWords = [];
let questions = [];
let answers = [];
let currentIndex = 0;
let selectedAnswer = null;
let score = 0;
let examDateString = '';
let isLoading = false;
let isSaving = false;
let bootPromise = null;
let eventsWired = false;
let endlessMode = false;
let endlessCycle = 0;

const attemptsController = createQuizAttemptsController(renderExamState, 'examAttempts');

function getElement(id) {
    return document.getElementById(id);
}

function setHidden(id, hidden) {
    const element = getElement(id);
    if (element) {
        element.hidden = hidden;
    }
}

function setGateVisible(visible, message = '') {
    setHidden('exam-gate', !visible);
    const messageElement = getElement('exam-gate-message');
    if (messageElement && message) {
        messageElement.innerText = message;
    }
}

function setExamVisible(visible) {
    setHidden('exam-box', !visible);
}

function setResultVisible(visible) {
    setHidden('exam-result-box', !visible);
}

function calculateScore(correctCount, totalCount) {
    return totalCount > 0 ? Math.round((correctCount * 100) / totalCount) : 0;
}

function resetRuntimeState() {
    allVocab = [];
    examWords = [];
    questions = [];
    answers = [];
    currentIndex = 0;
    selectedAnswer = null;
    score = 0;
    examDateString = '';
    isLoading = false;
    isSaving = false;
    endlessMode = false;
    endlessCycle = 0;
}

function shuffle(items, randomFn) {
    const pool = [...items];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(randomFn() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
}

function normalizeWordForCompare(word) {
    return String(word).trim().toLowerCase();
}

function hasCjkCharacters(text) {
    return /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/.test(String(text || ''));
}

function stripInlineTranslation(text) {
    const source = String(text || '').trim();
    if (!source) {
        return '';
    }

    return source
        .replace(/\s*[\uFF08(]([^()\r\n]*)[\uFF09)]/g, (match, inner) => (hasCjkCharacters(inner) ? '' : match))
        .replace(/[ \t]+$/gm, '')
        .trim();
}

function extractInlineTranslation(text) {
    const source = String(text || '').trim();
    if (!source) {
        return '';
    }

    const matches = source.match(/^(.*?)(?:\s*[\uFF08(]([^()\r\n]*)[\uFF09)])?\s*$/);
    const translation = matches && matches[2] ? matches[2].trim() : '';
    return hasCjkCharacters(translation) ? translation : '';
}

function parseExampleText(text) {
    const source = String(text || '').trim();
    if (!source) {
        return { english: '', translation: '' };
    }

    const englishLines = source.split(/\r?\n/).map((line) => stripInlineTranslation(line));
    const translationLines = source.split(/\r?\n/).map((line) => extractInlineTranslation(line)).filter(Boolean);
    return {
        english: englishLines.join('\n').trim(),
        translation: translationLines.join('\n').trim(),
    };
}

function blankExampleText(englishText, correctWord) {
    const example = String(englishText || '');
    if (/\*\*[^*]+\*\*/.test(example)) {
        return example.replace(/\*\*[^*]+\*\*/g, BLANK_TEXT);
    }

    const escapedWord = String(correctWord).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return example.replace(new RegExp(`\\b${escapedWord}\\b`, 'i'), BLANK_TEXT);
}

function buildQuestionOptions(item, questionIndex) {
    const correctWord = item.w;
    const correctKey = normalizeWordForCompare(correctWord);
    const randomFn = seededRandom(`${examDateString}:exam:${item.id || correctWord}:${questionIndex}`);
    const distractorPool = shuffle(allVocab, randomFn)
        .map((candidate) => candidate.w)
        .filter((word) => normalizeWordForCompare(word) && normalizeWordForCompare(word) !== correctKey);

    const options = [correctWord];
    const seen = new Set([correctKey]);
    for (const word of distractorPool) {
        const key = normalizeWordForCompare(word);
        if (seen.has(key)) continue;
        seen.add(key);
        options.push(word);
        if (options.length === 4) break;
    }

    return shuffle(options, randomFn);
}

function createQuestion(item, index) {
    const parsedExample = parseExampleText(item.e || '');
    const exampleEnglish = parsedExample.english || '';
    return {
        id: item.id,
        w: item.w,
        pos: item.pos || '',
        m: item.m || '',
        e: item.e || '',
        exampleEnglish,
        exampleTranslation: parsedExample.translation || '',
        blankedExample: blankExampleText(exampleEnglish, item.w),
        options: buildQuestionOptions(item, index),
        correctWord: item.w,
    };
}

function buildQuestions() {
    questions = examWords.map((item, index) => createQuestion(item, index));
}

function appendEndlessCycle() {
    const cycleWords = shuffle(allVocab, Math.random);
    const startIndex = questions.length;
    questions.push(...cycleWords.map((item, index) => createQuestion(item, startIndex + index)));
    endlessCycle++;
}

function renderInlineLine(element, text, translation = '') {
    if (!element) return;

    element.innerHTML = '';
    if (text) {
        element.appendChild(document.createTextNode(text));
    }

    if (translation) {
        const suffix = document.createElement('span');
        suffix.className = 'exam-inline-translation';
        suffix.textContent = `"${translation}"`;
        element.appendChild(suffix);
    }
}

function renderExample(question, revealTranslation = false) {
    const element = getElement('exam-example');
    if (!element || !question) return;

    renderInlineLine(element, question.blankedExample || question.exampleEnglish || '', revealTranslation ? question.exampleTranslation : '');
}

function getWordMeaning(word) {
    const found = allVocab.find((item) => normalizeWordForCompare(item.w) === normalizeWordForCompare(word));
    return found ? (found.m || '') : '';
}

function renderOptionButtonText(button, word, revealTranslation = false) {
    const meaning = getWordMeaning(word);
    const textNode = button.querySelector('.exam-option-text');
    if (!textNode) return;

    textNode.textContent = revealTranslation && meaning ? `${word} (${meaning})` : word;
}

function renderQuestion() {
    if (currentIndex >= questions.length) {
        submitExamAttempt();
        return;
    }

    const question = questions[currentIndex];
    selectedAnswer = null;

    setGateVisible(false);
    setExamVisible(true);
    setResultVisible(false);

    getElement('exam-index').innerText = endlessMode
        ? `Question: ${currentIndex + 1} / ∞`
        : `Question: ${currentIndex + 1} / ${questions.length}`;
    getElement('exam-score-count').innerText = `Correct: ${score}`;
    const progressTotal = endlessMode ? allVocab.length : questions.length;
    const progressIndex = endlessMode ? currentIndex % Math.max(progressTotal, 1) : currentIndex;
    getElement('exam-progress').style.width = `${(progressIndex / Math.max(progressTotal, 1)) * 100}%`;
    renderExample(question, false);
    getElement('exam-next').disabled = true;
    getElement('exam-next').innerText = !endlessMode && currentIndex === questions.length - 1 ? 'Finish' : 'Next';

    const optionsElement = getElement('exam-options');
    optionsElement.innerHTML = '';
    question.options.forEach((word, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'exam-option';
        button.dataset.word = word;

        const label = document.createElement('span');
        label.className = 'exam-option-label';
        label.textContent = OPTION_LABELS[index];

        const text = document.createElement('span');
        text.className = 'exam-option-text';
        text.textContent = word;

        button.append(label, text);
        button.addEventListener('click', () => selectOption(word));
        optionsElement.appendChild(button);
    });

}

function updateOptionsAfterAnswer(question, selectedWord) {
    document.querySelectorAll('.exam-option').forEach((button) => {
        const optionWord = button.dataset.word;
        button.disabled = true;
        renderOptionButtonText(button, optionWord, true);

        if (normalizeWordForCompare(optionWord) === normalizeWordForCompare(question.correctWord)) {
            button.classList.add('correct');
        } else if (normalizeWordForCompare(optionWord) === normalizeWordForCompare(selectedWord)) {
            button.classList.add('wrong');
        }
    });
}

function selectOption(word) {
    if (selectedAnswer || (EXAM_REQUIRES_SIGN_IN && !endlessMode && attemptsController.getAttempt()) || isSaving) return;

    const question = questions[currentIndex];
    const isRight = normalizeWordForCompare(word) === normalizeWordForCompare(question.correctWord);
    selectedAnswer = {
        ...question,
        selectedWord: word,
        isRight,
    };
    answers[currentIndex] = selectedAnswer;
    if (isRight) score++;

    renderExample(question, true);
    updateOptionsAfterAnswer(question, word);

    getElement('exam-score-count').innerText = `Correct: ${score}`;
    getElement('exam-next').disabled = false;
}

function goNextQuestion() {
    if (!selectedAnswer) return;

    currentIndex++;
    if (endlessMode && currentIndex >= questions.length) {
        appendEndlessCycle();
    }
    if (currentIndex >= questions.length) {
        submitExamAttempt();
        return;
    }

    renderQuestion();
}

function renderResult(attempt) {
    if (!attempt) return;

    setGateVisible(false);
    setExamVisible(false);
    setResultVisible(true);

    getElement('exam-score').innerText = `${attempt.score} points`;
    getElement('exam-result-note').innerText = `${attempt.correctCount} / ${attempt.totalCount} correct`;

    const list = getElement('exam-analysis-list');
    list.innerHTML = '';
    (Array.isArray(attempt.answers) ? attempt.answers : []).forEach((answer, index) => {
        const item = document.createElement('li');
        item.className = answer.isRight ? 'quiz-analysis-item quiz-analysis-right' : 'quiz-analysis-item quiz-analysis-wrong';

        const heading = document.createElement('div');
        heading.className = 'quiz-analysis-heading';

        const word = document.createElement('strong');
        word.textContent = `${index + 1}. ${answer.w}`;

        const result = document.createElement('span');
        result.className = 'quiz-analysis-result';
        result.textContent = answer.isRight ? 'Correct' : 'Wrong';

        heading.append(word, result);

        const example = document.createElement('p');
        example.className = 'example quiz-analysis-example';
        renderInlineLine(example, answer.blankedExample || answer.exampleEnglish || answer.e || '', answer.exampleTranslation || '');

        const selected = document.createElement('p');
        selected.className = 'exam-analysis-answer';
        selected.textContent = `Your answer: ${answer.selectedWord || 'No answer'} / Correct: ${answer.correctWord || answer.w}`;

        const meaning = document.createElement('p');
        meaning.className = 'quiz-analysis-meaning';
        meaning.textContent = answer.m || 'No explanation';

        item.append(heading, example, selected, meaning);
        list.appendChild(item);
    });

}

async function submitExamAttempt() {
    if (isSaving || (EXAM_REQUIRES_SIGN_IN && attemptsController.getAttempt())) {
        renderResult(attemptsController.getAttempt());
        return;
    }

    isSaving = true;
    const attempt = {
        date: examDateString,
        totalCount: questions.length,
        correctCount: score,
        score: calculateScore(score, questions.length),
        answers,
    };

    setGateVisible(true, 'Saving cloze exam result...');
    setExamVisible(false);
    setResultVisible(false);

    if (!EXAM_REQUIRES_SIGN_IN) {
        renderResult({
            ...attempt,
            completedAt: new Date().toISOString(),
        });
        isSaving = false;
        return;
    }

    try {
        const savedAttempt = await attemptsController.saveAttempt(attempt);
        renderResult(savedAttempt);
    } catch (error) {
        console.error('Failed to save cloze exam attempt.', error);
        setGateVisible(true, 'Could not save your cloze exam result. Please check Firebase permissions and try again.');
    } finally {
        isSaving = false;
    }
}

async function loadExamDeck() {
    if (isLoading) return;

    isLoading = true;
    setGateVisible(true, 'Loading today cloze exam...');
    setExamVisible(false);
    setResultVisible(false);

    try {
        const response = await fetch(VOCAB_SOURCE);
        if (!response.ok) throw new Error('Failed to load vocabulary JSON.');
        const vocabData = await response.json();
        allVocab = normalizeVocabItems(vocabData);
        endlessMode = getClozeEndlessMode();
        examWords = endlessMode
            ? shuffle(allVocab, Math.random)
            : pickDailyWords(allVocab, examDateString, getDailyWordCount());
        endlessCycle = endlessMode ? 1 : 0;
        currentIndex = 0;
        selectedAnswer = null;
        score = 0;
        answers = [];
        buildQuestions();
        renderQuestion();
    } catch (error) {
        console.error(error);
        setGateVisible(true, 'Please confirm the vocabulary JSON can be loaded.');
        setExamVisible(false);
        setResultVisible(false);
    } finally {
        isLoading = false;
    }
}

function renderExamState() {
    if (!EXAM_REQUIRES_SIGN_IN) {
        if (questions.length === 0 && !isLoading && !isSaving) {
            loadExamDeck();
            return;
        }

        if (questions.length > 0 && !isLoading && !isSaving) {
            renderQuestion();
        }
        return;
    }

    if (!attemptsController.isReady()) {
        setGateVisible(true, 'Loading today cloze exam...');
        setExamVisible(false);
        setResultVisible(false);
        return;
    }

    if (!attemptsController.getUser()) {
        setGateVisible(true, 'Please sign in to start today cloze exam.');
        setExamVisible(false);
        setResultVisible(false);
        return;
    }

    const attempt = endlessMode ? null : attemptsController.getAttempt();
    if (attempt) {
        renderResult(attempt);
        return;
    }

    if (questions.length === 0 && !isLoading && !isSaving) {
        loadExamDeck();
        return;
    }

    if (questions.length > 0 && !isLoading && !isSaving) {
        renderQuestion();
    }
}

export async function boot() {
    if (bootPromise) return bootPromise;

    bootPromise = (async () => {
        examDateString = getDateStringWithOffset(0);
        endlessMode = getClozeEndlessMode();
        const dateElement = getElement('today-date');
        if (dateElement) {
            dateElement.innerText = examDateString;
        }

        if (!eventsWired) {
            const nextButton = getElement('exam-next');
            if (nextButton) {
                nextButton.addEventListener('click', goNextQuestion);
            }
            eventsWired = true;
        }

        await setupAuthUI();
        await attemptsController.init(examDateString);
        renderExamState();
    })();

    return bootPromise;
}

window.PteExamApp = {
    boot,
    getQuestions: () => questions,
    getCurrentIndex: () => currentIndex,
    getScore: () => score,
    isEndlessMode: () => endlessMode,
    getEndlessCycle: () => endlessCycle,
    getAttempt: attemptsController.getAttempt,
    dispose: () => {
        attemptsController.dispose();
        resetRuntimeState();
        bootPromise = null;
        eventsWired = false;
    },
};

document.addEventListener('DOMContentLoaded', boot);

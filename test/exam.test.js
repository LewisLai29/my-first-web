const fs = require('fs');
const path = require('path');
const { fileURLToPath, pathToFileURL } = require('url');

const PROJECT_ROOT = path.resolve(__dirname, '..');
let importSequence = 0;

describe('PTE cloze exam page', () => {
    let mockVocab;
    let mockAuthUser;
    let authStateListeners;
    let examAttemptStore;
    let examAttemptSetMock;
    let examAttemptDeleteMock;

    const installMockFirebase = () => {
        const auth = {
            createUserWithEmailAndPassword: jest.fn(),
            signInWithEmailAndPassword: jest.fn(),
            signInWithPopup: jest.fn(),
            signOut: jest.fn(),
            onAuthStateChanged: jest.fn((listener) => {
                authStateListeners.push(listener);
                listener(mockAuthUser);
                return jest.fn();
            }),
        };

        const examAttemptCollection = {
            doc: jest.fn((attemptId) => ({
                get: jest.fn(() => Promise.resolve({
                    exists: examAttemptStore.has(attemptId),
                    data: () => examAttemptStore.get(attemptId),
                })),
                set: jest.fn((data) => {
                    examAttemptSetMock(attemptId, data);
                    examAttemptStore.set(attemptId, data);
                    return Promise.resolve();
                }),
                delete: jest.fn(() => {
                    examAttemptDeleteMock(attemptId);
                    examAttemptStore.delete(attemptId);
                    return Promise.resolve();
                }),
            })),
        };

        const userDocument = {
            collection: jest.fn((name) => {
                if (name === 'examAttempts') return examAttemptCollection;
                throw new Error(`Unexpected user collection: ${name}`);
            }),
        };

        const db = {
            collection: jest.fn((name) => {
                expect(name).toBe('users');
                return {
                    doc: jest.fn((uid) => {
                        expect(uid).toBe(mockAuthUser.uid);
                        return userDocument;
                    }),
                };
            }),
        };

        const authFactory = jest.fn(() => auth);
        authFactory.GoogleAuthProvider = function GoogleAuthProvider() {};

        const firestoreFactory = jest.fn(() => db);
        firestoreFactory.FieldValue = {
            serverTimestamp: jest.fn(() => 'SERVER_TIME'),
        };

        window.firebase = {
            apps: [],
            initializeApp: jest.fn(() => {
                window.firebase.apps.push({});
            }),
            auth: authFactory,
            firestore: firestoreFactory,
        };
    };

    const waitForExamUi = async () => {
        for (let i = 0; i < 100; i++) {
            const gate = document.getElementById('exam-gate');
            const examBox = document.getElementById('exam-box');
            const example = document.getElementById('exam-example');
            if (gate && gate.hidden === false) {
                return;
            }
            if (examBox && examBox.hidden === false && example && example.innerText !== 'Loading example...') {
                return;
            }

            jest.advanceTimersByTime(50);
            await Promise.resolve();
            await Promise.resolve();
        }

        throw new Error(`Exam UI did not render in time. body=${document.body ? document.body.innerHTML.slice(0, 300) : 'missing body'}`);
    };

    const waitForExamResult = async () => {
        for (let i = 0; i < 100; i++) {
            const resultBox = document.getElementById('exam-result-box');
            if (resultBox && resultBox.hidden === false) {
                return;
            }

            jest.advanceTimersByTime(50);
            await Promise.resolve();
            await Promise.resolve();
        }

        throw new Error('Exam result did not render in time.');
    };

    const loadExamPage = async (date = '2026-06-23T12:00:00+08:00', { user = null } = {}) => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(date));
        mockAuthUser = user;
        installMockFirebase();

        window.fetch = jest.fn((url) => {
            const urlString = String(url);
            const localPath = urlString.startsWith('file:')
                ? fileURLToPath(urlString)
                : path.resolve(PROJECT_ROOT, urlString);
            const relativeLocalPath = path.relative(PROJECT_ROOT, localPath).replace(/\\/g, '/');

            if (relativeLocalPath === 'pte_vocab.json') {
                return Promise.resolve({
                    ok: true,
                    json: jest.fn().mockResolvedValue(mockVocab),
                });
            }

            return Promise.resolve({ ok: false });
        });

        const html = fs.readFileSync(path.resolve(PROJECT_ROOT, 'pages/cloze-exam.html'), 'utf8');
        document.documentElement.innerHTML = html;

        const scriptPath = path.resolve(PROJECT_ROOT, 'pages', document.querySelector('script[src$="js/cloze-exam.js"]').getAttribute('src'));
        importSequence += 1;
        await import(`${pathToFileURL(scriptPath).href}?testRun=${importSequence}`);
        await window.PteExamApp.boot();
        jest.runOnlyPendingTimers();
        await Promise.resolve();
        await Promise.resolve();
        if (user) {
            authStateListeners.forEach((listener) => listener(user));
        }
        await Promise.resolve();
        await Promise.resolve();
    };

    const loadHomePage = async (date = '2026-06-23T12:00:00+08:00') => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(date));
        delete window.firebase;

        window.fetch = jest.fn((url) => {
            const urlString = String(url);
            const localPath = urlString.startsWith('file:')
                ? fileURLToPath(urlString)
                : path.resolve(PROJECT_ROOT, urlString);
            const relativeLocalPath = path.relative(PROJECT_ROOT, localPath).replace(/\\/g, '/');

            if (relativeLocalPath.startsWith('partials/')) {
                return Promise.resolve({
                    ok: true,
                    text: jest.fn().mockResolvedValue(fs.readFileSync(localPath, 'utf8')),
                });
            }

            if (relativeLocalPath === 'pte_vocab.json') {
                return Promise.resolve({
                    ok: true,
                    json: jest.fn().mockResolvedValue(mockVocab),
                });
            }

            return Promise.resolve({ ok: false });
        });

        const html = fs.readFileSync(path.resolve(PROJECT_ROOT, 'index.html'), 'utf8');
        document.documentElement.innerHTML = html;

        const scriptPath = path.resolve(PROJECT_ROOT, document.querySelector('script[src$="js/app.js"]').getAttribute('src'));
        importSequence += 1;
        await import(`${pathToFileURL(scriptPath).href}?testRun=${importSequence}`);
        await window.PteVocabApp.boot();
        jest.runOnlyPendingTimers();
        await Promise.resolve();
        await Promise.resolve();
    };

    beforeEach(() => {
        mockAuthUser = { uid: 'user-123', email: 'test@example.com' };
        authStateListeners = [];
        examAttemptStore = new Map();
        examAttemptSetMock = jest.fn();
        examAttemptDeleteMock = jest.fn();
        mockVocab = {
            items: Array.from({ length: 40 }, (_, i) => ({
                id: i + 1,
                w: `word${i + 1}`,
                m: `中文意思${i + 1}`,
                e: `This is **word${i + 1}** in an example.（中文句子${i + 1}）`,
            })),
        };
    });

    afterEach(() => {
        window.PteExamApp?.dispose?.();
        window.PteVocabApp?.dispose?.();
        jest.clearAllTimers();
        jest.clearAllMocks();
        jest.useRealTimers();
        window.localStorage.clear();
        document.body.replaceChildren();
        delete window.firebase;
    });

    test('opens the cloze exam from the exams popup without replacing the exams entry', async () => {
        await loadHomePage();

        expect(document.getElementById('start-tests').textContent.trim()).toBe('Exams');
        expect(document.getElementById('start-tests').getAttribute('href')).toBe('pages/exams.html');

        document.getElementById('start-tests').click();
        for (let i = 0; i < 100; i++) {
            if (document.getElementById('start-daily-quiz') && document.getElementById('start-daily-exam')) {
                break;
            }

            jest.advanceTimersByTime(50);
            await Promise.resolve();
            await Promise.resolve();
        }

        expect(document.getElementById('start-daily-quiz').textContent).toContain('Vocabulary Exam');
        expect(document.getElementById('start-daily-exam').textContent).toContain('Cloze Exam');

        document.getElementById('start-daily-exam').click();
        for (let i = 0; i < 100; i++) {
            const popup = document.getElementById('tests-popup');
            const gate = document.getElementById('exam-gate');
            if (popup && popup.hidden === false && gate && gate.hidden === false) {
                break;
            }

            jest.advanceTimersByTime(50);
            await Promise.resolve();
            await Promise.resolve();
        }

        expect(document.getElementById('home-screen')).not.toBeNull();
        expect(document.getElementById('tests-popup').hidden).toBe(false);
        expect(document.getElementById('tests-session-view').hidden).toBe(false);
        expect(document.getElementById('exam-popup-content')).not.toBeNull();
        expect(document.getElementById('exam-gate').hidden).toBe(false);
        expect(document.getElementById('exam-gate-message').innerText).toBe('Please sign in to start today cloze exam.');
    });

    test('loads exam gate when sign-in is required', async () => {
        await loadExamPage('2026-06-23T12:00:00+08:00', { user: null });
        await waitForExamUi();

        expect(document.getElementById('exam-box').hidden).toBe(true);
        expect(window.PteExamApp.getQuestions()).toHaveLength(0);
        expect(examAttemptSetMock).not.toHaveBeenCalled();
    });

    test('renders daily multiple choice questions after sign in', async () => {
        const signedInUser = { uid: 'user-123', email: 'test@example.com' };
        await loadExamPage('2026-06-23T12:00:00+08:00', { user: signedInUser });
        await waitForExamUi();

        const questions = window.PteExamApp.getQuestions();
        expect(questions).toHaveLength(15);
        expect(document.getElementById('exam-box').hidden).toBe(false);
        expect(document.getElementById('exam-example').textContent).toContain('_____');
        expect(document.getElementById('exam-example').textContent).not.toContain('**');
        expect(document.getElementById('exam-example').textContent).not.toMatch(/[\u3400-\u9FFF]/);

        const optionWords = [...document.querySelectorAll('.exam-option')].map((button) => button.dataset.word);
        expect(optionWords).toHaveLength(4);
        expect(new Set(optionWords).size).toBe(4);
    });

    test('keeps drawing randomized cloze questions from the full vocabulary in endless mode', async () => {
        window.localStorage.setItem('pte.clozeEndlessMode', 'true');
        await loadExamPage('2026-06-23T12:00:00+08:00', { user: { uid: 'user-123', email: 'test@example.com' } });

        for (let i = 0; i < 100 && window.PteExamApp.getQuestions().length !== mockVocab.items.length; i++) {
            jest.advanceTimersByTime(50);
            await Promise.resolve();
            await Promise.resolve();
        }

        expect(window.PteExamApp.isEndlessMode()).toBe(true);
        expect(window.PteExamApp.getQuestions()).toHaveLength(mockVocab.items.length);
        expect(new Set(window.PteExamApp.getQuestions().map((question) => question.id))).toHaveSize(mockVocab.items.length);
        expect(document.getElementById('exam-index').innerText).toBe('Question: 1 / ∞');
        expect(document.getElementById('exam-next').innerText).toBe('Next');

        for (let i = 0; i < mockVocab.items.length; i++) {
            const question = window.PteExamApp.getQuestions()[i];
            document.querySelector(`.exam-option[data-word="${question.correctWord}"]`).click();
            document.getElementById('exam-next').click();
        }

        expect(window.PteExamApp.getCurrentIndex()).toBe(mockVocab.items.length);
        expect(window.PteExamApp.getEndlessCycle()).toBe(2);
        expect(window.PteExamApp.getQuestions()).toHaveLength(mockVocab.items.length * 2);
        expect(document.getElementById('exam-result-box').hidden).toBe(true);
        expect(document.getElementById('exam-index').innerText).toBe(`Question: ${mockVocab.items.length + 1} / ∞`);
    });

    test('strips translated text from multiline example sentences', async () => {
        mockVocab = {
            items: Array.from({ length: 15 }, (_, i) => ({
                id: i + 1,
                w: `word${i + 1}`,
                m: `meaning${i + 1}`,
                e: i === 0
                    ? 'First **word1** example.（第一句翻譯）\nSecond **word1** example.（第二句翻譯）'
                    : `This is **word${i + 1}** in an example.（中文句子${i + 1}）`,
            })),
        };

        await loadExamPage('2026-06-23T12:00:00+08:00', { user: { uid: 'user-123', email: 'test@example.com' } });
        await waitForExamUi();

        const parsedQuestion = window.PteExamApp.getQuestions().find((question) => question.id === 1);
        expect(parsedQuestion.exampleEnglish).toBe('First **word1** example.\nSecond **word1** example.');
        expect(parsedQuestion.exampleTranslation).toBe('第一句翻譯\n第二句翻譯');
        expect(parsedQuestion.blankedExample).toBe('First _____ example.\nSecond _____ example.');
        expect(document.getElementById('exam-example').textContent).not.toMatch(/[\u3400-\u9FFF]/);
    });

    test('answers questions and saves examAttempts when signed in', async () => {
        await loadExamPage('2026-06-23T12:00:00+08:00', { user: { uid: 'user-123', email: 'test@example.com' } });
        await waitForExamUi();

        const totalQuestions = 15;
        for (let i = 0; i < totalQuestions; i++) {
            const question = window.PteExamApp.getQuestions()[i];
            document.querySelector(`.exam-option[data-word="${question.correctWord}"]`).click();
            expect(document.getElementById('exam-next').disabled).toBe(false);
            expect(document.getElementById('exam-example').textContent).toMatch(/[\u3400-\u9FFF]/);
            expect([...document.querySelectorAll('.exam-option .exam-option-text')].every((node) => node.textContent.includes('('))).toBe(true);
            document.getElementById('exam-next').click();
            for (let wait = 0; wait < 20 && window.PteExamApp.getCurrentIndex() === i && i < totalQuestions - 1; wait++) {
                await Promise.resolve();
                jest.advanceTimersByTime(20);
            }
        }

        await waitForExamResult();

        expect(examAttemptSetMock).toHaveBeenCalledTimes(1);
        expect(examAttemptSetMock.mock.calls[0][0]).toBe('2026-06-23');
        expect(examAttemptSetMock.mock.calls[0][1].totalCount).toBe(totalQuestions);
        expect(document.getElementById('exam-score').innerText).toBe('100 points');
        expect(document.querySelectorAll('#exam-analysis-list .quiz-analysis-item')).toHaveLength(totalQuestions);
        expect(document.querySelector('#exam-analysis-list .quiz-analysis-example').textContent).toMatch(/[\u3400-\u9FFF]/);
    });
    test('shows an existing exam attempt when it exists for today', async () => {
        examAttemptStore.set('2026-06-23', {
            date: '2026-06-23',
            totalCount: 1,
            correctCount: 1,
            score: 100,
            answers: [{
                id: 1,
                w: 'word1',
                m: '中文意思1',
                e: 'This is **word1** in an example.（中文句子1）',
                blankedExample: 'This is _____ in an example.',
                exampleEnglish: 'This is _____ in an example.',
                exampleTranslation: '中文句子1',
                options: ['word1', 'word2', 'word3', 'word4'],
                selectedWord: 'word1',
                correctWord: 'word1',
                isRight: true,
            }],
        });

        await loadExamPage('2026-06-23T12:00:00+08:00', { user: { uid: 'user-123', email: 'test@example.com' } });
        await waitForExamResult();

        expect(document.getElementById('exam-result-box').hidden).toBe(false);
        expect(document.getElementById('exam-score').innerText).toBe('100 points');
        expect(examAttemptSetMock).not.toHaveBeenCalled();
    });
});


const fs = require('fs');
const path = require('path');
const { fileURLToPath, pathToFileURL } = require('url');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const sortIds = (ids) => [...ids].sort((a, b) => a - b);
let importSequence = 0;

describe('PTE daily vocabulary page (index.html)', () => {
    let mockVocab;
    let mockVoices;
    let mockFirebaseEnabled;
    let mockAuthUser;
    let authStateListeners;
    let favoriteSnapshotListeners;
    let favoriteStore;
    let favoriteSetMock;
    let favoriteDeleteMock;
    let quizAttemptStore;
    let quizAttemptSetMock;
    let quizAttemptDeleteMock;

    const createFavoritesSnapshot = () => ({
        forEach: (callback) => {
            favoriteStore.forEach((data, id) => {
                callback({
                    id,
                    data: () => data,
                });
            });
        },
    });

    const emitFavoriteSnapshot = () => {
        const snapshot = createFavoritesSnapshot();
        favoriteSnapshotListeners.forEach((listener) => listener(snapshot));
    };

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

        const favoriteCollection = {
            doc: jest.fn((favoriteId) => ({
                set: jest.fn((data) => {
                    favoriteSetMock(favoriteId, data);
                    favoriteStore.set(favoriteId, data);
                    emitFavoriteSnapshot();
                    return Promise.resolve();
                }),
                delete: jest.fn(() => {
                    favoriteDeleteMock(favoriteId);
                    favoriteStore.delete(favoriteId);
                    emitFavoriteSnapshot();
                    return Promise.resolve();
                }),
            })),
            onSnapshot: jest.fn((listener) => {
                favoriteSnapshotListeners.push(listener);
                listener(createFavoritesSnapshot());
                return jest.fn();
            }),
        };

        const quizAttemptCollection = {
            doc: jest.fn((attemptId) => ({
                get: jest.fn(() => Promise.resolve({
                    exists: quizAttemptStore.has(attemptId),
                    data: () => quizAttemptStore.get(attemptId),
                })),
                set: jest.fn((data) => {
                    quizAttemptSetMock(attemptId, data);
                    quizAttemptStore.set(attemptId, data);
                    return Promise.resolve();
                }),
                delete: jest.fn(() => {
                    quizAttemptDeleteMock(attemptId);
                    quizAttemptStore.delete(attemptId);
                    return Promise.resolve();
                }),
            })),
        };

        const userDocument = {
            collection: jest.fn((name) => {
                if (name === 'favorites') return favoriteCollection;
                if (name === 'quizAttempts') return quizAttemptCollection;
                throw new Error(`Unexpected user collection: ${name}`);
            }),
        };

        const usersCollection = {
            doc: jest.fn((uid) => {
                expect(uid).toBe(mockAuthUser.uid);
                return userDocument;
            }),
        };

        const db = {
            collection: jest.fn((name) => {
                expect(name).toBe('users');
                return usersCollection;
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

    const flushLookup = async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    };

    const waitForReviewUi = async () => {
        for (let i = 0; i < 100; i++) {
            const wordExample = document.getElementById('word-example');
            const wordMeaning = document.getElementById('word-meaning');
            const speakWord = document.getElementById('speak-word');
            const wordTarget = document.getElementById('word-target');

            if (
                wordExample
                && wordMeaning
                && speakWord
                && wordTarget
                && wordTarget.innerText !== 'Loading...'
                && wordExample.innerText !== 'Loading example...'
            ) {
                return;
            }

            jest.advanceTimersByTime(50);
            await Promise.resolve();
            await Promise.resolve();
        }

        const dailyWordsLength = window.PteVocabApp.getDailyWords().length;
        const wordExample = document.getElementById('word-example');
        throw new Error(`Review UI did not render in time. words=${dailyWordsLength}, example=${wordExample ? wordExample.innerHTML : 'missing'}, body=${document.body ? document.body.innerHTML.slice(0, 200) : 'missing body'}`);
    };

    const waitForQuizUi = async () => {
        for (let i = 0; i < 100; i++) {
            const quizBox = document.getElementById('quiz-box');
            const wordExample = document.getElementById('word-example');
            const wordTarget = document.getElementById('word-target');

            if (
                quizBox
                && quizBox.hidden === false
                && wordTarget
                && wordTarget.innerText !== 'Loading...'
                && wordExample
                && wordExample.innerText !== 'Loading example...'
            ) {
                return;
            }

            jest.advanceTimersByTime(50);
            await Promise.resolve();
            await Promise.resolve();
        }

        throw new Error(`Quiz UI did not render in time. body=${document.body ? document.body.innerHTML.slice(0, 300) : 'missing body'}`);
    };

    const waitForQuizResult = async () => {
        for (let i = 0; i < 100; i++) {
            const resultBox = document.getElementById('quiz-result-box');
            if (resultBox && resultBox.hidden === false) {
                return;
            }

            jest.advanceTimersByTime(50);
            await Promise.resolve();
            await Promise.resolve();
        }

        throw new Error('Quiz result did not render in time.');
    };

    const waitForActiveDeckKey = async (expectedKey) => {
        for (let i = 0; i < 40; i++) {
            if (window.__getActiveDeckKey() === expectedKey) {
                return;
            }

            jest.advanceTimersByTime(50);
            await Promise.resolve();
            await Promise.resolve();
        }

        throw new Error(`Active deck key did not become ${expectedKey}. Current value: ${window.__getActiveDeckKey()}`);
    };

    const loadPage = async (date = '2026-06-23T12:00:00+08:00', page = 'index.html') => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(date));
        if (mockFirebaseEnabled) {
            installMockFirebase();
        } else {
            delete window.firebase;
        }

        window.fetch = jest.fn((url) => {
            const urlString = String(url);
            const localPath = urlString.startsWith('file:')
                ? fileURLToPath(urlString)
                : path.resolve(PROJECT_ROOT, urlString);
            const relativeLocalPath = path.relative(PROJECT_ROOT, localPath).replace(/\\/g, '/');

            if (relativeLocalPath.startsWith('partials/')) {
                return Promise.resolve({
                    ok: true,
                    text: jest.fn().mockResolvedValue(
                        fs.readFileSync(localPath, 'utf8')
                    ),
                });
            }

            if (relativeLocalPath === 'pte_vocab.json') {
                return Promise.resolve({
                    ok: true,
                    json: jest.fn().mockResolvedValue(mockVocab),
                });
            }

            return Promise.resolve({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    responseData: {
                        translatedText: '線上翻譯',
                    },
                }),
            });
        });
        window.speechSynthesis = {
            cancel: jest.fn(),
            getVoices: jest.fn(() => mockVoices),
            speak: jest.fn(),
        };
        window.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) {
            this.text = text;
        };

        const html = fs.readFileSync(path.resolve(PROJECT_ROOT, page), 'utf8');
        document.documentElement.innerHTML = html;

        const appScript = document.querySelector('script[src$="js/app.js"]');
        const appScriptPath = path.resolve(PROJECT_ROOT, path.dirname(page), appScript.getAttribute('src'));
        const appScriptUrl = pathToFileURL(appScriptPath).href;
        importSequence += 1;
        await import(`${appScriptUrl}?testRun=${importSequence}`);

        await window.PteVocabApp.boot();
        jest.runOnlyPendingTimers();
        await Promise.resolve();
        await Promise.resolve();
        if (mockFirebaseEnabled) {
            authStateListeners.forEach((listener) => listener(mockAuthUser));
            emitFavoriteSnapshot();
            await Promise.resolve();
            await Promise.resolve();
        }

        window.__getDailyWords = window.PteVocabApp.getDailyWords;
        window.__getCurrentIndex = window.PteVocabApp.getCurrentIndex;
        window.__nextWord = window.PteVocabApp.nextWord;
        window.__restartActiveDeck = window.PteVocabApp.restartActiveDeck;
        window.__speakCurrentWord = window.PteVocabApp.speakCurrentWord;
        window.__lookupExampleWordMeaning = window.PteVocabApp.lookupExampleWordMeaning;
        window.__getActiveDeckKey = window.PteVocabApp.getActiveDeckKey;
        window.__getQuizAttempt = window.PteVocabApp.getQuizAttempt;
    };

    const loadReviewPage = async (date) => {
        await loadPage(date, 'pages/practice.html');
        jest.runOnlyPendingTimers();
        jest.runOnlyPendingTimers();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await waitForReviewUi();
    };

    const loadQuizPage = async (date) => {
        await loadPage(date, 'pages/quiz.html');
        jest.runOnlyPendingTimers();
        await Promise.resolve();
        await Promise.resolve();
    };

    const loadFavoritesPage = async (date) => {
        await loadPage(date, 'pages/favorites.html');
        jest.runOnlyPendingTimers();
        await Promise.resolve();
        await Promise.resolve();
    };

    beforeEach(() => {
        mockFirebaseEnabled = false;
        mockAuthUser = { uid: 'user-123', email: 'test@example.com' };
        authStateListeners = [];
        favoriteSnapshotListeners = [];
        favoriteStore = new Map();
        favoriteSetMock = jest.fn();
        favoriteDeleteMock = jest.fn();
        quizAttemptStore = new Map();
        quizAttemptSetMock = jest.fn();
        quizAttemptDeleteMock = jest.fn();
        mockVoices = [
            { name: 'Microsoft David Desktop', lang: 'en-US' },
            { name: 'Google US English', lang: 'en-US' },
        ];
        mockVocab = {
            metadata: {
                counts: {
                    total: 2000,
                },
            },
            items: Array.from({ length: 2000 }, (_, i) => ({
                id: i + 1,
                w: `word${i + 1}`,
                m: `meaning${i + 1}`,
                e: `This is **word${i + 1}** in an example.`,
                source_basis: ['test_source'],
                meaning_status: 'ready_zh_reviewed',
                example_status: 'ready_bolded',
                confidence: 'high',
            })),
        };
    });

    const fetchedProjectPaths = () => window.fetch.mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.startsWith('file:'))
        .map((url) => path.relative(PROJECT_ROOT, fileURLToPath(url)).replace(/\\/g, '/'));

    const expectFetchedPath = (relativePath) => {
        expect(fetchedProjectPaths()).toContain(relativePath);
    };

    const expectNotFetchedPath = (relativePath) => {
        expect(fetchedProjectPaths()).not.toContain(relativePath);
    };

    afterEach(() => {
        window.PteVocabApp?.dispose?.();
        jest.clearAllTimers();
        jest.clearAllMocks();
        jest.useRealTimers();
        window.sessionStorage.clear();
        window.localStorage.clear();
        if (document.body) {
            document.body.replaceChildren();
        }
        delete window.firebase;
    });

    test('loads the cover page first and waits for the user to start review', async () => {
        await loadPage();

        expectFetchedPath('partials/common/header.html');
        expectFetchedPath('partials/common/auth-modal.html');
        expectFetchedPath('partials/home/home.html');
        expectNotFetchedPath('partials/review/quiz.html');
        expectNotFetchedPath('partials/review/review-list.html');
        expectNotFetchedPath('partials/review/result.html');
        expectNotFetchedPath('partials/review/lookup-popup.html');
        expectNotFetchedPath('pte_vocab.json');

        expect(window.__getDailyWords()).toHaveLength(0);
        expect(document.getElementById('home-screen').hidden).toBe(false);
        expect(document.querySelector('.home-features')).not.toBeNull();
        expect(document.getElementById('auth-open-sign-in')).not.toBeNull();
        expect(document.getElementById('start-review').textContent.trim()).toBe('Practice');
        expect(document.getElementById('start-review').getAttribute('href')).toBe('pages/practice.html');
        expect(document.getElementById('start-practice').textContent.trim()).toBe('Quiz');
        expect(document.getElementById('start-practice').getAttribute('href')).toBe('pages/quiz.html');
        expect(document.getElementById('start-favorites').textContent.trim()).toBe('Favorites');
        expect(document.getElementById('start-favorites').getAttribute('href')).toBe('pages/favorites.html');
        expect(document.getElementById('start-setting').textContent.trim()).toBe('Setting');
        expect(document.getElementById('start-setting').getAttribute('href')).toBe('pages/setting.html');
        expect(document.getElementById('setting-popup').hidden).toBe(true);
        expect(document.getElementById('setting-screen')).toBeNull();
        expect(document.getElementById('header-copy').hidden).toBe(true);
        expect(document.getElementById('quiz-box')).toBeNull();
        expect(document.getElementById('word-target')).toBeNull();
    });

    test('opens setting from the cover page in a popup without navigating away', async () => {
        await loadPage();

        expectNotFetchedPath('partials/setting/setting.html');

        document.getElementById('start-setting').click();
        for (let i = 0; i < 10 && document.getElementById('setting-popup').hidden; i++) {
            await Promise.resolve();
            jest.advanceTimersByTime(20);
        }

        expectFetchedPath('partials/setting/setting.html');
        expect(document.getElementById('home-screen')).not.toBeNull();
        expect(document.getElementById('setting-popup').hidden).toBe(false);
        expect(document.getElementById('setting-screen')).not.toBeNull();
        expect(document.querySelector('.setting-home-link').textContent).toBe('Close');
        expect(document.querySelector('.setting-home-link').getAttribute('href')).toBeNull();
        expect(document.getElementById('daily-word-count').innerText).toBe('15');

        document.querySelector('.setting-option[data-value="30"]').click();
        document.getElementById('setting-apply').click();

        expect(window.localStorage.getItem('pte.dailyWordCount')).toBe('30');
        expect(document.getElementById('setting-status').innerText).toBe('Applied.');

        document.getElementById('setting-popup-close').click();
        jest.advanceTimersByTime(200);

        expect(document.getElementById('setting-popup').hidden).toBe(true);
        expect(document.getElementById('home-screen')).not.toBeNull();
    });

    test('loads setting.html with daily word count settings', async () => {
        await loadPage('2026-06-23T12:00:00+08:00', 'pages/setting.html');

        expectFetchedPath('partials/common/header.html');
        expectFetchedPath('partials/common/auth-modal.html');
        expectFetchedPath('partials/setting/setting.html');
        expect(document.getElementById('setting-screen')).not.toBeNull();
        expect(document.getElementById('setting-title').textContent).toBe('Setting Page');
        expect(document.querySelector('.setting-home-link').getAttribute('href')).toBe('../index.html');
        expect(document.getElementById('daily-word-count').innerText).toBe('15');
        expect(document.getElementById('daily-word-count-options').hidden).toBe(true);
        expect([...document.querySelectorAll('.setting-option')].map((option) => option.dataset.value)).toEqual([
            '15',
            '16',
            '17',
            '18',
            '19',
            '20',
            '21',
            '22',
            '23',
            '24',
            '25',
            '26',
            '27',
            '28',
            '29',
            '30',
        ]);
        expect(document.getElementById('auth-open-sign-in')).not.toBeNull();
        expect(document.getElementById('home-screen')).toBeNull();

        document.getElementById('daily-word-count').click();
        expect(document.getElementById('daily-word-count-options').hidden).toBe(false);
        document.querySelector('.setting-option[data-value="30"]').click();
        document.getElementById('setting-apply').click();

        expect(window.localStorage.getItem('pte.dailyWordCount')).toBe('30');
        expect(document.getElementById('setting-status').innerText).toBe('Applied.');

        document.querySelector('.setting-option[data-value="16"]').click();
        document.getElementById('setting-apply').click();

        expect(window.localStorage.getItem('pte.dailyWordCount')).toBe('16');
    });

    test('falls back to 15 when saved daily word count is invalid', async () => {
        window.localStorage.setItem('pte.dailyWordCount', '99');

        await loadPage('2026-06-23T12:00:00+08:00', 'pages/setting.html');

        expect(document.getElementById('daily-word-count').innerText).toBe('15');
    });

    test('uses the saved daily word count on the review page', async () => {
        window.localStorage.setItem('pte.dailyWordCount', '30');

        await loadReviewPage('2026-06-23T12:00:00+08:00');

        expect(window.__getDailyWords()).toHaveLength(30);
        expect(document.getElementById('card-index').innerText).toContain('1 / 30');
    });

    test('asks signed-out users to sign in before starting the quiz', async () => {
        mockFirebaseEnabled = true;
        mockAuthUser = null;

        await loadQuizPage();

        expectFetchedPath('partials/quiz/quiz.html');
        expectNotFetchedPath('partials/home/home.html');
        expectNotFetchedPath('partials/review/quiz.html');
        expect(document.getElementById('home-screen')).toBeNull();
        expect(document.getElementById('quiz-gate')).not.toBeNull();
        expect(document.getElementById('quiz-gate').hidden).toBe(false);
        expect(document.getElementById('quiz-gate-message').innerText).toBe('Please sign in to start today quiz.');
        expect(document.getElementById('quiz-box').hidden).toBe(true);
        expect(window.__getDailyWords()).toHaveLength(0);
        expect(document.getElementById('quiz-reset-attempt').disabled).toBe(true);
        expect(quizAttemptSetMock).not.toHaveBeenCalled();
    });

    test('loads quiz.html as a signed-in daily quiz with practice-style card front and simple back', async () => {
        mockFirebaseEnabled = true;

        await loadQuizPage('2026-06-23T12:00:00+08:00');
        await waitForQuizUi();

        expectFetchedPath('partials/quiz/quiz.html');
        expect(document.getElementById('quiz-box').hidden).toBe(false);
        expect(document.getElementById('quiz-result-box').hidden).toBe(true);
        expect(window.__getDailyWords()).toHaveLength(15);
        expect(document.getElementById('card-index').innerText).toContain('1 / 15');
        expect(document.getElementById('word-meaning')).not.toBeNull();
        expect(document.getElementById('word-example')).not.toBeNull();
        expect(document.getElementById('word-family')).toBeNull();
        expect(document.getElementById('word-collocations')).toBeNull();
        expect(document.querySelector('.deck-switcher')).toBeNull();
    });

    test('saves the completed daily quiz and shows rounded score with analysis', async () => {
        mockFirebaseEnabled = true;

        await loadQuizPage('2026-06-23T12:00:00+08:00');
        await waitForQuizUi();

        const totalCount = window.__getDailyWords().length;
        for (let i = 0; i < totalCount; i++) {
            document.getElementById(i === 0 ? 'mark-wrong' : 'mark-right').click();
            jest.advanceTimersByTime(200);
            await Promise.resolve();
            await Promise.resolve();
        }

        await waitForQuizResult();

        expect(quizAttemptSetMock).toHaveBeenCalledWith('2026-06-23', expect.objectContaining({
            date: '2026-06-23',
            totalCount: 15,
            correctCount: 14,
            score: 93,
            completedAt: 'SERVER_TIME',
        }));
        expect(quizAttemptSetMock.mock.calls[0][1].answers).toHaveLength(15);
        expect(document.getElementById('quiz-score').innerText).toBe('93 points');
        expect(document.getElementById('quiz-result-note').innerText).toBe('14 / 15 correct');
        expect(document.querySelectorAll('#quiz-analysis-list .quiz-analysis-item')).toHaveLength(15);
        expect(document.querySelector('#quiz-analysis-list .quiz-analysis-wrong')).not.toBeNull();
        expect(document.getElementById('review-again')).toBeNull();
    });

    test('shows an existing daily quiz attempt instead of allowing a retake', async () => {
        mockFirebaseEnabled = true;
        quizAttemptStore.set('2026-06-23', {
            date: '2026-06-23',
            totalCount: 15,
            correctCount: 14,
            score: 93,
            completedAt: 'SERVER_TIME',
            answers: [{
                id: 1,
                w: 'analyze',
                pos: 'v.',
                m: 'study carefully',
                e: 'We **analyze** the result.',
                isRight: true,
            }],
        });

        await loadQuizPage('2026-06-23T12:00:00+08:00');
        await waitForQuizResult();

        expect(document.getElementById('quiz-box').hidden).toBe(true);
        expect(document.getElementById('quiz-score').innerText).toBe('93 points');
        expect(document.getElementById('quiz-result-note').innerText).toBe('14 / 15 correct');
        expect(document.querySelectorAll('#quiz-analysis-list .quiz-analysis-item')).toHaveLength(1);
        expect(document.querySelector('#quiz-analysis-list').textContent).toContain('analyze');
        expect(window.__getDailyWords()).toHaveLength(0);
        expect(quizAttemptSetMock).not.toHaveBeenCalled();
    });

    test('reset button clears today quiz attempt and starts a new quiz', async () => {
        mockFirebaseEnabled = true;
        quizAttemptStore.set('2026-06-23', {
            date: '2026-06-23',
            totalCount: 15,
            correctCount: 14,
            score: 93,
            completedAt: 'SERVER_TIME',
            answers: [{
                id: 1,
                w: 'analyze',
                pos: 'v.',
                m: 'study carefully',
                e: 'We **analyze** the result.',
                isRight: true,
            }],
        });

        await loadQuizPage('2026-06-23T12:00:00+08:00');
        await waitForQuizResult();

        document.getElementById('quiz-reset-attempt').click();
        await Promise.resolve();
        await Promise.resolve();
        jest.advanceTimersByTime(200);
        await Promise.resolve();
        await waitForQuizUi();

        expect(quizAttemptDeleteMock).toHaveBeenCalledWith('2026-06-23');
        expect(document.getElementById('quiz-result-box').hidden).toBe(true);
        expect(document.getElementById('quiz-box').hidden).toBe(false);
        expect(window.__getDailyWords()).toHaveLength(15);
        expect(document.getElementById('quiz-reset-status').innerText).toBe('Today quiz has been reset.');
    });

    test('loads practice.html as a separate page without the cover screen', async () => {
        await loadReviewPage();

        expectNotFetchedPath('partials/home/home.html');
        expect(document.getElementById('home-screen')).toBeNull();
        expect(document.getElementById('start-review')).toBeNull();
        expect(document.getElementById('quiz-box')).not.toBeNull();
        expect(window.__getDailyWords()).toHaveLength(15);
    });

    test('hides the favorite star on review cards when the user is not signed in', async () => {
        await loadReviewPage();

        expect(document.getElementById('favorite-toggle').hidden).toBe(true);
    });

    test('toggles the current review word in Firestore without flipping the card', async () => {
        mockFirebaseEnabled = true;
        await loadReviewPage();

        const currentWord = window.__getDailyWords()[0];
        const favoriteButton = document.getElementById('favorite-toggle');
        const wordCard = document.getElementById('word-card');

        expect(favoriteButton.hidden).toBe(false);
        expect(favoriteButton.getAttribute('aria-pressed')).toBe('false');
        expect(favoriteButton.getAttribute('aria-label')).toBe('Add to favorites');

        favoriteButton.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(wordCard.classList.contains('flipped')).toBe(false);
        expect(favoriteSetMock).toHaveBeenCalledWith(String(currentWord.id), expect.objectContaining({
            id: currentWord.id,
            w: currentWord.w,
            m: currentWord.m,
            e: currentWord.e,
            createdAt: 'SERVER_TIME',
        }));
        expect(favoriteButton.getAttribute('aria-pressed')).toBe('true');
        expect(favoriteButton.getAttribute('aria-label')).toBe('Remove from favorites');
        expect(document.getElementById('favorite-status').innerText).toBe('Added to favorites.');

        favoriteButton.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(favoriteDeleteMock).toHaveBeenCalledWith(String(currentWord.id));
        expect(favoriteButton.getAttribute('aria-pressed')).toBe('false');
        expect(favoriteButton.getAttribute('aria-label')).toBe('Add to favorites');
        expect(document.getElementById('favorite-status').innerText).toBe('Removed from favorites.');
    });

    test('loads favorites.html and asks signed-out users to sign in', async () => {
        mockFirebaseEnabled = true;
        mockAuthUser = null;

        await loadFavoritesPage();

        expectFetchedPath('partials/favorites/favorites.html');
        expect(document.getElementById('favorites-screen')).not.toBeNull();
        expect(document.getElementById('favorites-status').innerText).toBe('Please sign in to view favorites.');
        expect(document.querySelectorAll('#favorites-list .favorite-item')).toHaveLength(0);
    });

    test('lists favorite words for the signed-in user and removes one', async () => {
        mockFirebaseEnabled = true;
        favoriteStore.set('7', {
            id: 7,
            w: 'analyze',
            pos: 'v.',
            m: '分析',
            e: 'We analyze the result.',
            wordFamily: [{ term: 'analysis', explanation: '分析' }],
            collocations: [{ term: 'analyze data', explanation: '分析資料' }],
        });

        await loadFavoritesPage();

        expect(document.getElementById('favorites-status').innerText).toBe('1 favorite word.');
        expect(document.querySelector('.favorite-item h2').innerText).toBe('analyze');
        expect(document.querySelector('.favorite-meaning').innerText).toBe('分析');
        expect(document.querySelector('.favorite-details-toggle').open).toBe(false);
        expect(document.querySelector('.favorite-example').innerText).toBe('We analyze the result.');

        document.querySelector('.favorite-details-toggle').open = true;
        expect(document.querySelector('.favorite-details-toggle').open).toBe(true);

        document.querySelector('.favorite-remove').click();
        await Promise.resolve();
        await Promise.resolve();

        expect(favoriteDeleteMock).toHaveBeenCalledWith('7');
        expect(document.getElementById('favorites-status').innerText).toBe('No favorite words yet.');
    });

    test('renders bold markers in examples as strong text', async () => {
        await loadReviewPage();

        const currentWord = window.__getDailyWords()[0];
        const boldExampleWord = document.querySelector('#word-example strong');

        expect(boldExampleWord).not.toBeNull();
        expect(boldExampleWord.textContent).toBe(currentWord.w);
        expect(document.getElementById('word-example').textContent).not.toContain('**');
    });

    test('renders example words as clickable lookup targets and keeps bold target word', async () => {
        await loadReviewPage();

        const currentWord = window.__getDailyWords()[0];
        const lookupWords = [...document.querySelectorAll('#word-example .example-word')];
        const boldExampleWord = document.querySelector('#word-example strong .example-word');

        expect(lookupWords.map((button) => button.innerText)).toEqual([
            'This',
            'is',
            currentWord.w,
            'in',
            'an',
            'example',
        ]);
        expect(boldExampleWord).not.toBeNull();
        expect(boldExampleWord.textContent).toBe(currentWord.w);
        expect(document.getElementById('word-example').textContent).not.toContain('**');
    });

    test('looks up an example word in a popup without changing the local meaning', async () => {
        await loadReviewPage();

        const originalMeaning = document.getElementById('word-meaning').innerText;
        const lookupWord = document.querySelector('#word-example .example-word');
        lookupWord.click();
        await flushLookup();

        const lookupUrl = window.fetch.mock.calls.find(([url]) => String(url).startsWith('https://api.mymemory.translated.net/get'))[0];
        const popup = document.getElementById('lookup-popup');

        expect(lookupUrl).toContain('q=This');
        expect(lookupUrl).toContain('langpair=en|zh-TW');
        expect(popup.hidden).toBe(false);
        expect(popup.textContent).toContain('This: 線上翻譯');
        expect(document.getElementById('word-meaning').innerText).toBe(originalMeaning);
    });

    test('prefers Traditional Chinese lookup matches over non-Chinese API response text', async () => {
        await loadReviewPage();
        window.fetch.mockImplementation((url) => {
            const urlString = String(url);
            const relativeLocalPath = urlString.startsWith('file:')
                ? path.relative(PROJECT_ROOT, fileURLToPath(urlString)).replace(/\\/g, '/')
                : urlString;
            if (relativeLocalPath === 'pte_vocab.json') {
                return Promise.resolve({
                    ok: true,
                    json: jest.fn().mockResolvedValue(mockVocab),
                });
            }

            return Promise.resolve({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    responseData: {
                        translatedText: 'บ่อยครั้ง',
                    },
                    matches: [
                        { translation: 'บ่อยครั้ง', target: 'zh-TW' },
                        { translation: '經常', target: 'zh-TW' },
                    ],
                }),
            });
        });

        await window.__lookupExampleWordMeaning(
            'often',
            document.querySelector('#word-example .example-word')
        );

        expect(document.getElementById('lookup-popup').textContent).toContain('often: 經常');
        expect(document.getElementById('lookup-popup').textContent).not.toContain('บ่อยครั้ง');
    });

    test('uses local vocabulary meanings before calling the online lookup API', async () => {
        await loadReviewPage();

        const fetchCountAfterLoad = window.fetch.mock.calls.length;
        await window.__lookupExampleWordMeaning(
            'word1',
            document.querySelector('#word-example .example-word')
        );

        expect(window.fetch).toHaveBeenCalledTimes(fetchCountAfterLoad);
        expect(document.getElementById('lookup-popup').textContent).toContain('word1: meaning1');
    });

    test('shows a quota-specific message when the lookup API limit is reached', async () => {
        await loadReviewPage();
        window.fetch.mockImplementation((url) => {
            const urlString = String(url);
            const relativeLocalPath = urlString.startsWith('file:')
                ? path.relative(PROJECT_ROOT, fileURLToPath(urlString)).replace(/\\/g, '/')
                : urlString;
            if (relativeLocalPath === 'pte_vocab.json') {
                return Promise.resolve({
                    ok: true,
                    json: jest.fn().mockResolvedValue(mockVocab),
                });
            }

            return Promise.resolve({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    quotaFinished: true,
                    responseStatus: 429,
                    responseDetails: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY',
                }),
            });
        });

        await window.__lookupExampleWordMeaning(
            'often',
            document.querySelector('#word-example .example-word')
        );

        expect(document.getElementById('lookup-popup').textContent).toContain('Lookup quota reached. Please try again later.');
    });

    test('shows a lookup error when the online translation request fails', async () => {
        await loadReviewPage();
        window.fetch.mockImplementation((url) => {
            if (url === 'pte_vocab.json') {
                return Promise.resolve({
                    ok: true,
                    json: jest.fn().mockResolvedValue(mockVocab),
                });
            }

            return Promise.resolve({
                ok: false,
                json: jest.fn(),
            });
        });

        document.querySelector('#word-example .example-word').click();
        await flushLookup();

        expect(document.getElementById('lookup-popup').textContent).toContain('Lookup failed. Please try again later.');
    });

    test('reuses cached lookup results for the same example word', async () => {
        await loadReviewPage();

        const lookupWord = document.querySelector('#word-example .example-word');
        lookupWord.click();
        await flushLookup();

        const fetchCountAfterFirstLookup = window.fetch.mock.calls.length;
        document.body.click();
        lookupWord.click();
        await flushLookup();

        expect(window.fetch).toHaveBeenCalledTimes(fetchCountAfterFirstLookup);
        expect(document.getElementById('lookup-popup').textContent).toContain('This: 線上翻譯');
    });

    test('closes the lookup popup when moving to the next word', async () => {
        await loadReviewPage();

        document.querySelector('#word-example .example-word').click();
        await flushLookup();
        expect(document.getElementById('lookup-popup').hidden).toBe(false);

        window.__nextWord(false);

        expect(document.getElementById('lookup-popup').hidden).toBe(true);
    });

    test('speaks the current word from the audio button', async () => {
        await loadReviewPage();

        const currentWord = window.__getDailyWords()[0];
        document.getElementById('speak-word').click();

        expect(window.speechSynthesis.cancel).toHaveBeenCalled();
        expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
        expect(window.speechSynthesis.speak.mock.calls[0][0].text).toBe(currentWord.w);
        expect(window.speechSynthesis.speak.mock.calls[0][0].lang).toBe('en-US');
        expect(window.speechSynthesis.speak.mock.calls[0][0].voice.name).toBe('Google US English');
    });

    test('lets the user choose a voice from the selector', async () => {
        await loadReviewPage();

        const voiceSelect = document.getElementById('voice-select');
        expect([...voiceSelect.options].map((option) => option.value)).toEqual([
            'Microsoft David Desktop',
            'Google US English',
        ]);
        expect(voiceSelect.value).toBe('Google US English');

        voiceSelect.value = 'Microsoft David Desktop';
        voiceSelect.dispatchEvent(new Event('change'));
        document.getElementById('speak-word').click();

        expect(window.speechSynthesis.speak.mock.calls[0][0].voice.name).toBe('Microsoft David Desktop');
    });

    test('updates the voice selector after voices load late', async () => {
        mockVoices = [];
        await loadReviewPage();

        const voiceSelect = document.getElementById('voice-select');
        expect(voiceSelect.value).toBe('');
        expect(voiceSelect.options[0].innerText).toBe('Use browser default voice');

        mockVoices = [{ name: 'Google US English', lang: 'en-US' }];
        window.speechSynthesis.onvoiceschanged();
        jest.advanceTimersByTime(250);
        await Promise.resolve();

        expect(voiceSelect.value).toBe('Google US English');
        expect(voiceSelect.disabled).toBe(false);
    });

    test('reopening the page reshuffles the same 15 daily words for the same day', async () => {
        const randomSpy = jest.spyOn(Math, 'random');

        try {
            randomSpy.mockImplementation(() => 0);
            await loadReviewPage('2026-06-23T12:00:00+08:00');
            const firstOpenWordIds = window.__getDailyWords().map((word) => word.id);

            document.documentElement.innerHTML = '';

            randomSpy.mockImplementation(() => 0.999);
            await loadReviewPage('2026-06-23T20:30:00+08:00');
            const secondOpenWordIds = window.__getDailyWords().map((word) => word.id);

            expect(secondOpenWordIds).toHaveLength(firstOpenWordIds.length);
            expect(sortIds(secondOpenWordIds)).toEqual(sortIds(firstOpenWordIds));
            expect(secondOpenWordIds).not.toEqual(firstOpenWordIds);
        } finally {
            randomSpy.mockRestore();
        }
    });

    test('switching decks preserves each deck order and progress during the same page session', async () => {
        await loadReviewPage('2026-06-23T12:00:00+08:00');

        const todayWordIds = sortIds(window.__getDailyWords().map((word) => word.id));
        expect(document.getElementById('today-date').innerText).toBe('2026-06-23');
        expect(window.__getActiveDeckKey()).toBe('2026-06-23');

        document.getElementById('mark-wrong').click();
        await Promise.resolve();
        await Promise.resolve();
        jest.advanceTimersByTime(200);
        await Promise.resolve();
        expect(window.__getCurrentIndex()).toBe(1);
        expect(document.querySelectorAll('#review-list button')).toHaveLength(1);

        document.getElementById('deck-yesterday').click();
        await Promise.resolve();
        await Promise.resolve();
        jest.advanceTimersByTime(200);
        await Promise.resolve();
        await waitForActiveDeckKey('2026-06-22');

        const yesterdayWordIds = sortIds(window.__getDailyWords().map((word) => word.id));

        expect(document.getElementById('today-date').innerText).toBe('2026-06-22');
        expect(yesterdayWordIds).toHaveLength(15);
        expect(window.__getActiveDeckKey()).toBe('2026-06-22');
        expect(window.__getCurrentIndex()).toBe(0);
        expect(document.querySelectorAll('#review-list button')).toHaveLength(0);

        document.getElementById('mark-right').click();
        await Promise.resolve();
        await Promise.resolve();
        jest.advanceTimersByTime(200);
        await Promise.resolve();
        expect(window.__getCurrentIndex()).toBe(1);

        document.getElementById('deck-today').click();
        await Promise.resolve();
        await Promise.resolve();
        jest.advanceTimersByTime(200);
        await Promise.resolve();
        await waitForActiveDeckKey('2026-06-23');

        expect(window.__getActiveDeckKey()).toBe('2026-06-23');
        expect(sortIds(window.__getDailyWords().map((word) => word.id))).toEqual(todayWordIds);
        expect(window.__getCurrentIndex()).toBe(1);
        expect(document.getElementById('card-index').innerText).toContain('2 / 15');
        expect(document.querySelectorAll('#review-list button')).toHaveLength(1);

        document.getElementById('deck-yesterday').click();
        await Promise.resolve();
        await Promise.resolve();
        jest.advanceTimersByTime(200);
        await Promise.resolve();
        await waitForActiveDeckKey('2026-06-22');

        expect(window.__getActiveDeckKey()).toBe('2026-06-22');
        expect(sortIds(window.__getDailyWords().map((word) => word.id))).toEqual(yesterdayWordIds);
        expect(window.__getCurrentIndex()).toBe(1);
        expect(document.getElementById('card-index').innerText).toContain('2 / 15');
        expect(document.querySelectorAll('#review-list button')).toHaveLength(1);

        expect(yesterdayWordIds).not.toEqual(todayWordIds);
    });

    test('review again reshuffles the same 15 words and restarts the deck', async () => {
        await loadReviewPage('2026-06-23T12:00:00+08:00');

        const initialWordIds = window.__getDailyWords().map((word) => word.id);

        for (let i = 0; i < initialWordIds.length; i++) {
            window.__nextWord(i % 2 === 0);
            jest.advanceTimersByTime(200);
            await Promise.resolve();
        }

        expect(document.getElementById('result-box').hidden).toBe(false);
        expect(document.getElementById('review-again')).not.toBeNull();
        expect(window.__getCurrentIndex()).toBe(initialWordIds.length);

        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
        try {
            document.getElementById('review-again').click();
            await Promise.resolve();
            jest.advanceTimersByTime(200);
            await Promise.resolve();
        } finally {
            randomSpy.mockRestore();
        }

        expect(document.getElementById('result-box').hidden).toBe(true);
        expect(window.__getCurrentIndex()).toBe(0);
        const reshuffledWordIds = window.__getDailyWords().map((word) => word.id);
        expect(reshuffledWordIds).toHaveLength(initialWordIds.length);
        expect(reshuffledWordIds).not.toEqual(initialWordIds);
        expect(sortIds(reshuffledWordIds)).toEqual(sortIds(initialWordIds));
        expect(document.getElementById('card-index').innerText).toContain('1 / 15');
        expect(document.querySelectorAll('#review-list button')).toHaveLength(0);
    });

    test('shows the last reviewed word on the result screen', async () => {
        await loadReviewPage('2026-06-23T12:00:00+08:00');

        const dailyWordIds = window.__getDailyWords().map((word) => word.id);
        const lastWord = window.__getDailyWords()[dailyWordIds.length - 1];

        for (let i = 0; i < dailyWordIds.length - 1; i++) {
            window.__nextWord(true);
            jest.advanceTimersByTime(200);
            await Promise.resolve();
        }

        expect(document.querySelectorAll('#review-list button')).toHaveLength(dailyWordIds.length - 1);

        window.__nextWord(true);
        jest.advanceTimersByTime(200);
        await Promise.resolve();

        const reviewButtons = [...document.querySelectorAll('#review-list button')];
        expect(reviewButtons).toHaveLength(dailyWordIds.length);
        expect(reviewButtons.map((button) => button.innerText)).toContain(lastWord.w);
        expect(document.getElementById('result-box').hidden).toBe(false);
    });

    test('can jump back to a reviewed word from the result screen', async () => {
        await loadReviewPage('2026-06-23T12:00:00+08:00');

        const firstWord = window.__getDailyWords()[0];
        const reviewCount = window.__getDailyWords().length;

        for (let i = 0; i < reviewCount; i++) {
            window.__nextWord(true);
            jest.advanceTimersByTime(200);
            await Promise.resolve();
        }

        const reviewButtons = [...document.querySelectorAll('#review-list button')];
        expect(document.getElementById('result-box').hidden).toBe(false);
        expect(reviewButtons).toHaveLength(reviewCount);

        reviewButtons[0].click();
        jest.advanceTimersByTime(200);
        await Promise.resolve();

        expect(document.getElementById('result-box').hidden).toBe(true);
        expect(window.__getCurrentIndex()).toBe(0);
        expect(document.getElementById('word-target').innerText).toBe(firstWord.w);
        expect(document.getElementById('card-index').innerText).toContain('1 / 15');
    });

    test('revising an answer after result still keeps the result screen usable', async () => {
        await loadReviewPage('2026-06-23T12:00:00+08:00');

        const totalCount = window.__getDailyWords().length;

        for (let i = 0; i < totalCount; i++) {
            window.__nextWord(true);
            jest.advanceTimersByTime(200);
            await Promise.resolve();
        }

        expect(document.getElementById('result-box').hidden).toBe(false);
        expect(document.getElementById('result-note').innerText).toContain('2026-06-23');

        const reviewButtons = [...document.querySelectorAll('#review-list button')];
        reviewButtons[0].click();
        jest.advanceTimersByTime(200);
        await Promise.resolve();

        expect(window.__getCurrentIndex()).toBe(0);
        window.__nextWord(false);
        jest.advanceTimersByTime(200);
        await Promise.resolve();

        for (let i = 1; i < totalCount; i++) {
            window.__nextWord(true);
            jest.advanceTimersByTime(200);
            await Promise.resolve();
        }

        expect(document.getElementById('result-box').hidden).toBe(false);
        expect(document.getElementById('result-note').innerText).toContain('2026-06-23');
    });

    test('lists browsed words and lets the user jump back to one', async () => {
        await loadReviewPage();

        const firstWord = window.__getDailyWords()[0];
        const secondWord = window.__getDailyWords()[1];

        window.__nextWord(false);
        jest.advanceTimersByTime(200);
        await Promise.resolve();

        window.__nextWord(true);
        jest.advanceTimersByTime(200);
        await Promise.resolve();

        const reviewButtons = [...document.querySelectorAll('#review-list button')];
        expect(reviewButtons.map((button) => button.innerText)).toEqual([
            firstWord.w,
            secondWord.w,
        ]);
        expect(reviewButtons[0].classList.contains('review-wrong')).toBe(true);
        expect(reviewButtons[1].classList.contains('review-right')).toBe(true);
        expect(reviewButtons[0].innerText).not.toContain(firstWord.m);
        expect(reviewButtons[0].innerText).not.toContain(firstWord.e);

        reviewButtons[0].click();
        jest.advanceTimersByTime(200);
        await Promise.resolve();

        expect(window.__getCurrentIndex()).toBe(0);
        expect(document.getElementById('word-target').innerText).toBe(firstWord.w);
        expect(document.getElementById('card-index').innerText).toContain('1 / 15');
    });

    test('updates a browsed word color when the user answers it again', async () => {
        await loadReviewPage();

        window.__nextWord(false);
        jest.advanceTimersByTime(200);
        await Promise.resolve();

        let reviewButtons = [...document.querySelectorAll('#review-list button')];
        expect(reviewButtons).toHaveLength(1);
        expect(reviewButtons[0].classList.contains('review-wrong')).toBe(true);

        reviewButtons[0].click();
        jest.advanceTimersByTime(200);
        await Promise.resolve();

        window.__nextWord(true);
        jest.advanceTimersByTime(200);
        await Promise.resolve();

        reviewButtons = [...document.querySelectorAll('#review-list button')];
        expect(reviewButtons).toHaveLength(1);
        expect(reviewButtons[0].classList.contains('review-right')).toBe(true);
        expect(reviewButtons[0].classList.contains('review-wrong')).toBe(false);
    });

    test('real vocabulary json can load with array items', async () => {
        const jsonText = fs.readFileSync(path.resolve(PROJECT_ROOT, 'pte_vocab.json'), 'utf8');
        const data = JSON.parse(jsonText);

        expect(Array.isArray(data)).toBe(true);
        expect(data).toHaveLength(570);
        expect(Object.keys(data[0])).toEqual([
            'id',
            'word',
            'partOfSpeech',
            'definition',
            'example',
            'wordFamily',
            'collocations',
        ]);

        mockVocab = data;
        await loadReviewPage();

        expect(window.__getDailyWords()).toHaveLength(15);
        expect(Object.keys(window.__getDailyWords()[0])).toEqual(['id', 'w', 'pos', 'm', 'e', 'wordFamily', 'collocations']);
        expect(document.getElementById('word-target').innerText).not.toBe('Error');
    });
});

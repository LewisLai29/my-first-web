import { ensureFirebaseServices } from './firebase.js';

const HISTORY_LIMIT_PER_TYPE = 10;

function getCompletedTime(attempt) {
    const value = attempt && attempt.completedAt;
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (value && typeof value.toDate === 'function') return value.toDate().getTime();

    const parsedCompletedAt = Date.parse(value || '');
    if (Number.isFinite(parsedCompletedAt)) return parsedCompletedAt;

    const parsedDate = Date.parse(`${attempt?.date || ''}T00:00:00`);
    return Number.isFinite(parsedDate) ? parsedDate : 0;
}

function formatHistoryDate(attempt) {
    const value = attempt && attempt.completedAt;
    const date = value && typeof value.toDate === 'function'
        ? value.toDate()
        : new Date(value || `${attempt?.date || ''}T00:00:00`);

    if (Number.isNaN(date.getTime())) return attempt?.date || 'Unknown date';

    return new Intl.DateTimeFormat('en', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(date);
}

async function loadCollection(userDocument, collectionName, type, label) {
    const collection = userDocument.collection(collectionName);
    let query = collection;

    if (typeof query.orderBy === 'function') {
        query = query.orderBy('completedAt', 'desc');
    }
    if (typeof query.limit === 'function') {
        query = query.limit(HISTORY_LIMIT_PER_TYPE);
    }

    const snapshot = await query.get();
    const documents = snapshot && Array.isArray(snapshot.docs) ? snapshot.docs : [];

    return documents.map((documentSnapshot) => ({
        ...(documentSnapshot.data ? documentSnapshot.data() : {}),
        historyId: documentSnapshot.id,
        type,
        typeLabel: label,
    }));
}

export function createExamHistoryController(onChange = () => {}) {
    let services = null;
    let user = null;
    let history = [];
    let isLoading = false;
    let error = null;
    let authUnsubscribe = null;
    let initPromise = null;
    let loadSequence = 0;

    const notify = () => onChange({ user, history, isLoading, error });

    const refresh = async () => {
        const sequence = ++loadSequence;
        history = [];
        error = null;

        if (!services || !user) {
            isLoading = false;
            notify();
            return;
        }

        isLoading = true;
        notify();

        try {
            const userDocument = services.db.collection('users').doc(user.uid);
            const [vocabularyAttempts, clozeAttempts] = await Promise.all([
                loadCollection(userDocument, 'quizAttempts', 'vocabulary', 'Vocabulary Exam'),
                loadCollection(userDocument, 'examAttempts', 'cloze', 'Cloze Exam'),
            ]);

            if (sequence !== loadSequence) return;
            history = [...vocabularyAttempts, ...clozeAttempts]
                .sort((left, right) => getCompletedTime(right) - getCompletedTime(left))
                .slice(0, 10);
        } catch (loadError) {
            if (sequence !== loadSequence) return;
            console.error('Failed to load exam history.', loadError);
            error = loadError;
            history = [];
        } finally {
            if (sequence === loadSequence) {
                isLoading = false;
                notify();
            }
        }
    };

    const init = async () => {
        if (initPromise) return initPromise;

        initPromise = (async () => {
            services = await ensureFirebaseServices();
            if (!services) {
                notify();
                return;
            }

            authUnsubscribe = services.auth.onAuthStateChanged((nextUser) => {
                user = nextUser || null;
                refresh();
            });
        })();

        return initPromise;
    };

    const dispose = () => {
        if (authUnsubscribe) authUnsubscribe();
        services = null;
        user = null;
        history = [];
        isLoading = false;
        error = null;
        authUnsubscribe = null;
        initPromise = null;
        loadSequence++;
    };

    return {
        init,
        refresh,
        dispose,
        getState: () => ({ user, history, isLoading, error }),
    };
}

function createWrongAnswerItem(answer) {
    const item = document.createElement('li');
    const word = document.createElement('strong');
    word.textContent = answer.w || answer.correctWord || 'Unknown word';
    item.appendChild(word);

    if (answer.selectedWord) {
        const answerText = document.createElement('span');
        answerText.textContent = `Your answer: ${answer.selectedWord}; correct: ${answer.correctWord || answer.w}`;
        item.appendChild(answerText);
    }

    return item;
}

export function renderExamHistory({ user, history = [], isLoading = false, error = null } = {}) {
    const status = document.getElementById('exam-history-status');
    const list = document.getElementById('exam-history-list');
    if (!status || !list) return;

    list.replaceChildren();

    if (isLoading) {
        status.textContent = 'Loading exam history...';
        return;
    }
    if (!user) {
        status.textContent = 'Sign in to view your exam history.';
        return;
    }
    if (error) {
        status.textContent = 'Exam history could not be loaded. Please try again.';
        return;
    }
    if (history.length === 0) {
        status.textContent = 'No completed exams yet.';
        return;
    }

    status.textContent = `${history.length} recent result${history.length === 1 ? '' : 's'}`;
    history.forEach((attempt) => {
        const item = document.createElement('li');
        item.className = 'exam-history-item';

        const details = document.createElement('details');
        const summary = document.createElement('summary');
        const identity = document.createElement('span');
        const type = document.createElement('strong');
        const date = document.createElement('span');
        const score = document.createElement('span');

        type.textContent = attempt.typeLabel;
        date.textContent = formatHistoryDate(attempt);
        score.className = 'exam-history-score';
        score.textContent = `${Number(attempt.score) || 0} pts`;
        identity.append(type, date);
        summary.append(identity, score);

        const correct = document.createElement('p');
        correct.className = 'exam-history-correct';
        correct.textContent = `${Number(attempt.correctCount) || 0} / ${Number(attempt.totalCount) || 0} correct`;

        const wrongAnswers = (Array.isArray(attempt.answers) ? attempt.answers : [])
            .filter((answer) => !answer.isRight);
        const wrongList = document.createElement('ul');
        wrongList.className = 'exam-history-wrong-list';

        if (wrongAnswers.length === 0) {
            const perfect = document.createElement('li');
            perfect.textContent = 'Perfect score — no wrong answers.';
            wrongList.appendChild(perfect);
        } else {
            wrongAnswers.forEach((answer) => wrongList.appendChild(createWrongAnswerItem(answer)));
        }

        details.append(summary, correct, wrongList);
        item.appendChild(details);
        list.appendChild(item);
    });
}

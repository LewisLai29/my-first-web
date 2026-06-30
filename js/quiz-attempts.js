import { ensureFirebaseServices } from './firebase.js';

function getCompletedAtValue() {
    return window.firebase
        && window.firebase.firestore
        && window.firebase.firestore.FieldValue
        && window.firebase.firestore.FieldValue.serverTimestamp
        ? window.firebase.firestore.FieldValue.serverTimestamp()
        : new Date().toISOString();
}

export function createQuizAttemptsController(onChange = () => {}) {
    let services = null;
    let user = null;
    let attempt = null;
    let isReady = false;
    let authUnsubscribe = null;
    let initPromise = null;
    let activeDate = '';
    let loadSequence = 0;

    const notify = () => onChange({
        user,
        attempt,
        isReady,
    });

    const getAttemptDocument = (dateString = activeDate) => {
        if (!services || !user || !dateString) return null;
        return services.db
            .collection('users')
            .doc(user.uid)
            .collection('quizAttempts')
            .doc(dateString);
    };

    const loadAttempt = async (dateString) => {
        const sequence = ++loadSequence;
        activeDate = dateString;
        attempt = null;
        isReady = false;
        notify();

        if (!services || !user) {
            isReady = true;
            notify();
            return;
        }

        try {
            const documentRef = getAttemptDocument(dateString);
            const snapshot = documentRef && typeof documentRef.get === 'function'
                ? await documentRef.get()
                : null;

            if (sequence !== loadSequence) return;

            attempt = snapshot && snapshot.exists ? snapshot.data() : null;
        } catch (error) {
            console.error('Failed to load quiz attempt.', error);
            if (sequence !== loadSequence) return;
            attempt = null;
        } finally {
            if (sequence === loadSequence) {
                isReady = true;
                notify();
            }
        }
    };

    const init = async (dateString) => {
        activeDate = dateString;

        if (initPromise) {
            await initPromise;
            if (services) {
                await loadAttempt(dateString);
            }
            return initPromise;
        }

        initPromise = (async () => {
            services = await ensureFirebaseServices();
            if (!services) {
                isReady = true;
                notify();
                return;
            }

            authUnsubscribe = services.auth.onAuthStateChanged((nextUser) => {
                user = nextUser || null;
                loadAttempt(activeDate);
            });
        })();

        return initPromise;
    };

    const saveAttempt = async (attemptData) => {
        if (!services || !user || !attemptData) {
            throw new Error('Sign in is required to save a quiz attempt.');
        }

        const data = {
            ...attemptData,
            completedAt: getCompletedAtValue(),
        };

        const documentRef = getAttemptDocument(attemptData.date);
        if (documentRef && typeof documentRef.get === 'function') {
            const existingSnapshot = await documentRef.get();
            if (existingSnapshot && existingSnapshot.exists) {
                attempt = existingSnapshot.data();
                isReady = true;
                notify();
                return attempt;
            }
        }

        await documentRef.set(data);
        attempt = data;
        isReady = true;
        notify();
        return data;
    };

    const resetAttempt = async (dateString = activeDate) => {
        if (!services || !user || !dateString) {
            throw new Error('Sign in is required to reset a quiz attempt.');
        }

        const documentRef = getAttemptDocument(dateString);
        await documentRef.delete();
        attempt = null;
        isReady = true;
        notify();
    };

    const dispose = () => {
        if (authUnsubscribe) {
            authUnsubscribe();
            authUnsubscribe = null;
        }

        services = null;
        user = null;
        attempt = null;
        isReady = false;
        initPromise = null;
        activeDate = '';
        loadSequence++;
    };

    return {
        init,
        dispose,
        saveAttempt,
        resetAttempt,
        getUser: () => user,
        getAttempt: () => attempt,
        isReady: () => isReady,
    };
}

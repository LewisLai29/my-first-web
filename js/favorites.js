import { ensureFirebaseServices } from './firebase.js';

function getFavoriteId(word) {
    const rawId = word?.id ?? word?.w;
    return encodeURIComponent(String(rawId || '').trim().toLowerCase());
}

function toFavoriteData(word) {
    return {
        id: word.id,
        w: word.w,
        pos: word.pos || '',
        m: word.m || '',
        e: word.e || '',
        wordFamily: Array.isArray(word.wordFamily) ? word.wordFamily : [],
        collocations: Array.isArray(word.collocations) ? word.collocations : [],
    };
}

function getCreatedAtValue() {
    return window.firebase?.firestore?.FieldValue?.serverTimestamp
        ? window.firebase.firestore.FieldValue.serverTimestamp()
        : new Date().toISOString();
}

export function createFavoritesController(onChange = () => {}) {
    let services = null;
    let user = null;
    let favorites = new Map();
    let authUnsubscribe = null;
    let favoritesUnsubscribe = null;
    let initPromise = null;

    const notify = () => onChange({
        user,
        favorites: [...favorites.values()],
    });

    const clearFavoritesListener = () => {
        if (favoritesUnsubscribe) {
            favoritesUnsubscribe();
            favoritesUnsubscribe = null;
        }
    };

    const getCollection = () => {
        if (!services || !user) return null;
        return services.db.collection('users').doc(user.uid).collection('favorites');
    };

    const watchFavorites = () => {
        clearFavoritesListener();
        favorites = new Map();

        const collection = getCollection();
        if (!collection) {
            notify();
            return;
        }

        favoritesUnsubscribe = collection.onSnapshot((snapshot) => {
            const nextFavorites = new Map();
            snapshot.forEach((documentSnapshot) => {
                const data = documentSnapshot.data();
                nextFavorites.set(documentSnapshot.id, {
                    ...data,
                    favoriteId: documentSnapshot.id,
                });
            });
            favorites = nextFavorites;
            notify();
        }, (error) => {
            console.error('Failed to load favorites.', error);
            notify();
        });
    };

    const init = async () => {
        if (initPromise) {
            await initPromise;
            if (services) return;
            initPromise = null;
        }

        initPromise = (async () => {
            services = await ensureFirebaseServices();
            if (!services) {
                notify();
                return;
            }

            authUnsubscribe = services.auth.onAuthStateChanged((nextUser) => {
                user = nextUser || null;
                watchFavorites();
            });
        })();

        return initPromise;
    };

    const hasFavorite = (word) => favorites.has(getFavoriteId(word));

    const toggleFavorite = async (word) => {
        if (!services || !user || !word) return false;

        const favoriteId = getFavoriteId(word);
        if (!favoriteId) return false;

        const documentRef = getCollection().doc(favoriteId);
        const previousFavorite = favorites.get(favoriteId);
        if (previousFavorite) {
            favorites.delete(favoriteId);
            notify();

            try {
                await documentRef.delete();
                return false;
            } catch (error) {
                favorites.set(favoriteId, previousFavorite);
                notify();
                throw error;
            }
        }

        const favoriteData = {
            ...toFavoriteData(word),
            createdAt: getCreatedAtValue(),
        };
        favorites.set(favoriteId, {
            ...favoriteData,
            favoriteId,
        });
        notify();

        try {
            await documentRef.set(favoriteData);
            return true;
        } catch (error) {
            favorites.delete(favoriteId);
            notify();
            throw error;
        }
    };

    const removeFavorite = async (favorite) => {
        if (!services || !user || !favorite) return;

        const favoriteId = favorite.favoriteId || getFavoriteId(favorite);
        if (!favoriteId) return;

        await getCollection().doc(favoriteId).delete();
    };

    const dispose = () => {
        clearFavoritesListener();
        if (authUnsubscribe) {
            authUnsubscribe();
            authUnsubscribe = null;
        }
        services = null;
        user = null;
        favorites = new Map();
        initPromise = null;
    };

    return {
        init,
        dispose,
        hasFavorite,
        toggleFavorite,
        removeFavorite,
        getUser: () => user,
        getFavorites: () => [...favorites.values()],
    };
}

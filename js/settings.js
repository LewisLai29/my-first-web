export const DEFAULT_DAILY_WORD_COUNT = 15;
export const DAILY_WORD_COUNT_STORAGE_KEY = 'pte.dailyWordCount';
export const CLOZE_ENDLESS_MODE_STORAGE_KEY = 'pte.clozeEndlessMode';
export const DAILY_WORD_COUNT_OPTIONS = Array.from(
    { length: 16 },
    (_, index) => DEFAULT_DAILY_WORD_COUNT + index
);

export function normalizeDailyWordCount(value) {
    const count = Number(value);
    if (!Number.isInteger(count) || !DAILY_WORD_COUNT_OPTIONS.includes(count)) {
        return DEFAULT_DAILY_WORD_COUNT;
    }

    return count;
}

export function getDailyWordCount() {
    try {
        return normalizeDailyWordCount(window.localStorage.getItem(DAILY_WORD_COUNT_STORAGE_KEY));
    } catch {
        return DEFAULT_DAILY_WORD_COUNT;
    }
}

export function setDailyWordCount(value) {
    const count = normalizeDailyWordCount(value);
    try {
        window.localStorage.setItem(DAILY_WORD_COUNT_STORAGE_KEY, String(count));
    } catch {
        // Keep the UI usable when storage is unavailable.
    }

    return count;
}

export function getClozeEndlessMode() {
    try {
        return window.localStorage.getItem(CLOZE_ENDLESS_MODE_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

export function setClozeEndlessMode(enabled) {
    const isEnabled = Boolean(enabled);
    try {
        window.localStorage.setItem(CLOZE_ENDLESS_MODE_STORAGE_KEY, String(isEnabled));
    } catch {
        // Keep the UI usable when storage is unavailable.
    }

    return isEnabled;
}

export const HOME_HTML_FUNCTIONS = [
    new URL('../partials/common/header.html', import.meta.url).href,
    new URL('../partials/common/auth-modal.html', import.meta.url).href,
    new URL('../partials/home/home.html', import.meta.url).href,
];

export const FEATURE_HTML_FUNCTIONS = [
    new URL('../partials/common/header.html', import.meta.url).href,
    new URL('../partials/common/auth-modal.html', import.meta.url).href,
    new URL('../partials/practice/feature.html', import.meta.url).href,
];

export const REVIEW_HTML_FUNCTIONS = [
    new URL('../partials/common/header.html', import.meta.url).href,
    new URL('../partials/common/auth-modal.html', import.meta.url).href,
    new URL('../partials/review/quiz.html', import.meta.url).href,
    new URL('../partials/review/review-list.html', import.meta.url).href,
    new URL('../partials/review/result.html', import.meta.url).href,
    new URL('../partials/review/lookup-popup.html', import.meta.url).href,
];

export const HTML_FUNCTIONS = [
    ...HOME_HTML_FUNCTIONS,
    ...FEATURE_HTML_FUNCTIONS,
    ...REVIEW_HTML_FUNCTIONS,
];

export const DAILY_WORD_COUNT = 15;
export const VOCAB_SOURCE = new URL('../pte_vocab.json', import.meta.url).href;

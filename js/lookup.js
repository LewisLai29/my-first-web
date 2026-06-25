import { normalizeLookupWord } from './vocab.js';

function getLookupCacheKey(word) {
    return `example-meaning:${normalizeLookupWord(word)}`;
}

function getCachedOnlineMeaning(word) {
    try {
        return window.sessionStorage.getItem(getLookupCacheKey(word));
    } catch (error) {
        return null;
    }
}

function setCachedOnlineMeaning(word, meaning) {
    try {
        window.sessionStorage.setItem(getLookupCacheKey(word), meaning);
    } catch (error) {
        // Storage can be unavailable in private or restricted browser modes.
    }
}

function extractOnlineMeaning(data) {
    const candidates = [];
    if (Array.isArray(data && data.matches)) {
        data.matches.forEach((match) => {
            candidates.push(match && match.translation);
        });
    }
    candidates.push(data && data.responseData && data.responseData.translatedText);

    return candidates
        .map((candidate) => typeof candidate === 'string' ? candidate.trim() : '')
        .find((candidate) => /[\u3400-\u9fff]/.test(candidate))
        || '';
}

function isLookupQuotaError(data) {
    const details = String(data && data.responseDetails || '');
    return Boolean(
        data
        && (
            data.quotaFinished === true
            || data.responseStatus === 403
            || data.responseStatus === 429
            || /quota|limit|daily/i.test(details)
        )
    );
}

async function fetchOnlineMeaning(word) {
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh-TW`);
    let data = null;
    try {
        data = await response.json();
    } catch (error) {
        if (!response.ok) throw new Error('lookup failed');
        throw error;
    }

    if (isLookupQuotaError(data)) throw new Error('lookup quota finished');
    if (!response.ok || data.responseStatus >= 400) throw new Error('lookup failed');

    const meaning = extractOnlineMeaning(data);
    if (!meaning) throw new Error('empty lookup result');

    return meaning;
}

function positionLookupPopup(anchorElement) {
    const popup = document.getElementById('lookup-popup');
    if (!popup || !anchorElement) return;

    const margin = 12;
    const anchorRect = anchorElement.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

    let left = anchorRect.left + (anchorRect.width / 2) - (popupRect.width / 2);
    let top = anchorRect.bottom + 8;

    left = Math.max(margin, Math.min(left, viewportWidth - popupRect.width - margin));
    if (top + popupRect.height + margin > viewportHeight) {
        top = anchorRect.top - popupRect.height - 8;
    }
    top = Math.max(margin, top);

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
}

function renderLookupPopup(anchorElement, html) {
    const popup = document.getElementById('lookup-popup');
    if (!popup) return;

    popup.innerHTML = html;
    popup.hidden = false;
    positionLookupPopup(anchorElement);
}

function escapeHtml(text) {
    const span = document.createElement('span');
    span.textContent = String(text);
    return span.innerHTML;
}

export function hideLookupPopup() {
    const popup = document.getElementById('lookup-popup');
    if (!popup) return;

    popup.hidden = true;
    popup.innerHTML = '';
}

export function createLookupController(getLocalVocabMeaning) {
    async function lookupExampleWordMeaning(word, anchorElement, event) {
        if (event) {
            event.stopPropagation();
        }

        const lookupWord = String(word).trim();
        if (!lookupWord) return;

        const cachedMeaning = getCachedOnlineMeaning(lookupWord);
        if (cachedMeaning) {
            renderLookupPopup(anchorElement, `<span class="lookup-word">${escapeHtml(lookupWord)}</span>: ${escapeHtml(cachedMeaning)}`);
            return;
        }

        const localMeaning = getLocalVocabMeaning(lookupWord);
        if (localMeaning) {
            setCachedOnlineMeaning(lookupWord, localMeaning);
            renderLookupPopup(anchorElement, `<span class="lookup-word">${escapeHtml(lookupWord)}</span>: ${escapeHtml(localMeaning)}`);
            return;
        }

        renderLookupPopup(anchorElement, 'Looking up...');

        try {
            const meaning = await fetchOnlineMeaning(lookupWord);
            setCachedOnlineMeaning(lookupWord, meaning);
            renderLookupPopup(anchorElement, `<span class="lookup-word">${escapeHtml(lookupWord)}</span>: ${escapeHtml(meaning)}`);
        } catch (error) {
            const message = error && error.message === 'lookup quota finished'
                ? 'Lookup quota reached. Please try again later.'
                : 'Lookup failed. Please try again later.';
            renderLookupPopup(anchorElement, `<span class="lookup-error">${message}</span>`);
        }
    }

    function createLookupWordButton(word) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'example-word';
        button.textContent = word;
        button.innerText = word;
        button.setAttribute('aria-label', `Look up ${word}`);
        button.addEventListener('click', (event) => lookupExampleWordMeaning(word, button, event));
        return button;
    }

    function appendInteractiveExampleText(parent, text) {
        const tokens = String(text).split(/([A-Za-z][A-Za-z0-9]*(?:['-][A-Za-z0-9]+)?)/g);
        tokens.forEach((token) => {
            if (/^[A-Za-z][A-Za-z0-9]*(?:['-][A-Za-z0-9]+)?$/.test(token)) {
                parent.appendChild(createLookupWordButton(token));
            } else if (token) {
                parent.appendChild(document.createTextNode(token));
            }
        });
    }

    function renderExampleText(element, exampleText) {
        hideLookupPopup();
        element.innerHTML = '';

        const parts = String(exampleText).split(/(\*\*[^*]+\*\*)/g);
        parts.forEach((part) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                const strong = document.createElement('strong');
                appendInteractiveExampleText(strong, part.slice(2, -2));
                element.appendChild(strong);
            } else if (part) {
                appendInteractiveExampleText(element, part);
            }
        });
    }

    return {
        lookupExampleWordMeaning,
        renderExampleText,
    };
}

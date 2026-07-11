import { createFavoritesController } from './favorites.js';
import { createSpeechController } from './speech.js';

const COLLOCATION_SOURCE = new URL('../pte_collocations.json', import.meta.url).href;
const DAILY_COUNT = 15;

const state = {
    allItems: [],
    deck: [],
    index: 0,
    remembered: 0,
    offset: 0,
};

let root = document;
let favoritesController = null;
let speechController = null;

function getElement(id) {
    return root.querySelector(`#${id}`);
}

function getCurrentItem() {
    return state.deck[state.index] || null;
}

function getDayButtons() {
    const localButtons = [...root.querySelectorAll('[data-day-offset]')];
    if (localButtons.length > 0) return localButtons;
    return [document.getElementById('deck-today'), document.getElementById('deck-yesterday')].filter(Boolean);
}

function getButtonDayOffset(button) {
    return Number(button.dataset.dayOffset ?? button.dataset.offset ?? 0);
}

function toFavoriteWord(item) {
    if (!item) return null;
    return {
        id: `collocation-${item.id || item.phrase}`,
        w: item.phrase,
        pos: item.pattern || `${item.component1_pos || ''} + ${item.component2_pos || ''}`,
        m: item.chinese || '',
        e: item.example || '',
        wordFamily: [],
        collocations: [],
    };
}

function setFavoriteStatus(message, isError = false) {
    const status = getElement('collocation-favorite-status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('favorite-status-error', isError);
}

function updateFavoriteButton() {
    const button = getElement('collocation-favorite-toggle');
    const card = getElement('collocation-card');
    if (!button) return;

    const favoriteWord = toFavoriteWord(getCurrentItem());
    const isSignedIn = Boolean(favoritesController?.getUser());
    const isFlipped = Boolean(card?.classList.contains('flipped'));
    button.hidden = !isSignedIn || !favoriteWord || isFlipped;

    if (!isSignedIn || !favoriteWord) {
        button.classList.remove('active');
        return;
    }

    const isFavorite = favoritesController.hasFavorite(favoriteWord);
    button.innerHTML = isFavorite
        ? '<svg class="favorite-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 17.3 6.2 20.8l1.6-6.6L2.7 9.7l6.8-.6L12 3l2.5 6.1 6.8.6-5.1 4.5 1.6 6.6z" fill="currentColor"></path></svg><span class="visually-hidden">Remove from favorites</span>'
        : '<svg class="favorite-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 17.3 6.2 20.8l1.6-6.6L2.7 9.7l6.8-.6L12 3l2.5 6.1 6.8.6-5.1 4.5 1.6 6.6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path></svg><span class="visually-hidden">Add to favorites</span>';
    button.classList.toggle('active', isFavorite);
    button.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Add to favorites');
    button.setAttribute('aria-pressed', String(isFavorite));
}

function getDateString(offset = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function hashSeed(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function seededRandom(seedText) {
    let seed = hashSeed(seedText) || 1;
    return () => {
        seed += 0x6D2B79F5;
        let value = seed;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function buildDailyDeck(items, dateString) {
    const random = seededRandom(`collocation-${dateString}`);
    const pool = [...items];
    for (let index = pool.length - 1; index > 0; index--) {
        const target = Math.floor(random() * (index + 1));
        [pool[index], pool[target]] = [pool[target], pool[index]];
    }
    return pool.slice(0, Math.min(DAILY_COUNT, pool.length));
}

function shuffleDeck(items) {
    const pool = [...items];
    for (let index = pool.length - 1; index > 0; index--) {
        const target = Math.floor(Math.random() * (index + 1));
        [pool[index], pool[target]] = [pool[target], pool[index]];
    }
    return pool;
}

function setCardFlipped(flipped) {
    const card = getElement('collocation-card');
    card.classList.toggle('flipped', flipped);
    card.setAttribute('aria-pressed', String(flipped));
    updateFavoriteButton();
}

function showCurrentCard() {
    if (state.index >= state.deck.length) {
        showResult();
        return;
    }

    const item = state.deck[state.index];
    setCardFlipped(false);
    getElement('collocation-phrase').textContent = item.phrase;
    getElement('collocation-pattern').textContent = item.pattern || `${item.component1_pos || ''} + ${item.component2_pos || ''}`;
    getElement('collocation-chinese').textContent = item.chinese || '—';
    getElement('collocation-explanation').textContent = item.explanation_zh || '';
    getElement('collocation-example').textContent = item.example || '';
    getElement('collocation-example-zh').textContent = item.example_zh || '';
    getElement('card-index').textContent = `Card: ${state.index + 1} / ${state.deck.length}`;
    getElement('score-count').textContent = `Remembered: ${state.remembered}`;
    getElement('progress').style.width = `${(state.index / state.deck.length) * 100}%`;
    setFavoriteStatus('');
    updateFavoriteButton();
    speechController?.updateSpeakButton();
}

function showResult() {
    getElement('card-area').hidden = true;
    getElement('result-state').hidden = false;
    getElement('card-index').textContent = `Card: ${state.deck.length} / ${state.deck.length}`;
    getElement('score-count').textContent = `Remembered: ${state.remembered}`;
    getElement('progress').style.width = '100%';
    getElement('result-score').textContent = `${state.remembered} / ${state.deck.length}`;
}

export function startDeck(offset = state.offset) {
    state.offset = offset;
    state.index = 0;
    state.remembered = 0;
    const dateString = getDateString(offset);
    state.deck = buildDailyDeck(state.allItems, dateString);

    const dateElement = getElement('practice-date') || document.getElementById('today-date');
    if (dateElement) dateElement.textContent = dateString;
    getElement('loading-state').hidden = true;
    getElement('result-state').hidden = true;
    getElement('card-area').hidden = false;
    getDayButtons().forEach((button) => {
        const active = getButtonDayOffset(button) === offset;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
    showCurrentCard();
}

function markCard(remembered) {
    if (remembered) state.remembered++;
    state.index++;
    showCurrentCard();
}

async function toggleCurrentFavorite(event) {
    event.stopPropagation();
    const button = event.currentTarget;
    const favoriteWord = toFavoriteWord(getCurrentItem());
    if (!favoritesController || !favoriteWord || button.hidden || button.disabled) return;

    button.disabled = true;
    try {
        const isFavorite = await favoritesController.toggleFavorite(favoriteWord);
        setFavoriteStatus(isFavorite ? 'Added to favorites.' : 'Removed from favorites.');
    } catch (error) {
        setFavoriteStatus('Favorite update failed. Please check Firebase permissions.', true);
        console.error('Failed to update collocation favorite.', error);
    } finally {
        button.disabled = false;
        updateFavoriteButton();
    }
}

function wireEvents() {
    const card = getElement('collocation-card');
    card.addEventListener('click', () => setCardFlipped(!card.classList.contains('flipped')));
    card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setCardFlipped(!card.classList.contains('flipped'));
    });
    getElement('speak-phrase').addEventListener('click', speechController.speakCurrentWord);
    getElement('collocation-voice-select').addEventListener('click', (event) => event.stopPropagation());
    getElement('collocation-voice-select').addEventListener('change', (event) => {
        speechController.setSelectedVoice(event.target.value, event);
    });
    getElement('collocation-favorite-toggle').addEventListener('click', toggleCurrentFavorite);
    getElement('mark-forgot').addEventListener('click', () => markCard(false));
    getElement('mark-remembered').addEventListener('click', () => markCard(true));
    getElement('practice-again').addEventListener('click', () => {
        state.deck = shuffleDeck(state.deck);
        state.index = 0;
        state.remembered = 0;
        getElement('result-state').hidden = true;
        getElement('card-area').hidden = false;
        showCurrentCard();
    });
    const localDayButtons = [...root.querySelectorAll('[data-day-offset]')];
    localDayButtons.forEach((button) => {
        button.addEventListener('click', () => startDeck(getButtonDayOffset(button)));
    });

    if (localDayButtons.length === 0) {
        getDayButtons().forEach((button) => {
            if (button.dataset.collocationWired === 'true') return;
            button.dataset.collocationWired = 'true';
            button.addEventListener('click', () => {
                if (!root.querySelector('#colloca-practice-content')) return;
                startDeck(getButtonDayOffset(button));
            });
        });
    }
}

export async function boot(container = document) {
    root = container;
    speechController = createSpeechController(() => {
        const item = getCurrentItem();
        return item ? { w: item.phrase } : null;
    }, {
        voiceSelectId: 'collocation-voice-select',
        speakButtonId: 'speak-phrase',
    });
    favoritesController?.dispose();
    favoritesController = createFavoritesController(updateFavoriteButton);
    favoritesController.init().catch((error) => {
        console.error('Failed to initialize collocation favorites.', error);
    });
    wireEvents();
    speechController.retryLoadVoices();
    try {
        const response = await fetch(COLLOCATION_SOURCE);
        if (!response.ok) throw new Error('Failed to load pte_collocations.json.');
        const data = await response.json();
        if (!Array.isArray(data.items) || data.items.length === 0) {
            throw new Error('Invalid collocation data: missing items.');
        }
        state.allItems = data.items.filter((item) => item && item.phrase);
        startDeck(0);
    } catch (error) {
        getElement('loading-state').textContent = '無法載入搭配詞資料，請確認 pte_collocations.json 可以正常存取。';
        getElement('loading-state').classList.add('error');
        console.error(error);
    }
}

if (document.body.dataset.page === 'colloca-practice') {
    boot();
}

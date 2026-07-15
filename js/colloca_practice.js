import { createFavoritesController } from './favorites.js';
import { renderReviewList, resetReviewFilter } from './review-list.js';
import { createSpeechController } from './speech.js';

const COLLOCATION_SOURCE = new URL('../pte_collocations.json', import.meta.url).href;

const state = {
    allItems: [],
    cards: [],
    index: 0,
    reviewedCards: [],
};

let root = document;
let favoritesController = null;
let speechController = null;

function getElement(id) {
    return root.querySelector(`#${id}`);
}

function getCurrentItem() {
    return state.cards[state.index] || null;
}

function getRememberedCount() {
    return state.reviewedCards.reduce((count, card) => (
        card.isRight ? count + 1 : count
    ), 0);
}

function toReviewWord(item) {
    return { w: item?.phrase || '' };
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

function pickRandomItem(previousItem = null) {
    if (state.allItems.length === 0) return null;
    if (state.allItems.length === 1) return state.allItems[0];

    const randomIndex = Math.floor(Math.random() * state.allItems.length);
    const randomItem = state.allItems[randomIndex];
    if (randomItem !== previousItem) return randomItem;

    const alternativeOffset = 1 + Math.floor(Math.random() * (state.allItems.length - 1));
    return state.allItems[(randomIndex + alternativeOffset) % state.allItems.length];
}

function appendRandomCard() {
    const previousItem = state.cards[state.cards.length - 1] || null;
    const nextItem = pickRandomItem(previousItem);
    if (nextItem) state.cards.push(nextItem);
}

function setCardFlipped(flipped) {
    const card = getElement('collocation-card');
    card.classList.toggle('flipped', flipped);
    card.setAttribute('aria-pressed', String(flipped));
    updateFavoriteButton();
}

function renderCurrentReviewList() {
    if (!getElement('collocation-card') || !getElement('review-list')) return;

    renderReviewList(
        state.reviewedCards,
        state.cards.map(toReviewWord),
        state.index,
        jumpToCard,
        { itemName: 'collocation', itemNamePlural: 'collocations' },
    );
}

function showCurrentCard() {
    const item = getCurrentItem();
    if (!item) return;

    setCardFlipped(false);
    getElement('collocation-phrase').textContent = item.phrase;
    getElement('collocation-pattern').textContent = item.pattern || `${item.component1_pos || ''} + ${item.component2_pos || ''}`;
    getElement('collocation-chinese').textContent = item.chinese || '—';
    getElement('collocation-explanation').textContent = item.explanation_zh || '';
    getElement('collocation-example').textContent = item.example || '';
    getElement('collocation-example-zh').textContent = item.example_zh || '';
    getElement('card-index').textContent = `Card: ${state.index + 1}`;
    getElement('score-count').textContent = `Remembered: ${getRememberedCount()}`;
    setFavoriteStatus('');
    renderCurrentReviewList();
    updateFavoriteButton();
    speechController?.updateSpeakButton();
}

function startPractice() {
    state.cards = [];
    state.index = 0;
    state.reviewedCards = [];
    resetReviewFilter();
    appendRandomCard();

    getElement('loading-state').hidden = true;
    getElement('card-area').hidden = false;
    getElement('review-list-section').hidden = true;
    showCurrentCard();
}

function markCurrentCard(isRight) {
    const reviewedCard = state.reviewedCards.find((card) => card.index === state.index);
    if (reviewedCard) {
        reviewedCard.isRight = isRight;
    } else {
        state.reviewedCards.push({ index: state.index, isRight });
    }

    if (state.index === state.cards.length - 1) {
        appendRandomCard();
    }
    state.index++;
    getElement('review-list-section').hidden = false;
    showCurrentCard();
}

function jumpToCard(cardIndex) {
    state.index = cardIndex;
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
    getElement('mark-forgot').addEventListener('click', () => markCurrentCard(false));
    getElement('mark-remembered').addEventListener('click', () => markCurrentCard(true));
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
        startPractice();
    } catch (error) {
        getElement('loading-state').textContent = '無法載入搭配詞資料，請確認 pte_collocations.json 可以正常存取。';
        getElement('loading-state').classList.add('error');
        console.error(error);
    }
}

document.addEventListener('pte:review-filter-change', renderCurrentReviewList);

if (document.body.dataset.page === 'colloca-practice') {
    boot();
}

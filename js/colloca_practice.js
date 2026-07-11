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

function getElement(id) {
    return root.querySelector(`#${id}`);
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
}

function showResult() {
    getElement('card-area').hidden = true;
    getElement('result-state').hidden = false;
    getElement('card-index').textContent = `Card: ${state.deck.length} / ${state.deck.length}`;
    getElement('score-count').textContent = `Remembered: ${state.remembered}`;
    getElement('progress').style.width = '100%';
    getElement('result-score').textContent = `${state.remembered} / ${state.deck.length}`;
}

function startDeck(offset = state.offset) {
    state.offset = offset;
    state.index = 0;
    state.remembered = 0;
    const dateString = getDateString(offset);
    state.deck = buildDailyDeck(state.allItems, dateString);

    getElement('practice-date').textContent = dateString;
    getElement('loading-state').hidden = true;
    getElement('result-state').hidden = true;
    getElement('card-area').hidden = false;
    root.querySelectorAll('[data-day-offset]').forEach((button) => {
        const active = Number(button.dataset.dayOffset) === offset;
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

function speakCurrentPhrase() {
    if (!('speechSynthesis' in window) || state.index >= state.deck.length) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(state.deck[state.index].phrase);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
}

function wireEvents() {
    const card = getElement('collocation-card');
    card.addEventListener('click', () => setCardFlipped(!card.classList.contains('flipped')));
    card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setCardFlipped(!card.classList.contains('flipped'));
    });
    getElement('speak-phrase').addEventListener('click', (event) => {
        event.stopPropagation();
        speakCurrentPhrase();
    });
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
    root.querySelectorAll('[data-day-offset]').forEach((button) => {
        button.addEventListener('click', () => startDeck(Number(button.dataset.dayOffset)));
    });
}

export async function boot(container = document) {
    root = container;
    wireEvents();
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

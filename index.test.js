const fs = require('fs');
const path = require('path');

describe('PTE daily vocabulary page (index.html)', () => {
    let mockVocab;

    const loadPage = async (date = '2026-06-23T12:00:00+08:00') => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(date));

        window.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(mockVocab),
        });

        const html = fs.readFileSync(path.resolve(__dirname, './index.html'), 'utf8');
        document.documentElement.innerHTML = html;

        const scripts = [...document.querySelectorAll('script')].map((script) => script.textContent);
        scripts.forEach((scriptText) => {
            window.eval(`${scriptText}
window.__getDailyWords = () => dailyWords;
window.__getCurrentIndex = () => currentIndex;
window.__nextWord = nextWord;`);
        });

        await window.onload();
        jest.advanceTimersByTime(200);
        await Promise.resolve();
    };

    beforeEach(() => {
        mockVocab = Array.from({ length: 2000 }, (_, i) => ({
            id: i + 1,
            w: `word${i + 1}`,
            m: `meaning${i + 1}`,
            e: `example${i + 1}`,
        }));
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
        document.documentElement.innerHTML = '';
    });

    test('loads vocabulary and renders exactly 50 daily words', async () => {
        await loadPage();

        expect(window.__getDailyWords()).toHaveLength(50);
        expect(window.fetch).toHaveBeenCalledWith('pte_vocab_2000.json');

        expect(document.getElementById('word-target').innerText).toMatch(/^word\d+$/);
        expect(document.getElementById('card-index').innerText).toContain('1 / 50');
    });

    test('keeps the same 50 daily words when opened repeatedly on the same day', async () => {
        await loadPage('2026-06-23T12:00:00+08:00');
        const firstOpenWordIds = window.__getDailyWords()
            .map((word) => word.id)
            .sort((a, b) => a - b);

        document.documentElement.innerHTML = '';

        await loadPage('2026-06-23T20:30:00+08:00');
        const secondOpenWordIds = window.__getDailyWords()
            .map((word) => word.id)
            .sort((a, b) => a - b);

        expect(secondOpenWordIds).toEqual(firstOpenWordIds);
    });

    test('lists browsed words and lets the user jump back to one', async () => {
        await loadPage();

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
        expect(document.getElementById('card-index').innerText).toContain('1 / 50');
    });

    test('updates a browsed word color when the user answers it again', async () => {
        await loadPage();

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
});

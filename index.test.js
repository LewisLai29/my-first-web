const fs = require('fs');
const path = require('path');

describe('PTE daily vocabulary page (index.html)', () => {
    let mockVocab;
    let mockVoices;

    const loadPage = async (date = '2026-06-23T12:00:00+08:00') => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(date));

        window.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(mockVocab),
        });
        window.speechSynthesis = {
            cancel: jest.fn(),
            getVoices: jest.fn(() => mockVoices),
            speak: jest.fn(),
        };
        window.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) {
            this.text = text;
        };

        const html = fs.readFileSync(path.resolve(__dirname, './index.html'), 'utf8');
        document.documentElement.innerHTML = html;

        const scripts = [...document.querySelectorAll('script')].map((script) => script.textContent);
        scripts.forEach((scriptText) => {
            window.eval(`${scriptText}
window.__getDailyWords = () => dailyWords;
window.__getCurrentIndex = () => currentIndex;
window.__nextWord = nextWord;
window.__speakCurrentWord = speakCurrentWord;`);
        });

        await window.onload();
        jest.advanceTimersByTime(200);
        await Promise.resolve();
    };

    beforeEach(() => {
        mockVoices = [
            { name: 'Microsoft David Desktop', lang: 'en-US' },
            { name: 'Google US English', lang: 'en-US' },
        ];
        mockVocab = {
            metadata: {
                counts: {
                    total: 2000,
                },
            },
            items: Array.from({ length: 2000 }, (_, i) => ({
                id: i + 1,
                w: `word${i + 1}`,
                m: `meaning${i + 1}`,
                e: `This is **word${i + 1}** in an example.`,
                source_basis: ['test_source'],
                meaning_status: 'ready_zh_reviewed',
                example_status: 'ready_bolded',
                confidence: 'high',
            })),
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
        document.documentElement.innerHTML = '';
    });

    test('loads vocabulary and renders exactly 50 daily words', async () => {
        await loadPage();

        expect(window.__getDailyWords()).toHaveLength(50);
        expect(Object.keys(window.__getDailyWords()[0])).toEqual(['id', 'w', 'm', 'e']);
        expect(window.fetch).toHaveBeenCalledWith('pte_vocab_2000.json');

        expect(document.getElementById('word-target').innerText).toMatch(/^word\d+$/);
        expect(document.getElementById('card-index').innerText).toContain('1 / 50');
    });

    test('renders bold markers in examples as strong text', async () => {
        await loadPage();

        const currentWord = window.__getDailyWords()[0];
        const boldExampleWord = document.querySelector('#word-example strong');

        expect(boldExampleWord).not.toBeNull();
        expect(boldExampleWord.innerText).toBe(currentWord.w);
        expect(document.getElementById('word-example').textContent).not.toContain('**');
    });

    test('speaks the current word from the audio button', async () => {
        await loadPage();

        const currentWord = window.__getDailyWords()[0];
        document.getElementById('speak-word').click();

        expect(window.speechSynthesis.cancel).toHaveBeenCalled();
        expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
        expect(window.speechSynthesis.speak.mock.calls[0][0].text).toBe(currentWord.w);
        expect(window.speechSynthesis.speak.mock.calls[0][0].lang).toBe('en-US');
        expect(window.speechSynthesis.speak.mock.calls[0][0].voice.name).toBe('Google US English');
    });

    test('lets the user choose a voice from the selector', async () => {
        await loadPage();

        const voiceSelect = document.getElementById('voice-select');
        expect([...voiceSelect.options].map((option) => option.value)).toEqual([
            'Microsoft David Desktop',
            'Google US English',
        ]);
        expect(voiceSelect.value).toBe('Google US English');

        voiceSelect.value = 'Microsoft David Desktop';
        voiceSelect.dispatchEvent(new Event('change'));
        document.getElementById('speak-word').click();

        expect(window.speechSynthesis.speak.mock.calls[0][0].voice.name).toBe('Microsoft David Desktop');
    });

    test('updates the voice selector after voices load late', async () => {
        mockVoices = [];
        await loadPage();

        const voiceSelect = document.getElementById('voice-select');
        expect(voiceSelect.value).toBe('');
        expect(voiceSelect.options[0].innerText).toBe('使用瀏覽器預設聲音');

        mockVoices = [{ name: 'Google US English', lang: 'en-US' }];
        window.speechSynthesis.onvoiceschanged();
        jest.advanceTimersByTime(250);
        await Promise.resolve();

        expect(voiceSelect.value).toBe('Google US English');
        expect(voiceSelect.disabled).toBe(false);
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

    test('real vocabulary json can load with metadata and items', async () => {
        const jsonText = fs.readFileSync(path.resolve(__dirname, './pte_vocab_2000.json'), 'utf8');
        const data = JSON.parse(jsonText);

        expect(Array.isArray(data.items)).toBe(true);
        expect(data.items).toHaveLength(2000);
        expect(Object.keys(data.items[0])).toEqual([
            'id',
            'w',
            'm',
            'e',
            'source_basis',
            'meaning_status',
            'example_status',
            'confidence',
        ]);

        mockVocab = data;
        await loadPage();

        expect(window.__getDailyWords()).toHaveLength(50);
        expect(Object.keys(window.__getDailyWords()[0])).toEqual(['id', 'w', 'm', 'e']);
        expect(document.getElementById('word-target').innerText).not.toBe('錯誤');
    });
});

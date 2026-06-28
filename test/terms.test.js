describe('word family rendering', () => {
    let renderTermList;

    beforeAll(async () => {
        ({ renderTermList } = await import('../js/terms.js'));
    });

    test('adds part-of-speech prefix for noun entries', () => {
        const list = document.createElement('ul');
        renderTermList(list, [
            {
                term: 'equipment',
                explanation: '名詞：設備/裝備',
            },
        ]);

        expect(list.children).toHaveLength(1);
        expect(list.querySelector('strong').innerText).toBe('(n.) equipment');
        expect(list.textContent).toContain('設備/裝備');
    });

    test('adds abbreviation for adjective entries', () => {
        const list = document.createElement('ul');
        renderTermList(list, [
            {
                term: 'capable',
                explanation: '形容詞：有能力的',
            },
        ]);

        expect(list.querySelector('strong').innerText).toBe('(adj.) capable');
    });

    test('keeps existing prefixed terms unchanged', () => {
        const list = document.createElement('ul');
        renderTermList(list, [
            {
                term: '(n.) equipment',
                explanation: '設備/裝備',
            },
        ]);

        expect(list.querySelector('strong').innerText).toBe('(n.) equipment');
        expect(list.textContent).toContain('設備/裝備');
    });
});

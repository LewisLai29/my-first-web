export function renderTermList(element, entries) {
    element.innerHTML = '';

    const validEntries = Array.isArray(entries)
        ? entries.filter((entry) => entry && (entry.term || entry.text))
        : [];

    if (validEntries.length === 0) {
        const item = document.createElement('li');
        item.innerText = 'None';
        element.appendChild(item);
        return;
    }

    validEntries.forEach((entry) => {
        const item = document.createElement('li');
        if (entry.term) {
            const term = document.createElement('strong');
            term.innerText = entry.term;
            item.appendChild(term);
            if (entry.explanation) {
                item.appendChild(document.createTextNode(`: ${entry.explanation}`));
            }
        } else {
            item.innerText = entry.text;
        }
        element.appendChild(item);
    });
}

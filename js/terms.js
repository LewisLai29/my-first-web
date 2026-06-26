function normalizeWordFamilyEntry(entry) {
    const normalized = { ...entry };
    if (!normalized.term || !normalized.explanation || normalized.term.startsWith('(')) {
        return normalized;
    }

    const match = normalized.explanation.match(/^([^：:]+)[:：]\s*(.*)$/);
    if (!match) {
        return normalized;
    }

    const abbreviation = getPosAbbreviation(match[1]);
    if (!abbreviation) {
        return normalized;
    }

    normalized.term = `(${abbreviation}) ${normalized.term}`;
    normalized.explanation = match[2].trim();
    return normalized;
}

import { getPosAbbreviation } from './vocab.js';

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
        const normalizedEntry = entry.term ? normalizeWordFamilyEntry(entry) : entry;
        const item = document.createElement('li');
        if (normalizedEntry.term) {
            const term = document.createElement('strong');
            term.innerText = normalizedEntry.term;
            item.appendChild(term);
            if (normalizedEntry.explanation) {
                item.appendChild(document.createTextNode(`: ${normalizedEntry.explanation}`));
            }
        } else {
            item.innerText = normalizedEntry.text;
        }
        element.appendChild(item);
    });
}

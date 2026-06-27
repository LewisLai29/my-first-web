export function getTodayString() {
    return getDateStringWithOffset(0);
}

export function getDateStringWithOffset(offsetDays = 0, baseDate = new Date()) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function seededRandom(seedString) {
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
        hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
    }

    return function nextRandom() {
        const x = Math.sin(hash++) * 10000;
        return x - Math.floor(x);
    };
}

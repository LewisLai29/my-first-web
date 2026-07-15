let activeFilter = 'all';

export function resetReviewFilter() {
    activeFilter = 'all';
}

function updateFilterButtons() {
    document.querySelectorAll('[data-review-filter]').forEach((button) => {
        const isActive = button.dataset.reviewFilter === activeFilter;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));

        if (button.dataset.reviewFilterWired !== 'true') {
            button.dataset.reviewFilterWired = 'true';
            button.addEventListener('click', () => {
                activeFilter = button.dataset.reviewFilter || 'all';
                document.dispatchEvent(new CustomEvent('pte:review-filter-change'));
            });
        }
    });
}

export function renderReviewList(reviewedWords, dailyWords, currentIndex, jumpToWord, options = {}) {
    const list = document.getElementById('review-list');
    if (!list) return;

    const itemName = options.itemName || '';
    const itemNamePlural = options.itemNamePlural || 'words';

    const rememberedCount = reviewedWords.filter((word) => word.isRight).length;
    const accuracy = reviewedWords.length > 0
        ? Math.round((rememberedCount / reviewedWords.length) * 100)
        : 0;

    const reviewedCount = document.getElementById('reviewed-count');
    const rightCount = document.getElementById('review-right-count');
    const accuracyLabel = document.getElementById('review-accuracy');
    if (reviewedCount) reviewedCount.innerText = String(reviewedWords.length);
    if (rightCount) rightCount.innerText = String(rememberedCount);
    if (accuracyLabel) accuracyLabel.innerText = `${accuracy}%`;

    updateFilterButtons();

    list.innerHTML = '';
    const visibleWords = reviewedWords.filter((word) => (
        activeFilter === 'all'
        || (activeFilter === 'right' && word.isRight)
        || (activeFilter === 'wrong' && !word.isRight)
    ));

    if (visibleWords.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'review-list-empty';
        const emptyIcon = document.createElement('span');
        emptyIcon.className = 'review-list-empty-icon';
        emptyIcon.setAttribute('aria-hidden', 'true');
        emptyIcon.innerText = reviewedWords.length === 0 ? '01' : '—';
        const emptyTitle = document.createElement('strong');
        emptyTitle.innerText = reviewedWords.length === 0
            ? 'Your learning trail starts here'
            : `No ${itemNamePlural} in this filter`;
        const emptyCopy = document.createElement('span');
        emptyCopy.innerText = reviewedWords.length === 0
            ? (itemName
                ? `Answer a ${itemName} card and it will appear here.`
                : 'Answer a card and it will appear here.')
            : `Try another filter to see your reviewed ${itemNamePlural}.`;
        emptyItem.append(emptyIcon, emptyTitle, emptyCopy);
        list.appendChild(emptyItem);
        return;
    }

    visibleWords.forEach((reviewedWord) => {
        const word = dailyWords[reviewedWord.index];
        if (!word) return;

        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.innerText = word.w;
        button.dataset.reviewStatus = reviewedWord.isRight ? 'Remembered' : 'Try again';
        button.addEventListener('click', () => jumpToWord(reviewedWord.index));
        button.classList.toggle('active', reviewedWord.index === currentIndex);
        button.classList.add(reviewedWord.isRight ? 'review-right' : 'review-wrong');
        item.appendChild(button);
        list.appendChild(item);
    });
}

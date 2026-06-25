export function renderReviewList(reviewedWords, dailyWords, currentIndex, jumpToWord) {
    const list = document.getElementById('review-list');
    if (!list) return;

    list.innerHTML = '';
    if (reviewedWords.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'review-list-empty';
        emptyItem.innerText = 'No reviewed words yet.';
        list.appendChild(emptyItem);
        return;
    }

    reviewedWords.forEach((reviewedWord) => {
        const word = dailyWords[reviewedWord.index];
        if (!word) return;

        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.innerText = word.w;
        button.addEventListener('click', () => jumpToWord(reviewedWord.index));
        button.classList.toggle('active', reviewedWord.index === currentIndex);
        button.classList.add(reviewedWord.isRight ? 'review-right' : 'review-wrong');
        item.appendChild(button);
        list.appendChild(item);
    });
}

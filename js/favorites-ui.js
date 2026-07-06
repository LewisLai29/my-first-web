import { renderTermList } from './terms.js';

function renderFavoriteTermList(list, terms) {
    list.innerHTML = '';
    renderTermList(list, terms);
    if (list.children.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'favorite-term-empty';
        emptyItem.innerText = 'No entries';
        list.appendChild(emptyItem);
    }
}

export function renderFavoritesScreen({
    root = document,
    user,
    favorites,
    onRemoveFavorite,
} = {}) {
    const status = root.getElementById
        ? root.getElementById('favorites-status')
        : root.querySelector('#favorites-status');
    const list = root.getElementById
        ? root.getElementById('favorites-list')
        : root.querySelector('#favorites-list');
    if (!status || !list) return;

    list.innerHTML = '';

    if (!user) {
        status.innerText = 'Please sign in to view favorites.';
        return;
    }

    if (!favorites || favorites.length === 0) {
        status.innerText = 'No favorite words yet.';
        return;
    }

    status.innerText = `${favorites.length} favorite word${favorites.length === 1 ? '' : 's'}.`;

    favorites.forEach((favorite) => {
        const item = document.createElement('li');
        item.className = 'favorite-item';

        const details = document.createElement('details');
        details.className = 'favorite-details-toggle';

        const summary = document.createElement('summary');
        summary.className = 'favorite-summary';

        const heading = document.createElement('div');
        heading.className = 'favorite-item-heading';

        const title = document.createElement('h2');
        title.innerText = favorite.w;

        const pos = document.createElement('span');
        pos.className = 'favorite-pos';
        pos.innerText = favorite.pos ? `(${favorite.pos})` : '';

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'favorite-remove';
        removeButton.innerText = 'Remove';
        removeButton.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            removeButton.disabled = true;
            try {
                await onRemoveFavorite?.(favorite);
            } catch (error) {
                removeButton.disabled = false;
                console.error('Failed to remove favorite.', error);
            }
        });

        heading.append(title, pos, removeButton);

        const meaning = document.createElement('p');
        meaning.className = 'favorite-meaning';
        meaning.innerText = favorite.m || 'No meaning';

        summary.append(heading, meaning);

        const fullContent = document.createElement('div');
        fullContent.className = 'favorite-full-content';

        const example = document.createElement('p');
        example.className = 'favorite-example';
        example.innerText = favorite.e || 'No example';

        const familyTitle = document.createElement('h3');
        familyTitle.innerText = 'Word family';
        const familyList = document.createElement('ul');
        familyList.className = 'detail-list';
        renderFavoriteTermList(familyList, favorite.wordFamily);

        const collocationTitle = document.createElement('h3');
        collocationTitle.innerText = 'Collocations';
        const collocationList = document.createElement('ul');
        collocationList.className = 'detail-list';
        renderFavoriteTermList(collocationList, favorite.collocations);

        fullContent.append(example, familyTitle, familyList, collocationTitle, collocationList);
        details.append(summary, fullContent);
        item.append(details);
        list.appendChild(item);
    });
}

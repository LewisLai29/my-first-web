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

function getRootElement(root, id) {
    return root.getElementById
        ? root.getElementById(id)
        : root.querySelector(`#${id}`);
}

function isCollocationFavorite(favorite) {
    const storedId = String(favorite?.id || '');
    const documentId = String(favorite?.favoriteId || '');
    return storedId.startsWith('collocation-') || documentId.startsWith('collocation-');
}

function createFavoriteItem(favorite, onRemoveFavorite) {
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
    return item;
}

function renderFavoriteGroup({ list, empty, count, favorites, onRemoveFavorite }) {
    list.innerHTML = '';
    count.innerText = String(favorites.length);
    empty.hidden = favorites.length > 0;
    favorites.forEach((favorite) => {
        list.appendChild(createFavoriteItem(favorite, onRemoveFavorite));
    });
}

export function renderFavoritesScreen({
    root = document,
    user,
    favorites,
    onRemoveFavorite,
} = {}) {
    const status = getRootElement(root, 'favorites-status');
    const groups = getRootElement(root, 'favorites-groups');
    const vocabList = getRootElement(root, 'favorites-list');
    const collocationList = getRootElement(root, 'collocation-favorites-list');
    const vocabEmpty = getRootElement(root, 'vocab-favorites-empty');
    const collocationEmpty = getRootElement(root, 'collocation-favorites-empty');
    const vocabCount = getRootElement(root, 'vocab-favorites-count');
    const collocationCount = getRootElement(root, 'collocation-favorites-count');
    if (!status || !groups || !vocabList || !collocationList || !vocabEmpty || !collocationEmpty || !vocabCount || !collocationCount) return;

    vocabList.innerHTML = '';
    collocationList.innerHTML = '';

    if (!user) {
        status.innerText = 'Please sign in to view favorites.';
        groups.hidden = true;
        return;
    }

    const safeFavorites = Array.isArray(favorites) ? favorites : [];
    const collocationFavorites = safeFavorites.filter(isCollocationFavorite);
    const vocabFavorites = safeFavorites.filter((favorite) => !isCollocationFavorite(favorite));

    groups.hidden = false;
    status.innerText = safeFavorites.length === 0
        ? 'No favorites yet.'
        : `${safeFavorites.length} favorite${safeFavorites.length === 1 ? '' : 's'}.`;

    renderFavoriteGroup({
        list: vocabList,
        empty: vocabEmpty,
        count: vocabCount,
        favorites: vocabFavorites,
        onRemoveFavorite,
    });
    renderFavoriteGroup({
        list: collocationList,
        empty: collocationEmpty,
        count: collocationCount,
        favorites: collocationFavorites,
        onRemoveFavorite,
    });
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { activate } from '../dist/plugin.js';

class FakeElement {
    constructor(document, tagName = 'div') {
        this.document = document;
        this.tagName = tagName;
        this.children = [];
        this.listeners = new Map();
        this.attributes = new Map();
        this.textContent = '';
        this.hidden = false;
        this.removed = false;
    }

    set id(value) {
        this._id = value;
        this.document.elements.set(value, this);
    }

    get id() {
        return this._id || '';
    }

    set innerHTML(value) {
        this._innerHTML = value;
        for (const match of value.matchAll(/id="([^"]+)"/g)) {
            const child = new FakeElement(this.document);
            child.id = match[1];
            this.children.push(child);
        }
    }

    get innerHTML() {
        return this._innerHTML || '';
    }

    setAttribute(name, value) {
        this.attributes.set(name, value);
    }

    appendChild(child) {
        this.children.push(child);
        return child;
    }

    addEventListener(type, listener) {
        this.listeners.set(type, listener);
    }

    remove() {
        this.removed = true;
        if (this.id) this.document.elements.delete(this.id);
    }
}

class FakeDocument {
    constructor() {
        this.elements = new Map();
    }

    createElement(tagName) {
        return new FakeElement(this, tagName);
    }

    getElementById(id) {
        return this.elements.get(id) || null;
    }
}

test('activates and fully removes the optional home UI', () => {
    const document = new FakeDocument();
    const root = new FakeElement(document);
    const features = new FakeElement(document);
    const quickTools = new FakeElement(document);
    quickTools.id = 'home-quick-tools-count';
    quickTools.textContent = '4';
    let registeredMode = null;
    let unregistered = false;

    const activation = activate({
        document,
        getElement: (id) => document.getElementById(id),
        vocabularyUrl: 'pte_vocab.json',
        home: {
            root,
            features,
            popupController: {
                close: () => {},
                isModeOpen: () => false,
                prepareExclusive: () => {},
                show: () => true,
            },
            registerPopupMode: (mode, popupId) => {
                registeredMode = { mode, popupId };
                return () => { unregistered = true; };
            },
        },
    });

    assert.equal(document.getElementById('start-game').removed, false);
    assert.equal(document.getElementById('game-popup').hidden, true);
    assert.deepEqual(registeredMode, { mode: 'game', popupId: 'game-popup' });
    assert.equal(quickTools.textContent, '5');

    const tile = document.getElementById('start-game');
    const popup = document.getElementById('game-popup');
    activation.dispose();
    assert.equal(tile.removed, true);
    assert.equal(popup.removed, true);
    assert.equal(unregistered, true);
    assert.equal(quickTools.textContent, '4');
});

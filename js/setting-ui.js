import {
    DAILY_WORD_COUNT_OPTIONS,
    getDailyWordCount,
    normalizeDailyWordCount,
    setDailyWordCount,
} from './settings.js';

export function wireSettingEvents() {
    const dropdown = document.getElementById('daily-word-count-dropdown');
    const countSelect = document.getElementById('daily-word-count');
    const optionsPanel = document.getElementById('daily-word-count-options');
    const applyButton = document.getElementById('setting-apply');
    const status = document.getElementById('setting-status');
    if (!dropdown || !countSelect || !optionsPanel || !applyButton || !status) return;

    optionsPanel.replaceChildren(...DAILY_WORD_COUNT_OPTIONS.map((count) => {
        const optionButton = document.createElement('button');
        optionButton.type = 'button';
        optionButton.className = 'setting-option';
        optionButton.dataset.value = String(count);
        optionButton.role = 'option';
        optionButton.innerText = String(count);
        return optionButton;
    }));

    const options = [...optionsPanel.querySelectorAll('.setting-option')];
    const setSelectedValue = (value) => {
        const selectedValue = String(normalizeDailyWordCount(value));
        countSelect.innerText = selectedValue;
        countSelect.dataset.value = selectedValue;
        options.forEach((option) => {
            option.setAttribute('aria-selected', String(option.dataset.value === selectedValue));
        });
    };

    const setOpen = (open) => {
        optionsPanel.hidden = !open;
        countSelect.setAttribute('aria-expanded', String(open));
    };

    setSelectedValue(getDailyWordCount());
    status.innerText = '';

    countSelect.addEventListener('click', () => setOpen(optionsPanel.hidden));
    options.forEach((option) => {
        option.addEventListener('click', () => {
            setSelectedValue(option.dataset.value);
            setOpen(false);
            countSelect.focus();
        });
    });

    document.addEventListener('click', (event) => {
        if (!optionsPanel.hidden && !dropdown.contains(event.target)) {
            setOpen(false);
        }
    });

    applyButton.addEventListener('click', () => {
        const dailyWordCount = setDailyWordCount(countSelect.dataset.value || getDailyWordCount());
        setSelectedValue(dailyWordCount);
        setOpen(false);
        status.innerText = 'Applied.';
        window.dispatchEvent(new CustomEvent('pte:daily-word-count-change', {
            detail: {
                dailyWordCount,
            },
        }));
    });
}

export function wireWordfrontInputs(root, handlers) {
    const onClick = (event) => {
        const target = event.target.closest('[data-wordfront-action]');
        if (!target || !root.contains(target))
            return;
        const action = target.dataset.wordfrontAction;
        if (action === 'start')
            handlers.onStart();
        else if (action === 'answer' && target.dataset.entryId)
            handlers.onAnswer(target.dataset.entryId);
        else if (action === 'pause')
            handlers.onPause();
        else if (action === 'resume')
            handlers.onResume();
        else if (action === 'restart')
            handlers.onRestart();
        else if (action === 'close')
            handlers.onClose();
    };
    const onKeyDown = (event) => {
        if (!['1', '2', '3', '4'].includes(event.key))
            return;
        const index = Number(event.key) - 1;
        const buttons = Array.from(root.querySelectorAll('[data-wordfront-action="answer"]'));
        const button = buttons[index];
        if (!button || button.disabled || !button.dataset.entryId)
            return;
        event.preventDefault();
        handlers.onAnswer(button.dataset.entryId);
    };
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeyDown);
    return () => {
        root.removeEventListener('click', onClick);
        root.removeEventListener('keydown', onKeyDown);
    };
}

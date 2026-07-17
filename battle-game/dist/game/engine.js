import { createInitialState, reduceGame } from './reducer.js';
export function createEngine({ config, questions, clock, view, }) {
    let state = createInitialState(config, questions);
    let frameId = null;
    let destroyed = false;
    let pendingFinish = null;
    const effectivePhase = () => state.phase === 'paused' && state.resumePhase
        ? state.resumePhase
        : state.phase;
    const scheduleFrame = () => {
        if (!destroyed && frameId === null)
            frameId = window.requestAnimationFrame(onFrame);
    };
    const finishResolution = (type) => {
        if (destroyed)
            return;
        const expectedPhase = type === 'PLAYER_ATTACK_FINISHED'
            ? 'resolving-player-attack'
            : 'resolving-enemy-attack';
        if (state.phase === 'paused' && state.resumePhase === expectedPhase) {
            pendingFinish = type;
            return;
        }
        if (state.phase === expectedPhase)
            dispatch({ type, now: clock.now() });
    };
    const runEffects = (effects, resultingPhase) => {
        if (effects.length === 0)
            return;
        const promises = effects.map((effect) => view.play(effect));
        if (resultingPhase === 'resolving-player-attack') {
            void Promise.all(promises).then(() => finishResolution('PLAYER_ATTACK_FINISHED'));
        }
        else if (resultingPhase === 'resolving-enemy-attack') {
            void Promise.all(promises).then(() => finishResolution('ENEMY_ATTACK_FINISHED'));
        }
    };
    const dispatch = (action) => {
        if (destroyed && action.type !== 'DESTROY')
            return;
        const wasPaused = state.phase === 'paused';
        const result = reduceGame(state, action, config);
        state = result.state;
        const isPaused = state.phase === 'paused';
        if (!wasPaused && isPaused) {
            clock.pause();
            view.setAnimationsPaused(true);
        }
        else if (wasPaused && !isPaused) {
            clock.resume();
            view.setAnimationsPaused(false);
        }
        view.render(state, clock.now());
        runEffects(result.effects, state.phase);
        if (action.type === 'RESUME' && pendingFinish && state.phase !== 'paused') {
            const finish = pendingFinish;
            pendingFinish = null;
            finishResolution(finish);
        }
    };
    const resolveDueEvents = () => {
        const now = clock.now();
        if (state.phase === 'playing'
            && state.questionDeadlineGameMs !== null
            && now >= state.questionDeadlineGameMs) {
            dispatch({ type: 'QUESTION_TIMEOUT', now });
            return true;
        }
        if (state.phase === 'wave-transition'
            && state.waveDeadlineGameMs !== null
            && now >= state.waveDeadlineGameMs) {
            dispatch({ type: 'WAVE_TRANSITION_FINISHED', now });
            return true;
        }
        return false;
    };
    function onFrame() {
        frameId = null;
        if (destroyed)
            return;
        if (!resolveDueEvents())
            view.render(state, clock.now());
        scheduleFrame();
    }
    view.render(state, clock.now());
    scheduleFrame();
    return {
        start: () => dispatch({ type: 'START', now: clock.now() }),
        submitAnswer: (entryId) => {
            if (resolveDueEvents())
                return;
            dispatch({ type: 'SUBMIT_ANSWER', entryId, now: clock.now() });
        },
        pause: (reason) => dispatch({ type: 'PAUSE', reason }),
        clearPauseReason: (reason) => dispatch({ type: 'CLEAR_PAUSE_REASON', reason }),
        resume: () => dispatch({ type: 'RESUME', now: clock.now() }),
        getState: () => state,
        destroy: () => {
            if (destroyed)
                return;
            dispatch({ type: 'DESTROY' });
            destroyed = true;
            if (frameId !== null)
                window.cancelAnimationFrame(frameId);
            frameId = null;
        },
    };
}

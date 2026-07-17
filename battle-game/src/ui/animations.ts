import type { GameEffect } from '../game/types.js';
import { PLAYER_ATTACK_ASSET_URLS } from './asset-catalog.js';

export class WordfrontAnimations {
    private readonly active = new Set<Animation>();
    private readonly frameRequests = new Set<number>();
    private paused = false;

    constructor(private readonly root: HTMLElement) {}

    setPaused(paused: boolean): void {
        this.paused = paused;
        this.active.forEach((animation) => paused ? animation.pause() : animation.play());
        this.root.classList.toggle('is-animation-paused', paused);
    }

    async play(effect: GameEffect): Promise<void> {
        if (effect.type === 'ANIMATE_PLAYER_ATTACK') return this.playerAttack(effect.word, effect.enemyId);
        if (effect.type === 'ANIMATE_ENEMY_ATTACK') return this.enemyAttack(effect.enemyId);
        if (effect.type === 'ANIMATE_ENEMY_DEATH') return this.enemyDeath(effect.enemyId);
    }

    destroy(): void {
        this.frameRequests.forEach((requestId) => window.cancelAnimationFrame(requestId));
        this.frameRequests.clear();
        this.active.forEach((animation) => animation.cancel());
        this.active.clear();
        this.root
            .querySelectorAll('[data-wordfront-projectile], [data-wordfront-cast-burst], [data-wordfront-impact]')
            .forEach((element) => element.remove());
    }

    private animate(
        element: Element,
        frames: Keyframe[],
        options: KeyframeAnimationOptions,
    ): Promise<void> {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const animation = element.animate(frames, {
            ...options,
            duration: reducedMotion ? 1 : options.duration,
            delay: reducedMotion ? 0 : options.delay,
        });
        this.active.add(animation);
        if (this.paused) animation.pause();
        return animation.finished.catch(() => undefined).then(() => {
            this.active.delete(animation);
        });
    }

    private async playerAttack(word: string, enemyId: string): Promise<void> {
        const battlefield = this.root.querySelector<HTMLElement>('[data-wordfront-battlefield]');
        const player = this.root.querySelector<HTMLElement>('[data-wordfront-player]');
        const enemy = this.root.querySelector<HTMLElement>(`[data-enemy-id="${enemyId}"]`);
        if (!battlefield || !player || !enemy) return;

        const fieldRect = battlefield.getBoundingClientRect();
        const playerRect = player.getBoundingClientRect();
        const enemyRect = enemy.getBoundingClientRect();

        const castBurst = document.createElement('span');
        castBurst.className = 'wordfront-cast-burst';
        castBurst.dataset.wordfrontCastBurst = '';
        castBurst.setAttribute('aria-hidden', 'true');
        player.appendChild(castBurst);

        const projectile = document.createElement('span');
        projectile.className = 'wordfront-projectile';
        projectile.dataset.wordfrontProjectile = '';
        projectile.textContent = word;
        projectile.style.left = `${playerRect.right - fieldRect.left - 12}px`;
        projectile.style.top = `${playerRect.top + playerRect.height * 0.42 - fieldRect.top}px`;
        battlefield.appendChild(projectile);

        const impact = document.createElement('span');
        impact.className = 'wordfront-impact';
        impact.dataset.wordfrontImpact = '';
        impact.setAttribute('aria-hidden', 'true');
        impact.style.left = `${enemyRect.left + enemyRect.width * 0.28 - fieldRect.left}px`;
        impact.style.top = `${enemyRect.top + enemyRect.height * 0.4 - fieldRect.top}px`;
        battlefield.appendChild(impact);

        const dx = enemyRect.left - playerRect.right + enemyRect.width * 0.35;
        const dy = enemyRect.top + enemyRect.height * 0.45 - (playerRect.top + playerRect.height * 0.42);
        try {
            await Promise.all([
                this.animate(player, [
                    { transform: 'translate(0, 0)', filter: 'brightness(1)' },
                    { transform: 'translate(-5px, 1px)', filter: 'brightness(1)', offset: 0.28 },
                    { transform: 'translate(10px, -2px)', filter: 'brightness(1.3) drop-shadow(0 0 12px #60a5fa)', offset: 0.62 },
                    { transform: 'translate(0, 0)', filter: 'brightness(1)' },
                ], { duration: 700, easing: 'cubic-bezier(.22,.75,.28,1)' }),
                this.playPlayerFrames(player),
                this.animate(castBurst, [
                    { transform: 'scale(.2) rotate(-30deg)', opacity: 0 },
                    { transform: 'scale(1) rotate(25deg)', opacity: 1, offset: 0.45 },
                    { transform: 'scale(1.35) rotate(70deg)', opacity: 0 },
                ], { duration: 430, delay: 70, easing: 'ease-out', fill: 'forwards' }),
                this.animate(projectile, [
                    { transform: 'translate(0, 0) scale(0.6)', opacity: 0 },
                    { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.15 },
                    { transform: `translate(${dx}px, ${dy}px) scale(1.08)`, opacity: 1, offset: 0.86 },
                    { transform: `translate(${dx}px, ${dy}px) scale(1.5)`, opacity: 0 },
                ], { duration: 540, delay: 180, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'forwards' }),
                this.animate(impact, [
                    { transform: 'scale(.15)', opacity: 0 },
                    { transform: 'scale(1)', opacity: 1, offset: 0.35 },
                    { transform: 'scale(1.8)', opacity: 0 },
                ], { duration: 280, delay: 640, easing: 'ease-out', fill: 'forwards' }),
            ]);
        } finally {
            castBurst.remove();
            projectile.remove();
            impact.remove();
        }
    }

    private async playPlayerFrames(player: HTMLElement): Promise<void> {
        const baseImage = player.querySelector<HTMLImageElement>('img');
        if (!baseImage) return;
        const frameDurationMs = 115;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const sequenceDurationMs = reducedMotion ? 1 : frameDurationMs * PLAYER_ATTACK_ASSET_URLS.length;
        const originalSource = baseImage.src;
        const driver = baseImage.animate([
            { opacity: 1 },
            { opacity: 1 },
        ], { duration: sequenceDurationMs, easing: 'linear' });
        this.active.add(driver);
        if (this.paused) driver.pause();

        let frameRequest: number | null = null;
        const renderFrame = (): void => {
            if (driver.playState === 'idle' || driver.playState === 'finished') return;
            const elapsed = typeof driver.currentTime === 'number' ? driver.currentTime : 0;
            const frameIndex = reducedMotion
                ? 3
                : Math.min(PLAYER_ATTACK_ASSET_URLS.length - 1, Math.floor(elapsed / frameDurationMs));
            const frameSource = PLAYER_ATTACK_ASSET_URLS[frameIndex];
            if (frameSource && baseImage.src !== frameSource) baseImage.src = frameSource;
            frameRequest = window.requestAnimationFrame(() => {
                if (frameRequest !== null) this.frameRequests.delete(frameRequest);
                frameRequest = null;
                renderFrame();
            });
            this.frameRequests.add(frameRequest);
        };
        renderFrame();

        try {
            await driver.finished.catch(() => undefined);
        } finally {
            if (frameRequest !== null) {
                window.cancelAnimationFrame(frameRequest);
                this.frameRequests.delete(frameRequest);
            }
            this.active.delete(driver);
            baseImage.src = originalSource;
        }
    }

    private async enemyAttack(enemyId: string): Promise<void> {
        const enemy = this.root.querySelector<HTMLElement>(`[data-enemy-id="${enemyId}"]`);
        const player = this.root.querySelector<HTMLElement>('[data-wordfront-player]');
        const tasks: Promise<void>[] = [];
        if (enemy) tasks.push(this.animate(enemy, [
            { translate: '0 0' },
            { translate: '-28px 0', offset: 0.45 },
            { translate: '0 0' },
        ], { duration: 460, easing: 'ease-in-out' }));
        if (player) tasks.push(this.animate(player, [
            { translate: '0 0', filter: 'none' },
            { translate: '-8px 0', filter: 'brightness(1.8) saturate(.6)', offset: 0.35 },
            { translate: '8px 0', offset: 0.6 },
            { translate: '0 0', filter: 'none' },
        ], { duration: 460, easing: 'ease-in-out' }));
        await Promise.all(tasks);
    }

    private async enemyDeath(enemyId: string): Promise<void> {
        const enemy = this.root.querySelector<HTMLElement>(`[data-enemy-id="${enemyId}"]`);
        if (!enemy) return;
        await this.animate(enemy, [
            { opacity: 1, scale: 1, filter: 'brightness(1)' },
            { opacity: 1, scale: 1.08, filter: 'brightness(1.8)', offset: 0.55 },
            { opacity: 0, scale: 0.55, filter: 'brightness(2)' },
        ], { duration: 620, delay: 300, easing: 'ease-in', fill: 'forwards' });
    }
}

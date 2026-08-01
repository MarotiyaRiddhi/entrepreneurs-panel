/* ─── Appear-Then-Vanish Intro & Staggered Cascade Manager ───────────── */
import { BlackHoleAnomaly } from './anomaly.js';

export class BlackHoleIntroManager {
    constructor() {
        this.wrapper = null;
        this.anomaly = null;
        this.init();
    }

    init() {
        const wrapper = document.getElementById('black-hole-wrapper');
        if (!wrapper) return;
        this.wrapper = wrapper;

        const hasSeenIntro = sessionStorage.getItem('fs_intro_seen') === 'true';
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (hasSeenIntro || reduced) {
            // Skip Intro: hide overlay immediately and reveal hero content
            wrapper.style.display = 'none';
            document.documentElement.classList.remove('fs-show-intro');
            document.documentElement.classList.add('fs-skip-intro', 'fs-hero-content-entering');
            document.body.style.overflow = '';
        } else {
            // Appear-Then-Vanish Intro Mode
            wrapper.style.display = 'block';
            wrapper.style.opacity = '1';

            this.anomaly = new BlackHoleAnomaly(wrapper, {
                skipIntro: false,
                onFormed: () => {
                    this.vanishAndReveal();
                }
            });

            // Hard safety fallback timer (max 1.6s cap) so page never hangs
            setTimeout(() => {
                if (document.documentElement.classList.contains('fs-show-intro') &&
                    !document.documentElement.classList.contains('fs-hero-content-entering')) {
                    this.vanishAndReveal();
                }
            }, 1600);
        }
    }

    vanishAndReveal() {
        if (!this.wrapper || this.vanished) return;
        this.vanished = true;

        sessionStorage.setItem('fs_intro_seen', 'true');

        // Step 1: Fade out completely
        this.wrapper.style.transition = 'opacity 0.5s ease-out';
        this.wrapper.style.opacity = '0';

        // Step 2: Trigger Staggered Hero Cascade right as fade-out completes (with 50ms overlap)
        setTimeout(() => {
            document.documentElement.classList.add('fs-hero-content-entering');
        }, 350);

        // Step 3: Remove overlay completely and destroy WebGL loop
        setTimeout(() => {
            if (this.wrapper) {
                this.wrapper.style.display = 'none';
            }
            document.documentElement.classList.remove('fs-show-intro');
            document.body.style.overflow = '';

            this.anomaly?.destroy?.();
            this.anomaly = null;
        }, 520);
    }
}

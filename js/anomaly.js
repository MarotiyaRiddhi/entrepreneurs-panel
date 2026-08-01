/* ─── Schwarzschild Black Hole WebGL Anomaly Engine (High-Performance) ─── */
import * as THREE from 'three';
import {
    EffectComposer,
    RenderPass,
    EffectPass,
    BloomEffect,
    ChromaticAberrationEffect,
    NoiseEffect,
    VignetteEffect,
    BlendFunction
} from 'postprocessing';
import gsap from 'gsap';
import { vertexShader, fragmentShader } from './blackHoleShader.js';
import { PULSE_EVENT } from './pulse.js';
import { field, projectHole } from './field.js';

const tier = () => {
    const narrow = window.innerWidth < 820;
    const weak = (navigator.hardwareConcurrency || 8) <= 4;
    return narrow || weak
        ? { steps: 34, scale: 0.45, cap: 1.0 }
        : { steps: 44, scale: 0.60, cap: 1.4 };
};

export class BlackHoleAnomaly {
    constructor(container, options = {}) {
        this.container = container;
        this.onFormed = options.onFormed || null;
        this.skipIntro = options.skipIntro || false;
        this.destroyed = false;
        this.init();
    }

    init() {
        const host = this.container;
        if (!host) return;

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const { steps, scale, cap } = tier();

        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: false,
                alpha: true,
                powerPreference: 'high-performance',
                failIfMajorPerformanceCaveat: false,
            });
        } catch (e) {
            console.warn('WebGL initialization failed:', e);
            return;
        }

        renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        renderer.setClearColor(0x050308, 1);
        host.appendChild(renderer.domElement);
        this.renderer = renderer;

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const isFormedInitially = reduced || this.skipIntro;

        const uniforms = {
            uResolution: { value: new THREE.Vector2(1, 1) },
            uTime: { value: 0 },
            uCamPos: { value: new THREE.Vector3(0, 3.4, 40) },
            uCamTarget: { value: new THREE.Vector3(2.4, -0.35, 0) },
            uFov: { value: 1.5 },
            uFormation: { value: isFormedInitially ? 1 : 0 },
            uHorizon: { value: isFormedInitially ? 1 : 0 },
            uReveal: { value: isFormedInitially ? 1 : 0 },
            uSeed: { value: 0 },
            uDisk: { value: isFormedInitially ? 1 : 0 },
            uDiskGain: { value: 1 },
            uPulse: { value: 0 },
            uMouse: { value: new THREE.Vector2(0, 0) },
        };
        this.uniforms = uniforms;

        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader: `#define STEPS ${steps}\n${fragmentShader}`,
            uniforms,
            depthWrite: false,
            depthTest: false,
        });

        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        quad.frustumCulled = false;
        scene.add(quad);

        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));

        if (!reduced) {
            const bloom = new BloomEffect({
                luminanceThreshold: 0.28,
                luminanceSmoothing: 0.45,
                intensity: 1.1,
                mipmapBlur: true,
                radius: 0.8,
            });
            const aberration = new ChromaticAberrationEffect({
                offset: new THREE.Vector2(0.0005, 0.0008),
                radialModulation: true,
                modulationOffset: 0.35,
            });
            const grain = new NoiseEffect({
                blendFunction: BlendFunction.OVERLAY,
                premultiply: true,
            });
            grain.blendMode.opacity.value = 0.1;

            const vignette = new VignetteEffect({ offset: 0.30, darkness: 0.65 });
            composer.addPass(new EffectPass(camera, bloom, aberration, grain, vignette));
        }
        this.composer = composer;

        /* ── resize with DPR cap ── */
        const resize = () => {
            if (this.destroyed) return;
            const w = host.clientWidth || window.innerWidth;
            const h = host.clientHeight || window.innerHeight;
            const dprCap = Math.min(window.devicePixelRatio || 1, 1.5);
            const pr = Math.min(dprCap * scale, cap);
            renderer.setPixelRatio(pr);
            renderer.setSize(w, h, false);
            composer.setSize(w, h);
            uniforms.uResolution.value.set(w, h);
        };
        this.resize = resize;
        resize();
        window.addEventListener('resize', resize);

        /* ── pointer move ── */
        const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
        const onMove = (e) => {
            mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
            mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
        };
        if (!reduced) window.addEventListener('pointermove', onMove, { passive: true });

        /* ── pulse ripple ── */
        const onPulse = () => {
            gsap.fromTo(uniforms.uPulse,
                { value: 0.001 },
                { value: 1, duration: 1.8, ease: 'power2.out' });
        };
        window.addEventListener(PULSE_EVENT, onPulse);

        /* ── intro formation timeline ── */
        let tl = null;
        if (reduced || this.skipIntro) {
            this.onFormed?.();
        } else {
            tl = gsap.timeline();
            tl.to(uniforms.uReveal, { value: 1, duration: 0.6, ease: 'sine.inOut' }, 0.05);
            tl.to(uniforms.uSeed, { value: 3.0, duration: 0.5, ease: 'power2.in' }, 0.15);
            tl.to(uniforms.uFormation, { value: 1, duration: 0.8, ease: 'sine.inOut' }, 0.3);
            tl.to(uniforms.uHorizon, { value: 1, duration: 0.7, ease: 'power2.out' }, 0.45);
            tl.to(uniforms.uSeed, { value: 0, duration: 0.5, ease: 'sine.inOut' }, 0.6);
            tl.to(uniforms.uDisk, { value: 1, duration: 0.7, ease: 'power1.inOut' }, 0.6);
            tl.call(() => this.onFormed?.(), null, 0.9);
        }

        /* ── optimized render loop (no per-frame object allocations) ── */
        const clock = new THREE.Clock();
        let raf = 0;
        let running = true;

        const frame = () => {
            if (!running || this.destroyed) return;
            raf = requestAnimationFrame(frame);

            const delta = Math.min(clock.getDelta(), 0.05);
            const t = clock.elapsedTime;
            uniforms.uTime.value = t;

            const k = Math.min(1, delta * 1.7);
            mouse.x += (mouse.tx - mouse.x) * k;
            mouse.y += (mouse.ty - mouse.y) * k;
            uniforms.uMouse.value.set(mouse.x, mouse.y);

            const driftX = Math.sin(t * 0.047) * 1.5 + Math.sin(t * 0.019) * 0.7;
            const driftY = Math.sin(t * 0.031) * 0.55 + Math.cos(t * 0.013) * 0.3;
            const breathe = Math.sin(t * 0.023) * 0.9;
            const portrait = uniforms.uResolution.value.x / uniforms.uResolution.value.y < 0.85;

            const fall = field.fall || 0;
            const orbit = t * 0.014;
            const radius = (40.0 + breathe * 1.6) * (1 - 0.34 * fall);

            uniforms.uCamPos.value.set(
                Math.sin(orbit) * radius * 0.07 + driftX + mouse.x * 1.2,
                3.35 + driftY - mouse.y * 0.7,
                Math.cos(orbit) * radius * 0.07 + radius * 0.94
            );
            uniforms.uCamTarget.value.set(
                (portrait ? 0.1 : 2.4) + mouse.x * 0.32,
                portrait ? -5.6 : -0.35,
                0
            );
            uniforms.uFov.value = (portrait ? 0.92 : 1.5) * (1.0 + 0.18 * fall);
            uniforms.uDiskGain.value = portrait ? 0.82 : 1.0;

            const hostW = host.clientWidth || window.innerWidth;
            const hostH = host.clientHeight || window.innerHeight;
            const proj = projectHole(uniforms.uCamPos.value, uniforms.uCamTarget.value,
                uniforms.uFov.value, hostW, hostH);
            if (proj) {
                field.x = proj.x;
                field.y = proj.y;
                field.strength = uniforms.uFormation.value;
                field.ready = true;
            }

            composer.render();
        };
        raf = requestAnimationFrame(frame);

        const onVisibility = () => {
            if (document.hidden) {
                running = false;
                cancelAnimationFrame(raf);
            } else if (!running && !this.destroyed) {
                running = true;
                clock.getDelta();
                raf = requestAnimationFrame(frame);
            }
        };
        document.addEventListener('visibilitychange', onVisibility);

        this.cleanup = () => {
            this.destroyed = true;
            running = false;
            cancelAnimationFrame(raf);
            tl?.kill();
            window.removeEventListener('resize', resize);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener(PULSE_EVENT, onPulse);
            document.removeEventListener('visibilitychange', onVisibility);
            composer.dispose();
            quad.geometry.dispose();
            material.dispose();
            renderer.dispose();
            if (renderer.domElement && renderer.domElement.parentNode === host) {
                host.removeChild(renderer.domElement);
            }
        };
    }

    destroy() {
        this.cleanup?.();
    }
}

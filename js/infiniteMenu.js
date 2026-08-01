/* ─── React Bits WebGL Infinite Menu Component (Three.js) ───────────────
 * 3D Draggable Sphere / Ring of Speaker Tiles with Active Focus Scaling,
 * Touch Inertia, Raycasting, and Restyled Neon Palette (#A855F7, #22D3EE, #FF8A3D).
 * -------------------------------------------------------------------- */
import * as THREE from 'three';
import gsap from 'gsap';

export class InfiniteSpeakerMenu {
    constructor(container, speakersData = []) {
        this.container = container;
        this.speakers = speakersData;
        this.activeIndex = 0;
        this.rotationY = 0;
        this.targetRotationY = 0;
        this.velocityX = 0;
        this.isDragging = false;
        this.startX = 0;
        this.previousX = 0;
        this.destroyed = false;
        this.cards = [];

        this.init();
    }

    init() {
        if (!this.container || !this.speakers.length) return;

        this.container.innerHTML = '';

        // WebGL Canvas Host
        const canvasHost = document.createElement('div');
        canvasHost.className = 'infinite-menu__canvas-host';
        this.container.appendChild(canvasHost);

        // UI Detail Panel Host
        const uiHost = document.createElement('div');
        uiHost.className = 'infinite-menu__ui-host';
        this.container.appendChild(uiHost);
        this.uiHost = uiHost;

        // WebGL Setup
        const width = canvasHost.clientWidth || window.innerWidth;
        const height = canvasHost.clientHeight || 450;

        const scene = new THREE.Scene();
        this.scene = scene;

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.set(0, 0, 8.5);
        this.camera = camera;

        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance',
            });
        } catch (e) {
            console.warn('WebGL initialization failed for Infinite Menu:', e);
            this.renderFallbackUI();
            return;
        }

        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setSize(width, height);
        canvasHost.appendChild(renderer.domElement);
        this.renderer = renderer;

        // 3D Ring Group
        const ringGroup = new THREE.Group();
        scene.add(ringGroup);
        this.ringGroup = ringGroup;

        // Create Card Textures & Meshes
        const count = this.speakers.length;
        const isMobile = window.innerWidth < 820;
        const radius = isMobile ? 3.2 : 4.0;
        this.radius = radius;

        this.speakers.forEach((speaker, i) => {
            const cardMesh = this.createCardMesh(speaker, i, count);
            const angle = (i / count) * Math.PI * 2;

            cardMesh.position.x = Math.sin(angle) * radius;
            cardMesh.position.z = Math.cos(angle) * radius;
            cardMesh.rotation.y = angle;

            cardMesh.userData = { index: i, angle, speaker };
            ringGroup.add(cardMesh);
            this.cards.push(cardMesh);
        });

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xa855f7, 3, 15);
        pointLight.position.set(0, 2, 5);
        scene.add(pointLight);

        const cyanLight = new THREE.PointLight(0x22d3ee, 2, 15);
        cyanLight.position.set(0, -2, 5);
        scene.add(cyanLight);

        // Interaction Event Listeners
        this.setupInteractions(canvasHost);

        // Resize Listener
        const onResize = () => {
            if (this.destroyed) return;
            const w = canvasHost.clientWidth || window.innerWidth;
            const h = canvasHost.clientHeight || 450;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);

            const mobileNow = w < 820;
            this.radius = mobileNow ? 3.2 : 4.0;
            camera.position.z = mobileNow ? 9.5 : 8.5;
        };
        window.addEventListener('resize', onResize);
        this.onResize = onResize;

        // Render Loop
        const clock = new THREE.Clock();
        const frame = () => {
            if (this.destroyed) return;
            requestAnimationFrame(frame);

            // Drag velocity inertia
            if (!this.isDragging) {
                this.velocityX *= 0.92;
                this.targetRotationY += this.velocityX;
            }

            this.rotationY += (this.targetRotationY - this.rotationY) * 0.1;
            ringGroup.rotation.y = this.rotationY;

            // Find front-most card
            let closestDist = Infinity;
            let closestIndex = 0;

            this.cards.forEach((card) => {
                // Calculate world position
                const worldPos = new THREE.Vector3();
                card.getWorldPosition(worldPos);

                const distToFront = Math.hypot(worldPos.x, worldPos.z - radius);
                const scaleTarget = 1.0 + Math.max(0, (1 - distToFront / (radius * 1.4)) * 0.35);
                const opacityTarget = Math.max(0.4, 1 - distToFront / (radius * 2));

                card.scale.lerp(new THREE.Vector3(scaleTarget, scaleTarget, scaleTarget), 0.1);
                if (card.material) {
                    card.material.opacity = THREE.MathUtils.lerp(card.material.opacity, opacityTarget, 0.1);
                }

                if (distToFront < closestDist) {
                    closestDist = distToFront;
                    closestIndex = card.userData.index;
                }
            });

            if (closestIndex !== this.activeIndex) {
                this.activeIndex = closestIndex;
                this.updateUI(closestIndex);
            }

            renderer.render(scene, camera);
        };
        requestAnimationFrame(frame);

        // Initial UI Render
        this.updateUI(0);
    }

    createCardMesh(speaker, index, total) {
        const width = 512;
        const height = 640;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Card Background (Near-black with Neon gradient border)
        const radGrad = ctx.createLinearGradient(0, 0, width, height);
        radGrad.addColorStop(0, '#120F24');
        radGrad.addColorStop(1, '#050308');

        ctx.fillStyle = radGrad;
        ctx.fillRect(0, 0, width, height);

        // Outer Neon Border
        ctx.strokeStyle = index % 2 === 0 ? 'rgba(168, 85, 247, 0.7)' : 'rgba(34, 211, 238, 0.7)';
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, width - 10, height - 10);

        // Inner Card Content (Avatar or Monogram + Tag)
        const initials = speaker.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

        // Avatar Placeholder Circle / Box
        ctx.save();
        ctx.beginPath();
        ctx.arc(width / 2, height / 2 - 40, 140, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        const circleGrad = ctx.createLinearGradient(100, 100, 400, 400);
        circleGrad.addColorStop(0, '#A855F7');
        circleGrad.addColorStop(1, '#22D3EE');
        ctx.fillStyle = circleGrad;
        ctx.fill();

        // Monogram Text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 110px Space Mono, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, width / 2, height / 2 - 40);
        ctx.restore();

        // Tag Badge
        ctx.fillStyle = '#FF8A3D';
        ctx.font = 'bold 24px Space Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText((speaker.tag || 'SPEAKER').toUpperCase(), width / 2, height / 2 + 140);

        // Speaker Name
        ctx.fillStyle = '#EDEAF5';
        ctx.font = 'bold 42px General Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(speaker.name, width / 2, height / 2 + 200);

        // Create 3D Mesh
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;

        const geometry = new THREE.PlaneGeometry(2.1, 2.6, 1, 1);
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            roughness: 0.2,
            metalness: 0.1,
        });

        return new THREE.Mesh(geometry, material);
    }

    setupInteractions(host) {
        const onStart = (clientX) => {
            this.isDragging = true;
            this.startX = clientX;
            this.previousX = clientX;
            this.velocityX = 0;
        };

        const onMove = (clientX) => {
            if (!this.isDragging) return;
            const deltaX = clientX - this.previousX;
            this.previousX = clientX;

            const sensitivity = 0.005;
            this.targetRotationY -= deltaX * sensitivity;
            this.velocityX = -deltaX * sensitivity * 0.5;
        };

        const onEnd = () => {
            this.isDragging = false;
        };

        // Pointer Events
        host.addEventListener('pointerdown', (e) => onStart(e.clientX));
        window.addEventListener('pointermove', (e) => onMove(e.clientX));
        window.addEventListener('pointerup', onEnd);

        // Touch Events
        host.addEventListener('touchstart', (e) => {
            if (e.touches[0]) onStart(e.touches[0].clientX);
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (e.touches[0]) onMove(e.touches[0].clientX);
        }, { passive: true });

        window.addEventListener('touchend', onEnd);
    }

    rotateTo(index) {
        const count = this.speakers.length;
        const targetAngle = -(index / count) * Math.PI * 2;

        // Find closest turn count
        const currentTurns = Math.round(this.targetRotationY / (Math.PI * 2));
        this.targetRotationY = currentTurns * Math.PI * 2 + targetAngle;
    }

    updateUI(index) {
        if (!this.uiHost || !this.speakers[index]) return;
        const sp = this.speakers[index];

        const html = `
            <div class="infinite-menu__detail">
                <div class="infinite-menu__meta">
                    <span class="infinite-menu__index">0${index + 1} / 0${this.speakers.length}</span>
                    <span class="infinite-menu__tag">${sp.tag || 'Panelist'}</span>
                </div>
                <h3 class="infinite-menu__name">${sp.name}</h3>
                <p class="infinite-menu__role">${sp.title || 'Title & venture to be confirmed'}</p>
                <p class="infinite-menu__bio">${sp.bio || 'Bio and headshot being confirmed.'}</p>
                <div class="infinite-menu__actions">
                    ${sp.linkedin ? `<a class="btn btn--outline btn--sm" href="${sp.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn Profile &rarr;</a>` : ''}
                    <div class="infinite-menu__nav-btns">
                        <button type="button" class="menu-nav-btn prev-btn" aria-label="Previous Speaker">&larr;</button>
                        <button type="button" class="menu-nav-btn next-btn" aria-label="Next Speaker">&rarr;</button>
                    </div>
                </div>
            </div>
        `;

        this.uiHost.innerHTML = html;

        // Wire Prev / Next Buttons
        const prevBtn = this.uiHost.querySelector('.prev-btn');
        const nextBtn = this.uiHost.querySelector('.next-btn');

        prevBtn?.addEventListener('click', () => {
            const nextIdx = (index - 1 + this.speakers.length) % this.speakers.length;
            this.rotateTo(nextIdx);
        });

        nextBtn?.addEventListener('click', () => {
            const nextIdx = (index + 1) % this.speakers.length;
            this.rotateTo(nextIdx);
        });
    }

    renderFallbackUI() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="speakers-fallback-grid">
                ${this.speakers.map((sp, i) => `
                    <div class="speaker-fallback-card">
                        <h3>0${i + 1}. ${sp.name}</h3>
                        <p class="role">${sp.title || ''}</p>
                        <p class="bio">${sp.bio || ''}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    destroy() {
        this.destroyed = true;
        if (this.onResize) window.removeEventListener('resize', this.onResize);
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
    }
}

/* ─── React Bits Liquid Ether Background Shader Module ─────────────
 * GPU-accelerated liquid ether background inspired by cosmic space nebula:
 * Deep Void (#060814), Midnight Navy (#0F1A2E), Steel Blue (#1B365D), Dusty Plum (#482A54), Ice Blue (#38BDF8), Rose Plum Dust (#8C5285).
 * -------------------------------------------------------------------- */
import * as THREE from 'three';

export class LiquidEther {
    constructor(container, options = {}) {
        if (!container) return;
        this.container = container;
        this.options = Object.assign({
            colors: ['#060814', '#0F1A2E', '#1B365D', '#482A54', '#38BDF8', '#8C5285'],
            mouseForce: 15,
            cursorSize: window.innerWidth < 768 ? 70 : 110,
            autoSpeed: 0.3,
            autoIntensity: 1.3,
            viscosity: 0.95,
            resolutionScale: window.innerWidth < 768 ? 0.45 : 0.6,
        }, options);

        this.width = 0;
        this.height = 0;
        this.mouse = new THREE.Vector2(-10, -10);
        this.prevMouse = new THREE.Vector2(-10, -10);
        this.mouseVel = new THREE.Vector2(0, 0);
        this.isInteracting = false;
        this.idleTimer = 0;
        this.autoTime = 0;
        this.destroyed = false;

        this.init();
    }

    init() {
        const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.isReduced = isReduced;

        // Size setup
        this.width = this.container.clientWidth || window.innerWidth;
        this.height = this.container.clientHeight || window.innerHeight;

        // WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isReduced ? 1.0 : 1.5));
        this.renderer.setSize(this.width, this.height);
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.display = 'block';
        this.container.appendChild(this.renderer.domElement);

        // Simulation Render Targets (Double buffering for fluid simulation)
        const simW = Math.max(64, Math.floor(this.width * this.options.resolutionScale));
        const simH = Math.max(64, Math.floor(this.height * this.options.resolutionScale));
        this.simW = simW;
        this.simH = simH;

        const rtParams = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType || THREE.FloatType,
            depthBuffer: false,
            stencilBuffer: false
        };

        this.rtA = new THREE.WebGLRenderTarget(simW, simH, rtParams);
        this.rtB = new THREE.WebGLRenderTarget(simW, simH, rtParams);

        // Camera & Quad Scene
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.scene = new THREE.Scene();
        this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
        this.scene.add(this.quad);

        // Palette setup
        const hexColors = this.options.colors.map(c => new THREE.Color(c));

        // Shaders
        this.simMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTexture: { value: null },
                uResolution: { value: new THREE.Vector2(simW, simH) },
                uMouse: { value: new THREE.Vector2(-10, -10) },
                uMouseVel: { value: new THREE.Vector2(0, 0) },
                uRadius: { value: this.options.cursorSize / Math.max(this.width, this.height) },
                uForce: { value: this.options.mouseForce },
                uViscosity: { value: this.options.viscosity },
                uTime: { value: 0 },
                uDt: { value: 0.016 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position.xy, 0.0, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                varying vec2 vUv;
                uniform sampler2D uTexture;
                uniform vec2 uResolution;
                uniform vec2 uMouse;
                uniform vec2 uMouseVel;
                uniform float uRadius;
                uniform float uForce;
                uniform float uViscosity;
                uniform float uTime;
                uniform float uDt;

                // Simplex noise for organic cosmic fluid turbulence
                vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
                float snoise(vec2 v){
                    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                                     -0.577350269189626, 0.024390243902439);
                    vec2 i  = floor(v + dot(v, C.yy) );
                    vec2 x0 = v -   i + dot(i, C.xx);
                    vec2 i1;
                    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                    vec4 x12 = x0.xyxy + C.xxzz;
                    x12.xy -= i1;
                    i = mod(i, 289.0);
                    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
                    + i.x + vec3(0.0, i1.x, 1.0 ));
                    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                    m = m*m ;
                    m = m*m ;
                    vec3 x = 2.0 * fract(p * C.www) - 1.0;
                    vec3 h = abs(x) - 0.5;
                    vec3 ox = floor(x + 0.5);
                    vec3 a0 = x - ox;
                    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
                    vec3 g;
                    g.x  = a0.x  * x0.x  + h.x  * x0.y;
                    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                    return 130.0 * dot(m, g);
                }

                void main() {
                    vec2 texel = 1.0 / uResolution;
                    vec4 data = texture2D(uTexture, vUv);

                    // Advection & Diffusion
                    vec2 vel = data.xy;
                    vec2 uvPrev = vUv - vel * uDt * 0.22;
                    vec4 prev = texture2D(uTexture, uvPrev);

                    // Mouse Interaction Impulse
                    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
                    float d = length((vUv - uMouse) * aspect);
                    float mImpulse = exp(-d * d / (uRadius * uRadius * 0.06));
                    vel += uMouseVel * mImpulse * uForce * 0.05;

                    // Organic Cosmic Nebula Ambient Motion
                    float n1 = snoise(vUv * 3.0 + vec2(uTime * 0.06, uTime * 0.04));
                    float n2 = snoise(vUv * 3.5 - vec2(uTime * 0.04, uTime * 0.07));
                    vec2 ambientFlow = vec2(n1, n2) * 0.004;

                    vel = mix(vel, prev.xy + ambientFlow, uViscosity);
                    vel *= 0.965; // Soft dampening for smooth nebula motion

                    float density = prev.z * 0.985 + length(vel) * 0.09 + mImpulse * 0.15;

                    gl_FragColor = vec4(vel, density, 1.0);
                }
            `
        });

        this.displayMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTexture: { value: null },
                uColor0: { value: hexColors[0] },
                uColor1: { value: hexColors[1] },
                uColor2: { value: hexColors[2] },
                uColor3: { value: hexColors[3] },
                uColor4: { value: hexColors[4] },
                uColor5: { value: hexColors[5] },
                uTime: { value: 0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position.xy, 0.0, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                varying vec2 vUv;
                uniform sampler2D uTexture;
                uniform vec3 uColor0;
                uniform vec3 uColor1;
                uniform vec3 uColor2;
                uniform vec3 uColor3;
                uniform vec3 uColor4;
                uniform vec3 uColor5;
                uniform float uTime;

                void main() {
                    vec4 fluid = texture2D(uTexture, vUv);
                    float velLen = length(fluid.xy);
                    float density = clamp(fluid.z + velLen * 1.1, 0.0, 2.0);

                    // Cosmic Nebula Gradient blending (Deep Navy, Steel Blue, Dusty Plum & Ice Blue)
                    vec3 cA = mix(uColor0, uColor1, smoothstep(0.0, 0.4, density));
                    vec3 cB = mix(uColor2, uColor3, smoothstep(0.2, 0.7, density));
                    vec3 cC = mix(uColor4, uColor5, smoothstep(0.4, 1.2, density));

                    vec3 color = mix(cA, cB, clamp(density * 1.0, 0.0, 1.0));
                    color = mix(color, cC, clamp((density - 0.35) * 1.4, 0.0, 1.0));

                    // Ambient cosmic shimmer
                    float sheen = sin(vUv.x * 15.0 + vUv.y * 15.0 + uTime * 0.9) * 0.03;
                    color += vec3(sheen * 0.4, sheen * 0.6, sheen * 0.95);

                    float alpha = smoothstep(0.02, 0.75, density);
                    gl_FragColor = vec4(color, alpha * 0.72);
                }
            `,
            transparent: true
        });

        // Event Listeners
        this.setupEvents();

        // Start Loop
        this.clock = new THREE.Clock();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    setupEvents() {
        this.onPointerMove = (e) => {
            const x = e.clientX / window.innerWidth;
            const y = 1.0 - (e.clientY / window.innerHeight);

            if (this.prevMouse.x < 0) {
                this.prevMouse.set(x, y);
            }

            this.mouseVel.set(x - this.prevMouse.x, y - this.prevMouse.y);
            this.mouse.set(x, y);
            this.prevMouse.set(x, y);

            this.isInteracting = true;
            this.idleTimer = 0;
        };

        window.addEventListener('pointermove', this.onPointerMove, { passive: true });

        this.onResize = () => {
            if (this.destroyed) return;
            this.width = this.container.clientWidth || window.innerWidth;
            this.height = this.container.clientHeight || window.innerHeight;
            this.renderer.setSize(this.width, this.height);

            const isMobile = window.innerWidth < 768;
            const scale = isMobile ? 0.35 : 0.5;
            this.simW = Math.max(64, Math.floor(this.width * scale));
            this.simH = Math.max(64, Math.floor(this.height * scale));

            this.rtA.setSize(this.simW, this.simH);
            this.rtB.setSize(this.simW, this.simH);

            this.simMaterial.uniforms.uResolution.value.set(this.simW, this.simH);
        };

        window.addEventListener('resize', this.onResize);
    }

    animate() {
        if (this.destroyed) return;
        requestAnimationFrame(this.animate);

        const delta = Math.min(this.clock.getDelta(), 0.05);
        const elapsedTime = this.clock.getElapsedTime();

        // Idle Auto-Demo motion
        this.idleTimer += delta;
        if (this.idleTimer > 0.8) {
            this.autoTime += delta * this.options.autoSpeed;
            const autoX = 0.5 + Math.sin(this.autoTime * 0.9) * 0.35 + Math.cos(this.autoTime * 1.7) * 0.15;
            const autoY = 0.5 + Math.cos(this.autoTime * 1.1) * 0.3 + Math.sin(this.autoTime * 2.1) * 0.12;

            if (this.prevMouse.x < 0) this.prevMouse.set(autoX, autoY);
            this.mouseVel.set((autoX - this.prevMouse.x) * 0.3, (autoY - this.prevMouse.y) * 0.3);
            this.mouse.set(autoX, autoY);
            this.prevMouse.set(autoX, autoY);
        }

        // Reduce rate if prefers-reduced-motion is active
        if (this.isReduced && Math.floor(elapsedTime * 30) % 2 !== 0) {
            return;
        }

        // 1. Simulation Step (Ping-pong buffer)
        this.simMaterial.uniforms.uTexture.value = this.rtA.texture;
        this.simMaterial.uniforms.uMouse.value.copy(this.mouse);
        this.simMaterial.uniforms.uMouseVel.value.copy(this.mouseVel);
        this.simMaterial.uniforms.uTime.value = elapsedTime;
        this.simMaterial.uniforms.uDt.value = delta;

        this.quad.material = this.simMaterial;
        this.renderer.setRenderTarget(this.rtB);
        this.renderer.render(this.scene, this.camera);

        // Swap RTs
        const temp = this.rtA;
        this.rtA = this.rtB;
        this.rtB = temp;

        // 2. Display Step
        this.displayMaterial.uniforms.uTexture.value = this.rtA.texture;
        this.displayMaterial.uniforms.uTime.value = elapsedTime;

        this.quad.material = this.displayMaterial;
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene, this.camera);

        // Decay mouse velocity
        this.mouseVel.multiplyScalar(0.85);
    }

    destroy() {
        this.destroyed = true;
        window.removeEventListener('pointermove', this.onPointerMove);
        window.removeEventListener('resize', this.onResize);

        if (this.rtA) this.rtA.dispose();
        if (this.rtB) this.rtB.dispose();
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
    }
}

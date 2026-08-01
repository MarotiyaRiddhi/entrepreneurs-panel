/* ─── Schwarzschild Black Hole Raymarching Shader (Vivid Clarity Edition) ───
 * Defined black hole event horizon core, intense glowing photon ring,
 * and high-contrast neon accretion vortex:
 * Neon Violet (#A855F7), Neon Cyan (#22D3EE), Amber (#FF8A3D) on #050308.
 * -------------------------------------------------------------------- */

export const vertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const fragmentShader = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform vec2  uResolution;
uniform float uTime;
uniform vec3  uCamPos;
uniform vec3  uCamTarget;
uniform float uFov;

uniform float uFormation;   // curvature: how hard spacetime bends
uniform float uHorizon;     // the black disc horizon
uniform float uReveal;      // 0 -> void, 1 -> full star field
uniform float uSeed;        // brightness of pre-collapse point
uniform float uDisk;        // accretion disk brightness
uniform float uDiskGain;    // per-viewport trim on brightness
uniform float uPulse;       // ripple wave
uniform vec2  uMouse;       // -1..1, eased

const float PI = 3.14159265359;

/* ── noise ──────────────────────────────────────────────────────── */
float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453);
}

float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
        mix(mix(hash13(i + vec3(0, 0, 0)), hash13(i + vec3(1, 0, 0)), f.x),
            mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
        mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
            mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y),
        f.z);
}

float fbm(vec3 p) {
    float a = 0.5, sum = 0.0, norm = 0.0;
    for (int i = 0; i < 3; i++) {
        sum += a * noise3(p);
        norm += a;
        a *= 0.5;
        p *= 2.03;
    }
    return sum / norm;
}

float fbm2(vec3 p) {
    return (0.5 * noise3(p) + 0.25 * noise3(p * 2.03)) / 0.75;
}

/* ── accretion disk with defined spiral swirls & vivid core ────── */
const float R_IN  = 2.5;
const float R_OUT = 13.5;

vec3 diskEmission(vec3 p, vec3 rd) {
    float dScale = mix(2.25, 1.0, clamp(uDisk, 0.0, 1.0));
    float rIn = R_IN * dScale;
    float rOut = R_OUT * dScale;

    if (abs(p.y) > 1.1 * dScale) return vec3(0.0);

    float r = length(p.xz);
    if (r < rIn || r > rOut) return vec3(0.0);

    float t = (r - rIn) / (rOut - rIn);
    float h = (0.18 + 0.65 * t * t) * dScale;
    float vert = exp(-(p.y * p.y) / (2.0 * h * h));
    if (vert < 0.004) return vec3(0.0);

    /* Keplerian rotation & defined spiral streaks */
    float ang = atan(p.z, p.x);
    float rk = max(r, 0.8);
    float w = uTime * 2.6 * inversesqrt(rk) / rk;

    vec3 q = vec3(cos(ang + w), sin(ang + w), r * 0.65 + uTime * 0.08) * (1.8 + r * 0.35);
    float n1 = fbm2(q * 1.8);

    float dens = vert
        * smoothstep(0.0, 0.20, t)
        * (1.0 - smoothstep(0.65, 1.0, t))
        * (0.35 + 1.25 * n1);

    /* Vivid Legible Palette:
       - Hot core: brilliant white-violet
       - Inner disc: Neon Cyan (#22D3EE)
       - Main disc body: Neon Violet (#A855F7)
       - Outer rim: Amber (#FF8A3D)
    */
    vec3 hot    = vec3(0.98, 0.96, 1.00);
    vec3 cyan   = vec3(0.133, 0.827, 0.933);
    vec3 violet = vec3(0.659, 0.333, 0.969);
    vec3 amber  = vec3(1.000, 0.541, 0.239);

    vec3 col = mix(hot, cyan, smoothstep(0.0, 0.22, t));
    col = mix(col, violet, smoothstep(0.22, 0.60, t));
    col = mix(col, amber, smoothstep(0.60, 1.0, t));

    /* Relativistic beaming */
    vec3 vel = normalize(vec3(-p.z, 0.0, p.x));
    float beta = 0.46 / sqrt(max(r, 1.0));
    float dop = 1.0 / (1.0 - beta * dot(vel, -rd));
    col *= pow(clamp(dop, 0.3, 3.0), 2.2);

    /* Gravitational redshift */
    float g = sqrt(max(1.0 - 1.0 / max(r, 1.02), 0.0));
    col *= pow(g, 1.4);
    col.b *= mix(0.78, 1.0, g);

    return col * dens * (1.3 / (1.0 + t * 4.2));
}

/* ── deep field ─────────────────────────────────────────────────── */
vec3 starLayer(vec3 d, float scale, float cut, float bright) {
    vec3 p = d * scale;
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 r = hash33(i);

    if (r.x < cut) return vec3(0.0);

    vec3 c = vec3(0.5) + (r - 0.5) * 0.7;
    float s = smoothstep(0.11, 0.0, length(f - c));
    s *= 0.75 + 0.25 * sin(uTime * (0.5 + r.y * 1.5) + r.z * 6.28);

    vec3 tint = mix(vec3(0.659, 0.333, 0.969), vec3(0.133, 0.827, 0.933), r.y);
    return tint * s * bright * (0.4 + r.z);
}

vec3 background(vec3 d) {
    vec3 col = vec3(0.0);
    col += starLayer(d, 40.0, 0.948, 1.2);
    col += starLayer(d, 90.0, 0.965, 0.65);
    col += starLayer(d, 180.0, 0.978, 0.35);

    vec3 q = d * 1.65 + vec3(0.0, 0.0, uTime * 0.008);
    float w1 = fbm(q + fbm(q * 1.55) * 1.35);
    float w2 = fbm(q * 2.2 + 5.0);

    float dens = smoothstep(0.38, 0.85, w1);
    vec3 neb = mix(vec3(0.020, 0.012, 0.031), vec3(0.48, 0.18, 0.72), w2);
    neb = mix(neb, vec3(0.05, 0.35, 0.48), smoothstep(0.3, 0.9, w2));

    return col + neb * dens * 0.9;
}

/* ── tone mapping ───────────────────────────────────────────────── */
vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
    vec2 uv = vUv - 0.5;
    uv.x *= uResolution.x / uResolution.y;

    vec3 ro = uCamPos;
    vec3 fwd = normalize(uCamTarget - ro);
    vec3 rgt = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(rgt, fwd);

    vec3 rd = normalize(fwd * uFov + rgt * uv.x + up * uv.y);
    vec3 dir = rd;

    vec3 l = cross(ro, dir);
    float h2 = dot(l, l) * uFormation;

    float rActive = max(15.0, R_OUT * mix(2.25, 1.0, clamp(uDisk, 0.0, 1.0)) + 2.0);

    float b = dot(ro, dir);
    float c = dot(ro, ro) - rActive * rActive;
    float disc = b * b - c;

    vec3 pos = ro;
    bool enters = disc > 0.0;

    if (enters) {
        float tEnter = -b - sqrt(disc);
        if (tEnter > 0.0) pos = ro + dir * tEnter;
    }

    float horizon = mix(0.02, 1.0, uHorizon);
    float minR = 1e9;

    vec3 col = vec3(0.0);
    float trans = 1.0;
    bool captured = false;

    for (int i = 0; i < STEPS; i++) {
        if (!enters) break;

        float r = length(pos);
        minR = min(minR, r);

        if (r < horizon) { captured = true; break; }
        if (r > rActive + 4.0 && dot(dir, pos) > 0.0) break;

        float dt = clamp(r * 0.115, 0.035, 0.9);

        vec3 e = diskEmission(pos, dir);
        if (e.r + e.g + e.b > 0.0) {
            col += e * trans * dt * uDisk * uDiskGain;
            trans *= exp(-dt * 0.5 * length(e));
        }

        float r2 = r * r;
        dir += (-1.5 * h2 * pos / (r2 * r2 * r)) * dt;
        pos += dir * dt;
    }

    if (!captured) {
        col += background(normalize(dir)) * trans * uReveal;
    }

    /* Core Event Horizon Glow & Defined Photon Ring in Neon Violet */
    float ring = smoothstep(0.09, 0.0, abs(minR - 1.5 * horizon));
    col += vec3(0.72, 0.38, 1.00) * ring * 1.8 * uFormation * uDisk;

    /* Central Event Horizon Soft Halo */
    float coreGlow = smoothstep(2.8 * horizon, 1.0 * horizon, minR);
    col += vec3(0.133, 0.827, 0.933) * coreGlow * 0.45 * uFormation;

    /* Stardust seed */
    float align = max(dot(rd, normalize(-ro)), 0.0);
    col += vec3(0.90, 0.80, 1.00) * pow(align, mix(14000.0, 1400.0, uFormation)) * uSeed;

    /* Launch pulse ring in Neon Cyan */
    if (uPulse > 0.001) {
        float ang2 = acos(clamp(align, -1.0, 1.0));
        float wave = smoothstep(0.06, 0.0, abs(ang2 - uPulse * 0.9));
        col += vec3(0.133, 0.827, 0.933) * wave * (1.0 - uPulse) * 0.6;
    }

    col = aces(col * 1.05);
    col = pow(col, vec3(0.4545));

    vec2 v = vUv - 0.5;
    col *= 1.0 - dot(v, v) * 0.75;

    gl_FragColor = vec4(col, 1.0);
}
`;

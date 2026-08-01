/* Field state for mass placement & gravitational lensing coordinates */
export const field = {
    x: 0.5,
    y: 0.42,
    strength: 0,
    ready: false,
    fall: 0,
};

export const projectHole = (camPos, camTarget, fov, width, height) => {
    const fx = camTarget.x - camPos.x;
    const fy = camTarget.y - camPos.y;
    const fz = camTarget.z - camPos.z;
    const fl = Math.hypot(fx, fy, fz) || 1;
    const f = [fx / fl, fy / fl, fz / fl];

    let r = [f[2] * 1, 0, -f[0] * 1];
    const rl = Math.hypot(r[0], r[1], r[2]) || 1;
    r = [r[0] / rl, r[1] / rl, r[2] / rl];

    const u = [
        r[1] * f[2] - r[2] * f[1],
        r[2] * f[0] - r[0] * f[2],
        r[0] * f[1] - r[1] * f[0],
    ];

    const dl = Math.hypot(camPos.x, camPos.y, camPos.z) || 1;
    const d = [-camPos.x / dl, -camPos.y / dl, -camPos.z / dl];

    const dz = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
    if (dz <= 0.0001) return null;

    const k = fov / dz;
    const su = (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) * k;
    const sv = (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) * k;

    const aspect = width / height;
    return {
        x: (su / aspect + 0.5) * width,
        y: (0.5 - sv) * height,
    };
};

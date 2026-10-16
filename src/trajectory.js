import { ATTRACTORS, RK4 } from './attractors.js';

export function computeTrajectory(settings) {
    const { dt, T, scale, x0, y0, z0, attractor } = settings;
    if (![dt, T, scale, x0, y0, z0].every(Number.isFinite) || dt <= 0 || T <= 0 || scale <= 0)
        throw new Error('Use finite values with positive dt, duration and scale.');
    const count = Math.floor(T / dt) + 1;
    if (count > 400001) throw new Error('Limit is 400,000 integration steps. Increase dt or reduce duration.');
    if (count < 3) throw new Error('Duration must include at least two integration steps.');
    const positions = new Float32Array(count * 3);
    const times = new Float32Array(count);
    const speeds = new Float32Array(count);
    let state = [x0, y0, z0];
    let maxSpeed = 0;
    const ode = ATTRACTORS[attractor].ode;
    for (let i = 0; i < count; i++) {
        if (!state.every(v => Number.isFinite(v) && Math.abs(v) < 1e6))
            throw new Error(`Trajectory diverged at step ${i}. Try a smaller dt or the preset initial state.`);
        positions.set([state[0] * scale, state[2] * scale, state[1] * scale], i * 3);
        times[i] = i / (count - 1);
        const velocity = ode(i * dt, state);
        speeds[i] = Math.hypot(...velocity);
        maxSpeed = Math.max(maxSpeed, speeds[i]);
        if (i < count - 1) state = RK4(ode, dt, i * dt, state);
    }
    for (let i = 0; i < count; i++) speeds[i] /= maxSpeed || 1;
    return { positions, times, speeds, count };
}

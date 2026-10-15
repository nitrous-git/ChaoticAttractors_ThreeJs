// Original equations, preset values, coordinate mapping and RK4 method preserved.
export function RK4(fun, dt, t0, y0) {
    const c1 = fun(t0, y0);

    const y_c2 = [y0[0] + (dt / 2) * c1[0],
                        y0[1] + (dt / 2) * c1[1],
                        y0[2] + (dt / 2) * c1[2]];
    const c2 = fun(t0 + dt / 2, y_c2);

    const y_c3 = [y0[0] + (dt / 2) * c2[0],
                        y0[1] + (dt / 2) * c2[1],
                        y0[2] + (dt / 2) * c2[2]];
    const c3 = fun(t0 + dt / 2, y_c3);

    const y_c4 = [y0[0] + dt * c3[0],
                        y0[1] + dt * c3[1],
                        y0[2] + dt * c3[2]];
    const c4 = fun(t0 + dt, y_c4);

    return [y0[0] + (dt / 6) * (c1[0] + 2 * c2[0] + 2 * c3[0] + c4[0]),
            y0[1] + (dt / 6) * (c1[1] + 2 * c2[1] + 2 * c3[1] + c4[1]),
            y0[2] + (dt / 6) * (c1[2] + 2 * c2[2] + 2 * c3[2] + c4[2])];
}

// Attractor presets
// ------------------------------------------------------------

export const ATTRACTORS = {
    Aizawa: {
        name: "Aizawa",
        initial: [0.1, 0.0, 0.0],
        dt: 0.01,
        T: 600,
        scale: 3,
        maxPointsPerFrame : 13,

        cameraPosition: [0, 3, 10],
        cameraLookAt: [0, 2, 0],

        ode: function aizawa(t, state) {
            const x = state[0];
            const y = state[1];
            const z = state[2];

            const a = 0.95;
            const b = 0.7;
            const c = 0.6;
            const d = 3.5;
            const e = 0.25;
            const f = 0.1;

            const dx = (z - b) * x - d * y;
            const dy = d * x + (z - b) * y;
            const dz =
                c +
                a * z -
                (z ** 3) / 3 -
                (x ** 2 + y ** 2) * (1 + e * z) +
                f * z * (x ** 3);

            return [dx, dy, dz];
        },
    },

    Lorenz: {
        name: "Lorenz",
        initial: [-8, 8, 27],
        dt: 0.001,
        T: 200,
        scale: 1.8,
        maxPointsPerFrame : 50,

        cameraPosition: [0, 45, 80],
        cameraLookAt: [0, 45, 0],

        ode: function lorenz(t, state) {
            const x = state[0];
            const y = state[1];
            const z = state[2];

            const a = 10;
            const b = 8 / 3;
            const c = 28;

            const dx = a * (y - x);
            const dy = x * (c - z) - y;
            const dz = x * y - b * z;

            return [dx, dy, dz];
        },
    },

    Rossler: {
        name: "Rossler",
        initial: [0.1, 0.0, 0.0],
        dt: 0.01,
        T: 1000,
        scale: 1.6,
        maxPointsPerFrame : 35,

        cameraPosition: [0, 15, 45],
        cameraLookAt: [0, 8, 0],

        ode: function rossler(t, state) {
            const x = state[0];
            const y = state[1];
            const z = state[2];

            const a = 0.2;
            const b = 0.2;
            const c = 5.7;

            const dx = -y - z;
            const dy = x + a * y;
            const dz = b + z * (x - c);

            return [dx, dy, dz];
        },
    },

    Thomas: {
        label: "Thomas",
        initial: [1.0, 0.0, -1.0],
        dt: 0.01,
        T: 1800,
        scale: 12.0,
        maxPointsPerFrame : 35,

        cameraPosition: [45, 45, 45],
        cameraLookAt: [0, 0, 0],

        ode: function thomas(t, state) {
            const x = state[0];
            const y = state[1];
            const z = state[2];

            const b = 0.208186;

            const dx = Math.sin(y) - b * x;
            const dy = Math.sin(z) - b * y;
            const dz = Math.sin(x) - b * z;

            return [dx, dy, dz];
        },
    },

    Halvorsen: {
        label: "Halvorsen",
        initial: [0.1, 0.0, 0.0],
        dt: 0.005,
        T: 250,
        scale: 5.0,
        maxPointsPerFrame : 25,

        cameraPosition: [45, 45, 45],
        cameraLookAt: [0, 0, 0],

        ode: function halvorsen(t, state) {
            const x = state[0];
            const y = state[1];
            const z = state[2];

            const a = 1.4;

            const dx = -a * x - 4 * y - 4 * z - y * y;
            const dy = -a * y - 4 * z - 4 * x - z * z;
            const dz = -a * z - 4 * x - 4 * y - x * x;

            return [dx, dy, dz];
        },
    },

    Dadras: {
        label: "Dadras",
        initial: [1.0, 1.0, 1.0],
        dt: 0.005,
        T: 900,
        scale: 2.0,
        maxPointsPerFrame : 30,

        cameraPosition: [60, 45, 25],
        cameraLookAt: [2, 5, 0],

        ode: function dadras(t, state) {
            const x = state[0];
            const y = state[1];
            const z = state[2];

            const a = 2.6;
            const b = 2.7;
            const c = 2.8;
            const d = 3.0;
            const e = 7.4;

            const dx = y - a * x + b * y * z;
            const dy = c * y - x * z + z;
            const dz = d * x * y - e * z;

            return [dx, dy, dz];
        },
    },

    Misc_01: {
        name: "Misc_01",
        initial: [1.0, 0.0, 0.0],
        dt: 0.01,
        T: 300,
        scale: 3,
        maxPointsPerFrame : 30,

        cameraPosition: [0, 0, 5],
        cameraLookAt: [0, 0, 0],

        ode: function misc01(t, state) {
            const x = state[0];
            const y = state[1];
            const z = state[2];

            const a = 0.01;   // 0.001 0.01, 0.4 are pretty cool !!

            const dx = y + z;
            const dy = -x + a*y;
            const dz = x**2 - z;

            return [dx, dy, dz];
        },
    },

};


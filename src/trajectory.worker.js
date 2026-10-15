import { computeTrajectory } from './trajectory.js';
self.onmessage = ({ data }) => {
    try {
        const result = computeTrajectory(data.settings);
        self.postMessage({ id: data.id, result }, [result.positions.buffer, result.times.buffer, result.speeds.buffer]);
    } catch (error) {
        self.postMessage({ id: data.id, error: error.message });
    }
};

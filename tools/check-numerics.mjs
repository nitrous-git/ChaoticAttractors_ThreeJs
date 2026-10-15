import assert from 'node:assert/strict';
import { ATTRACTORS, RK4 } from '../src/attractors.js';
import { computeTrajectory } from '../src/trajectory.js';
// Verify RK4 order on y'=y against the exact exponential solution.
function error(dt) {let y=[1,1,1];for(let i=0;i<Math.round(1/dt);i++) y=RK4((t,s)=>s,dt,i*dt,y);return Math.abs(y[0]-Math.E);}
assert.ok(error(.1)/error(.05)>14);
for(const [name,d] of Object.entries(ATTRACTORS)){
 const s={attractor:name,dt:d.dt,T:d.T,scale:d.scale,x0:d.initial[0],y0:d.initial[1],z0:d.initial[2]};
 const r=computeTrajectory(s);
 assert.equal(r.count,Math.floor(d.T/d.dt)+1);
 assert.ok(r.positions.every(Number.isFinite));assert.ok(r.speeds.every(v=>v>=0&&v<=1));
 assert.ok(Math.abs(r.positions[1]-d.initial[2]*d.scale)<1e-5);
 assert.throws(()=>computeTrajectory({...s,dt:0}));
 assert.throws(()=>computeTrajectory({...s,dt:.001,T:3000}));
 console.log(`${name}: ${r.count.toLocaleString()} finite samples`);
}
assert.throws(()=>computeTrajectory({attractor:'Lorenz',dt:.05,T:100,scale:1,x0:1e5,y0:1e5,z0:1e5}),/diverged/);
console.log('RK4 convergence, coordinate mapping, presets and numerical guards passed.');

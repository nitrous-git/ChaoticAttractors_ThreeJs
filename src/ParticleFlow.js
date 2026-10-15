import * as THREE from 'three';
import { particleFlowVertex, particleFlowFragment } from './particleFlowShaders.js';

// One draw call for the swarm and its optional trailing samples. No per-frame
// particle position uploads or CPU ODE integration. The RK4 path remains intact.
export class ParticleFlow {
    constructor(renderer, sharedUniforms, settings) {
        this.maxTextureSize = renderer.capabilities.maxTextureSize;
        this.time = 0;
        this.travel = 0;
        this.pathTexture = null;
        this.frameTexture = null;
        const gl = renderer.getContext();
        this.uniforms = {
            uColorA: sharedUniforms.uColorA, uColorB: sharedUniforms.uColorB,
            uColorC: sharedUniforms.uColorC, uColorMode: sharedUniforms.uColorMode,
            uHead: sharedUniforms.uHead, uTrail: sharedUniforms.uTrail,
            uPixelRatio: sharedUniforms.uPixelRatio,
            uPath:{value:null}, uFrames:{value:null}, uTextureSize:{value:new THREE.Vector2(1,1)},
            uCount:{value:2}, uTime:{value:0}, uTravel:{value:0}, uRate:{value:0},
            uRadius:{value:1}, uCenter:{value:new THREE.Vector3()},
            uMaxPointSize:{value:gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1]},
            uFlowSpeed:{value:1}, uSpeedVariation:{value:0.7},
            uSpread:{value:0.035}, uTurbulence:{value:1}, uNoiseScale:{value:3},
            uNoiseSpeed:{value:0.7}, uSwirl:{value:1}, uPointSize:{value:3},
            uOpacity:{value:0.5}, uBrightness:{value:2}, uFollowReveal:{value:0}
        };
        this.material = new THREE.ShaderMaterial({
            uniforms:this.uniforms, vertexShader:particleFlowVertex, fragmentShader:particleFlowFragment,
            transparent:true, depthWrite:false, blending:THREE.AdditiveBlending
        });
        this.points = new THREE.Points(new THREE.BufferGeometry(),this.material);
        // Shader displacement makes the dummy position attribute's bounds invalid.
        this.points.frustumCulled = false;
        this.points.visible = false;
        this.setParticleCount(settings.particleCount,settings.particleTrails);
    }

    setParticleCount(count, trails=1) {
        count = THREE.MathUtils.clamp(Math.round(Number(count)),1000,100000);
        trails = THREE.MathUtils.clamp(Math.round(Number(trails)),0,3);
        if(this.count===count && this.trails===trails)return;
        this.count=count; this.trails=trails;
        const total=count*(trails+1);
        const seeds=new Float32Array(total*4), tails=new Float32Array(total);
        // Stable randomness keeps a count/trail change visually predictable.
        let state=0x1234abcd;
        const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
        for(let i=0;i<count;i++){
            const seed=[random(),random(),random(),random()];
            for(let tail=0;tail<=trails;tail++){
                const index=tail*count+i;
                seeds.set(seed,index*4);tails[index]=tail;
            }
        }
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(total*3),3));
        geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,4));
        geometry.setAttribute('aTail',new THREE.BufferAttribute(tails,1));
        this.points.geometry.dispose();this.points.geometry=geometry;
    }

    setTrajectory(result,sphere) {
        const {count,positions,speeds}=result;
        const width=Math.min(1024,this.maxTextureSize,count), height=Math.ceil(count/width);
        if(height>this.maxTextureSize)throw new Error('Trajectory exceeds GPU texture capacity.');
        const path=new Float32Array(width*height*4), frames=new Float32Array(width*height*4);
        const tangent=new THREE.Vector3(), normal=new THREE.Vector3(1,0,0);
        const previousTangent=new THREE.Vector3(0,1,0), rotation=new THREE.Quaternion();
        const fallback=new THREE.Vector3();
        let length=0;
        for(let i=0;i<count;i++){
            const p=i*3, t=i*4;
            path.set([positions[p],positions[p+1],positions[p+2],speeds[i]],t);
            const a=Math.max(0,i-1)*3, b=Math.min(count-1,i+1)*3;
            tangent.set(positions[b]-positions[a],positions[b+1]-positions[a+1],positions[b+2]-positions[a+2]);
            if(tangent.lengthSq()<1e-12)tangent.copy(previousTangent);else tangent.normalize();
            if(i===0){
                fallback.set(Math.abs(tangent.x)<0.8?1:0,Math.abs(tangent.x)<0.8?0:1,0);
                normal.copy(fallback).addScaledVector(tangent,-fallback.dot(tangent)).normalize();
            }else{
                // Parallel transport avoids sudden flips of a world-axis frame.
                rotation.setFromUnitVectors(previousTangent,tangent);
                normal.applyQuaternion(rotation).addScaledVector(tangent,-normal.dot(tangent)).normalize();
                length+=Math.hypot(positions[p]-positions[p-3],positions[p+1]-positions[p-2],positions[p+2]-positions[p-1]);
            }
            frames.set([normal.x,normal.y,normal.z,0],t);
            previousTangent.copy(tangent);
        }
        const texture=data=>{
            const tex=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);
            // Manual interpolation works across row boundaries, without requiring
            // float-linear filtering. Sample coordinates address texel centers.
            tex.minFilter=tex.magFilter=THREE.NearestFilter;
            tex.generateMipmaps=false;tex.needsUpdate=true;
            return tex;
        };
        const newPath=texture(path),newFrames=texture(frames);
        this.pathTexture?.dispose();this.frameTexture?.dispose();
        this.pathTexture=newPath;this.frameTexture=newFrames;
        const u=this.uniforms;
        u.uPath.value=newPath;u.uFrames.value=newFrames;
        u.uTextureSize.value.set(width,height);u.uCount.value=count;
        u.uRadius.value=Math.max(sphere.radius,0.001);u.uCenter.value.copy(sphere.center);
        // Mean travel speed approximately 0.55 bounding radii/second at 1x.
        // Original RK4 sampling preserves local acceleration along the path.
        u.uRate.value=length>1e-9 ? Math.min(0.15,0.55*u.uRadius.value/length) : 0;
        this.reset();
    }

    reset(){this.time=0;this.travel=0;this.uniforms.uTime.value=0;this.uniforms.uTravel.value=0;}

    update(delta,settings,running) {
        if(running){this.time+=delta;this.travel+=delta*settings.flowSpeed;}
        const u=this.uniforms;
        u.uTime.value=this.time;u.uTravel.value=this.travel;
        u.uFlowSpeed.value=settings.flowSpeed;u.uSpeedVariation.value=settings.speedVariation;
        u.uSpread.value=settings.flowSpread;u.uTurbulence.value=settings.turbulence;
        u.uNoiseScale.value=settings.noiseScale;u.uNoiseSpeed.value=settings.noiseSpeed;
        u.uSwirl.value=settings.swirl;u.uPointSize.value=settings.pointSize;
        u.uOpacity.value=settings.cloudOpacity;u.uBrightness.value=settings.particleBrightness;
        u.uFollowReveal.value=settings.particlesFollowReveal?1:0;
        this.points.visible=!!this.pathTexture && settings.mode!=='Trajectory';
    }

    dispose(){
        this.points.removeFromParent();this.points.geometry.dispose();this.material.dispose();
        this.pathTexture?.dispose();this.frameTexture?.dispose();
    }
}

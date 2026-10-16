import { paletteGLSL } from './shaders.js';

// Analytic derivatives of smooth 3-D value noise. Three scalar potentials
// give a coherent curl field, without six finite-difference noise evaluations.
const noiseGLSL = `
float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}
vec4 noiseDerivative(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = f*f*f*(f*(f*6.0-15.0)+10.0);
    vec3 du = 30.0*f*f*(f*(f-2.0)+1.0);
    float a = hash31(i), b = hash31(i+vec3(1,0,0));
    float c = hash31(i+vec3(0,1,0)), d = hash31(i+vec3(1,1,0));
    float e = hash31(i+vec3(0,0,1)), f1 = hash31(i+vec3(1,0,1));
    float g = hash31(i+vec3(0,1,1)), h = hash31(i+vec3(1,1,1));
    float k1=b-a, k2=c-a, k3=e-a;
    float k4=a-b-c+d, k5=a-c-e+g, k6=a-b-e+f1;
    float k7=-a+b+c-d+e-f1-g+h;
    return vec4(a+k1*u.x+k2*u.y+k3*u.z+k4*u.x*u.y+
        k5*u.y*u.z+k6*u.z*u.x+k7*u.x*u.y*u.z,
        du*vec3(k1+k4*u.y+k6*u.z+k7*u.y*u.z,
                k2+k4*u.x+k5*u.z+k7*u.z*u.x,
                k3+k5*u.y+k6*u.x+k7*u.x*u.y));
}
vec3 curlNoise(vec3 p) {
    vec3 a=noiseDerivative(p).yzw;
    vec3 b=noiseDerivative(p+vec3(31.7,8.3,17.1)).yzw;
    vec3 c=noiseDerivative(p+vec3(11.4,47.2,5.8)).yzw;
    return vec3(c.y-b.z, a.z-c.x, b.x-a.y);
}`;

export const particleFlowVertex = `
attribute vec4 aSeed;
attribute float aTail;
uniform sampler2D uPath;
uniform sampler2D uFrames;
uniform vec2 uTextureSize;
uniform float uCount;
uniform float uTime;
uniform float uTravel;
uniform float uRate;
uniform float uFlowSpeed;
uniform float uSpeedVariation;
uniform float uSpread;
uniform float uTurbulence;
uniform float uNoiseScale;
uniform float uNoiseSpeed;
uniform float uSwirl;
uniform float uRadius;
uniform vec3 uCenter;
uniform float uPointSize;
uniform float uPixelRatio;
uniform float uMaxPointSize;
uniform float uHead;
uniform float uTrail;
uniform float uFollowReveal;
varying float vT;
varying float vSpeed;
varying float vAlpha;
varying float vBrightness;
${noiseGLSL}
vec2 address(float index) {
    return (vec2(mod(index,uTextureSize.x),floor(index/uTextureSize.x))+0.5)/uTextureSize;
}
vec3 safeUnit(vec3 v, vec3 fallback) {
    return dot(v,v)>1e-12 ? normalize(v) : fallback;
}
void main() {
    float speed=mix(1.0,mix(0.55,1.55,aSeed.y),uSpeedVariation);
    float lag=aTail*0.035;
    float time=uTime-lag;
    float phase=fract(aSeed.x+(uTravel-lag*uFlowSpeed)*uRate*speed);
    float index=phase*(uCount-1.0);
    float i=min(floor(index),uCount-2.0), f=index-i;
    vec4 p0=texture2D(uPath,address(i));
    vec4 p1=texture2D(uPath,address(i+1.0));
    vec3 center=mix(p0.xyz,p1.xyz,f);
    vec3 tangent=safeUnit(p1.xyz-p0.xyz,vec3(0,1,0));
    vec3 normal=mix(texture2D(uFrames,address(i)).xyz,texture2D(uFrames,address(i+1.0)).xyz,f);
    normal=safeUnit(normal-tangent*dot(normal,tangent),vec3(1,0,0));
    vec3 binormal=safeUnit(cross(tangent,normal),vec3(0,0,1));
    float angle=6.2831853*aSeed.z+time*uSwirl*(0.65+aSeed.y);
    // Concentrate particles near streams, with a sparse outer halo.
    float radius=uSpread*uRadius*(0.12+1.5*pow(aSeed.w,1.8));
    vec3 offset=radius*(normal*cos(angle)+binormal*sin(angle));
    vec3 noisePosition=(center+offset-uCenter)/uRadius*uNoiseScale;
    noisePosition+=time*uNoiseSpeed*vec3(0.17,-0.13,0.11);
    vec3 curl=curlNoise(noisePosition);
    // Bound artistic displacement to retain the attractor silhouette.
    offset+=uRadius*uSpread*uTurbulence*curl/sqrt(1.0+dot(curl,curl));
    vec4 mv=modelViewMatrix*vec4(center+offset,1.0);
    gl_Position=projectionMatrix*mv;
    float perspective=clamp(3.0*uRadius/max(-mv.z,0.001),0.3,3.0);
    gl_PointSize=clamp(uPointSize*uPixelRatio*(0.6+0.95*aSeed.w)*perspective,
        1.0,uMaxPointSize);
    // Never connect the end of a finite chaotic path back to its beginning.
    // Each particle fades before respawning at the other end.
    float fadeWidth=clamp(uRate*speed*max(uFlowSpeed,0.1)*0.65,0.0005,0.03);
    float life=smoothstep(0.0,fadeWidth,phase)*(1.0-smoothstep(1.0-fadeWidth,1.0,phase));
    float historyStart=max(0.0,uHead-uTrail);
    float revealed=step(phase,uHead)*step(historyStart,phase);
    vAlpha=life*mix(1.0,revealed,uFollowReveal)*pow(0.38,aTail);
    vBrightness=mix(0.65,1.8,aSeed.y)*(0.9+0.1*sin(time*1.3+aSeed.z*25.0));
    vT=phase;
    vSpeed=mix(p0.w,p1.w,f);
}`;

export const particleFlowFragment = `
${paletteGLSL}
uniform float uColorMode;
uniform float uOpacity;
uniform float uBrightness;
varying float vT;
varying float vSpeed;
varying float vAlpha;
varying float vBrightness;
void main() {
    vec2 uv=gl_PointCoord*2.0-1.0;
    float r2=dot(uv,uv);
    if(r2>1.0 || vAlpha<0.001) discard;
    float core=exp(-3.5*r2);
    float edge=1.0-smoothstep(0.65,1.0,sqrt(r2));
    vec3 color=palette(mix(vT,vSpeed,uColorMode));
    color=mix(color,vec3(1.0),0.2*exp(-12.0*r2));
    gl_FragColor=vec4(color*uBrightness*vBrightness,uOpacity*vAlpha*core*edge);
}`;

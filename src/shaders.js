// Linear HDR colors; the composer applies tone mapping and sRGB conversion once.
export const paletteGLSL = `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
vec3 palette(float t) {
    float x = clamp(t, 0.0, 1.0);
    return x < 0.5 ? mix(uColorA, uColorB, smoothstep(0.0,0.5,x))
                   : mix(uColorB, uColorC, smoothstep(0.5,1.0,x));
}`;
export const vertex = `
attribute float a_t;
attribute float a_speed;
uniform float uPointSize;
uniform float uPixelRatio;
varying float vT;
varying float vSpeed;
void main() {
    vT = a_t; vSpeed = a_speed;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // Screen-space diameter: cloud readability stays consistent when orbiting.
    gl_PointSize = uPointSize * uPixelRatio;
}`;
export const fragment = `
${paletteGLSL}
uniform float uHead;
uniform float uTrail;
uniform float uBand;
uniform float uIntensity;
uniform float uColorMode;
uniform float uClock;
uniform float uOpacity;
varying float vT;
varying float vSpeed;
void main() {
    float age = uHead - vT;
    if (age < -0.000001 || age > uTrail) discard;
    float fade = 1.0 - smoothstep(0.0, uTrail, age);
    float hot = exp(-age / max(uBand, 0.000001));
    float coordinate = mix(vT, vSpeed, uColorMode);
    vec3 color = palette(coordinate);
    float alpha = fade * uOpacity;
    #ifdef CLOUD
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        alpha *= exp(-r*r*4.5) * (1.0-smoothstep(0.65,1.0,r));
        // Light packets travel along the sampled path without displacing samples.
        float pulse = pow(0.5 + 0.5*cos(vT*200.0-uClock*1.8), 12.0);
        color *= 0.65 + 0.65*pulse;
    #endif
    color = color * uIntensity + vec3(0.65,0.9,1.0) * hot * 2.0;
    gl_FragColor = vec4(color, alpha);
}`;
export const finishShader = {
    uniforms: { tDiffuse:{value:null}, uVignette:{value:0.28} },
    vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:`uniform sampler2D tDiffuse; uniform float uVignette; varying vec2 vUv;
    void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb; float r=length((vUv-.5)*1.3);
    c*=1.0-uVignette*smoothstep(.2,.85,r); gl_FragColor=vec4(c,1.0); }`
};

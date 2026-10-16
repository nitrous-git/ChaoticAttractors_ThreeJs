// Linear HDR colors; the composer applies tone mapping and sRGB conversion once.
export const paletteGLSL = `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
vec3 palette(float t) {
    float x = clamp(t, 0.0, 1.0);
    return x < 0.5 ? mix(uColorA, uColorB, smoothstep(0.0, 0.5, x))
                   : mix(uColorB, uColorC, smoothstep(0.5, 1.0, x));
}`;

export const vertex = `
attribute float a_t;
attribute float a_speed;

uniform float uPointSize;
uniform float uPixelRatio;

varying float vT;
varying float vSpeed;

void main() {
    vT = a_t;
    vSpeed = a_speed;

    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;

    // Use a minimum visible diameter for point clouds.
    // Lines use the same vertex shader, but ignore gl_PointSize.
    #ifdef CLOUD
        gl_PointSize = max(4.0, uPointSize * uPixelRatio);
    #else
        gl_PointSize = uPointSize * uPixelRatio;
    #endif
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
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(uv, uv);
        if (r2 > 1.0) discard;

        // Smooth circular particle with a readable luminous core.
        float core = exp(-r2 * 2.0);
        float edge = 1.0 - smoothstep(0.65, 1.0, sqrt(r2));
        alpha *= core * edge;

        // Subtle brightness modulation instead of near-black pulses.
        float pulse = 0.5 + 0.5 * cos(vT * 200.0 - uClock * 1.8);
        color *= 0.85 + 0.35 * pulse;
    #endif

    color = color * uIntensity + vec3(0.65, 0.9, 1.0) * hot * 2.0;
    gl_FragColor = vec4(color, alpha);
}`;

export const finishShader = {
    uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.28 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uVignette; varying vec2 vUv;
    void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb; float r=length((vUv-.5)*1.3);
    c*=1.0-uVignette*smoothstep(.2,.85,r); gl_FragColor=vec4(c,1.0); }`
};

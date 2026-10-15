import * as THREE from 'three';
import GUI from 'lil-gui';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { ATTRACTORS } from './src/attractors.js';
import { vertex, fragment, finishShader } from './src/shaders.js';

const $ = id => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const settings = {
    attractor:'Aizawa', ...presetValues('Aizawa'), mode:'Hybrid', palette:'Glacier', colorBy:'Time',
    speed:1, trail:1, intensity:0.7, pointSize:2.1, cloudOpacity:0.24,
    headSize:0.11, wakeWidth:2.2, headGlow:2.5, bloom:true, bloomStrength:0.65,
    bloomRadius:0.45, bloomThreshold:0.85, exposure:1, vignette:0.3,
    quality:'High', autoRotate:false, rotationSpeed:0.3, loop:false, paused:reducedMotion,
    flowTracers:true, tracerCount:24, axes:false
};
function presetValues(name) {
    const d = ATTRACTORS[name];
    return {x0:d.initial[0],y0:d.initial[1],z0:d.initial[2],dt:d.dt,T:d.T,scale:d.scale};
}
const paletteColors = {
    Glacier:['#317bbf','#78ddd0','#f6dfba'], Ember:['#893fa8','#f7753c','#ffe6b2'],
    Synthwave:['#4949e8','#ce5ee4','#67e5f1'], Aurora:['#4976dc','#65d7a3','#dbf4bc'],
    Porcelain:['#536575','#b3cacd','#ffffff']
};
const descriptions = {
    Aizawa:['A toroidal flow with a folded core.','ẋ = (z − b)x − dy<br>ẏ = dx + (z − b)y<br>ż = c + az − z³/3 − (x² + y²)(1 + ez) + fzx³'],
    Lorenz:['Two wings. One restless trajectory.','ẋ = σ(y − x)<br>ẏ = x(ρ − z) − y<br>ż = xy − βz'],
    Rossler:['A spiral that folds back into itself.','ẋ = −y − z<br>ẏ = x + ay<br>ż = b + z(x − c)'],
    Thomas:['Cyclic symmetry in three dimensions.','ẋ = sin(y) − bx<br>ẏ = sin(z) − by<br>ż = sin(x) − bz'],
    Halvorsen:['Three folds in a cyclic quadratic flow.','ẋ = −ax − 4y − 4z − y²<br>ẏ = −ay − 4z − 4x − z²<br>ż = −az − 4x − 4y − x²'],
    Dadras:['A five-parameter quadratic system.','ẋ = y − ax + byz<br>ẏ = cy − xz + z<br>ż = dxy − ez'],
    Misc_01:['Your original experimental system.','ẋ = y + z<br>ẏ = −x + ay<br>ż = x² − z']
};
const scene = new THREE.Scene();
scene.background = new THREE.Color('#050608');
const camera = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.01, 2000);
const renderer = new THREE.WebGLRenderer({canvas:$('webgl-canvas'),antialias:false,powerPreference:'high-performance'});
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const controls = new OrbitControls(camera,renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1,1),settings.bloomStrength,settings.bloomRadius,settings.bloomThreshold);
composer.addPass(bloom);
const finish = new ShaderPass(finishShader);
composer.addPass(finish);
composer.addPass(new OutputPass());
const fxaa = new ShaderPass(FXAAShader);
composer.addPass(fxaa);
const uniforms = {
    uHead:{value:0},uTrail:{value:1},uBand:{value:0.003},uIntensity:{value:0.7},
    uColorA:{value:new THREE.Color()},uColorB:{value:new THREE.Color()},uColorC:{value:new THREE.Color()},
    uColorMode:{value:0},uPointSize:{value:2},uPixelRatio:{value:1},uClock:{value:0},uOpacity:{value:0.65}
};
const baseMaterial = new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
const pointUniforms = {...uniforms,uOpacity:{value:settings.cloudOpacity}};
const cloudMaterial = new THREE.ShaderMaterial({uniforms:pointUniforms,vertexShader:vertex,fragmentShader:fragment,
    defines:{CLOUD:1},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
let geometry = new THREE.BufferGeometry();
const line = new THREE.Line(geometry,baseMaterial);
const cloud = new THREE.Points(geometry,cloudMaterial);
scene.add(line,cloud);

// A short screen-space ribbon, independent of platform GL line-width limits.
const WAKE_SAMPLES=180;
const wakeGeometry=new LineGeometry();
wakeGeometry.setPositions(new Float32Array(WAKE_SAMPLES*3));
wakeGeometry.setColors(new Float32Array(WAKE_SAMPLES*3));
const wakeMaterial=new LineMaterial({linewidth:settings.wakeWidth,vertexColors:true,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
const wake=new Line2(wakeGeometry,wakeMaterial);
wake.frustumCulled=false;
scene.add(wake);
const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;
const ctx=glowCanvas.getContext('2d');
const gradient=ctx.createRadialGradient(64,64,0,64,64,64);
gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.12,'rgba(220,252,255,1)');
gradient.addColorStop(.3,'rgba(129,216,255,.3)');gradient.addColorStop(1,'rgba(129,216,255,0)');
ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
const glowTexture=new THREE.CanvasTexture(glowCanvas);
const head=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:new THREE.Color(2,3,3.5),
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
scene.add(head);
const tracerGeometry=new THREE.BufferGeometry();
const tracerPositions=new Float32Array(96*3);
const tracerColors=new Float32Array(96*3);
tracerGeometry.setAttribute('color',new THREE.BufferAttribute(tracerColors,3).setUsage(THREE.DynamicDrawUsage));
tracerGeometry.setAttribute('position',new THREE.BufferAttribute(tracerPositions,3).setUsage(THREE.DynamicDrawUsage));
const tracers=new THREE.Points(tracerGeometry,new THREE.PointsMaterial({map:glowTexture,color:new THREE.Color(1.5,2.5,3),vertexColors:true,
    size:1,sizeAttenuation:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
tracers.frustumCulled=false;scene.add(tracers);
let axes=new THREE.AxesHelper(5);scene.add(axes);
let result=null, progress=0.16, clock=0, lastTime=null, activeSettings=null;
let requestId=0, worker=null, busy=false, fittedRadius=5, fpsFrames=0, fpsTime=0;
let capturePending=false;
let toastTimeout;
function toast(message) { $('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('visible'),4500); }

function rebuild(fit=true) {
    const id=++requestId;
    // Cancel superseded work instead of queueing multiple expensive integrations.
    worker?.terminate();worker=new Worker(new URL('./src/trajectory.worker.js',import.meta.url),{type:'module'});
    busy=true;document.body.classList.add('busy');
    const snapshot={attractor:settings.attractor,...Object.fromEntries(['x0','y0','z0','dt','T','scale'].map(k=>[k,settings[k]]))};
    worker.onmessage=({data})=>{
        if(data.id!==requestId)return;
        busy=false;document.body.classList.remove('busy');
        if(data.error) { handleBuildError(data.error);return; }
        activeSettings=snapshot;result=data.result;
        const next=new THREE.BufferGeometry();
        next.setAttribute('position',new THREE.BufferAttribute(result.positions,3));
        next.setAttribute('a_t',new THREE.BufferAttribute(result.times,1));
        next.setAttribute('a_speed',new THREE.BufferAttribute(result.speeds,1));
        next.computeBoundingSphere();next.computeBoundingBox();
        line.geometry=cloud.geometry=next;geometry.dispose();geometry=next;
        progress=.16;clock=0;
        if(fit)fitCamera();
        updateSystemText();updateGui();
        document.body.classList.add('ready');
    };
    worker.onerror=e=>{busy=false;document.body.classList.remove('busy');handleBuildError(e.message||'Unable to build trajectory.');};
    worker.postMessage({id,settings:snapshot});
}
function handleBuildError(message){
    toast(message);
    if(activeSettings) {Object.assign(settings,activeSettings);updateGui();updateSystemText();}
    else {$('startup-message').textContent=message;}
}
function fitCamera(){
    if(!geometry.boundingSphere)return;
    const sphere=geometry.boundingSphere;fittedRadius=Math.max(sphere.radius,.1);
    const direction=new THREE.Vector3(...ATTRACTORS[settings.attractor].cameraPosition)
        .sub(new THREE.Vector3(...ATTRACTORS[settings.attractor].cameraLookAt)).normalize();
    const fov=Math.min(camera.fov*Math.PI/180,2*Math.atan(Math.tan(camera.fov*Math.PI/360)*camera.aspect));
    const distance=fittedRadius/Math.sin(fov/2)*1.25;
    controls.target.copy(sphere.center);
    camera.position.copy(sphere.center).addScaledVector(direction,distance);
    camera.near=Math.max(.001,fittedRadius/1000);camera.far=Math.max(2000,distance*20);camera.updateProjectionMatrix();
    controls.minDistance=fittedRadius*.1;controls.maxDistance=distance*8;controls.update();
    axes.scale.setScalar(fittedRadius/10);
}
function updateSystemText(){
    const name=settings.attractor;
    $('system').value=name;$('model-name').textContent=name.toUpperCase();
    $('system-description').textContent=descriptions[name][0];$('equations').innerHTML=descriptions[name][1];
    $('system-index').textContent=`0${Object.keys(ATTRACTORS).indexOf(name)+1} / 07`;
}
function setMode(mode){settings.mode=mode;document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});updateGui();}
function setPaused(value){settings.paused=value;$('pause-button').textContent=value?'Resume':'Pause';$('pause-button').setAttribute('aria-pressed',value);}
function replay(){progress=0;clock=0;setPaused(false);}
function sample(index,target){
    const a=Math.max(0,Math.min(result.count-1,index));const i=Math.floor(a),j=Math.min(i+1,result.count-1),f=a-i;
    for(let c=0;c<3;c++)target[c]=THREE.MathUtils.lerp(result.positions[i*3+c],result.positions[j*3+c],f);
}
const sampled=[0,0,0];
const wakePoints=new Float32Array(WAKE_SAMPLES*3),wakeColors=new Float32Array(WAKE_SAMPLES*3);
function updateHead(){
    const index=progress*(result.count-1);
    sample(index,sampled);head.position.set(...sampled);
    head.scale.setScalar(fittedRadius*settings.headSize);
    head.material.color.setRGB(settings.headGlow*.6,settings.headGlow*.85,settings.headGlow);
    const length=Math.min(index,Math.max(35,result.count*.0018));
    for(let i=0;i<WAKE_SAMPLES;i++){
        const f=i/(WAKE_SAMPLES-1);
        sample(index-length*(1-f),sampled);wakePoints.set(sampled,i*3);
        const strength=f*f*settings.headGlow;
        wakeColors.set([strength*.32,strength*.75,strength],i*3);
    }
    // Update the existing interleaved segment buffers; no per-frame geometries.
    const p=wakeGeometry.attributes.instanceStart.data,c=wakeGeometry.attributes.instanceColorStart.data;
    for(let i=0;i<WAKE_SAMPLES-1;i++){
        for(let j=0;j<3;j++){
            p.array[i*6+j]=wakePoints[i*3+j];p.array[i*6+j+3]=wakePoints[(i+1)*3+j];
            c.array[i*6+j]=wakeColors[i*3+j];c.array[i*6+j+3]=wakeColors[(i+1)*3+j];
        }
    }
    p.needsUpdate=true;c.needsUpdate=true;
    head.visible=wake.visible=progress>0;
    tracers.visible=settings.flowTracers && progress>.002;
    const count=settings.tracerCount;tracerGeometry.setDrawRange(0,count);
    const earliest=Math.max(0,index-settings.trail*(result.count-1));
    const span=Math.max(1,index-earliest);
    for(let i=0;i<count;i++){
        const phase=(i/count+clock*.025)%1;
        sample(earliest+phase*span,sampled);tracerPositions.set(sampled,i*3);
        const fade=THREE.MathUtils.smoothstep(phase,0,.07)*(1-THREE.MathUtils.smoothstep(phase,.93,1));
        tracerColors.set([fade,fade,fade],i*3);
    }
    tracerGeometry.attributes.position.needsUpdate=true;
    tracerGeometry.attributes.color.needsUpdate=true;
    tracers.material.size=fittedRadius*.027;
}
const gui=new GUI({container:$('gui-container'),title:'Attractor laboratory'});
const rendering=gui.addFolder('Appearance');
rendering.add(settings,'mode',['Trajectory','Particles','Hybrid']).name('Render mode').onChange(setMode);
rendering.add(settings,'palette',Object.keys(paletteColors)).name('Palette');
rendering.add(settings,'colorBy',['Time','Speed']).name('Color by');
rendering.add(settings,'intensity',.1,2,.01).name('Path brightness');
rendering.add(settings,'trail',.01,1,.01).name('Visible history');
rendering.add(settings,'pointSize',1,6,.1).name('Particle size · px');
rendering.add(settings,'cloudOpacity',.03,.7,.01).name('Particle opacity');
const tracerFolder=gui.addFolder('Head & flow');
tracerFolder.add(settings,'headGlow',0,6,.1).name('Head glow');
tracerFolder.add(settings,'headSize',.01,.25,.01).name('Head halo size');
tracerFolder.add(settings,'wakeWidth',.5,6,.1).name('Wake width · px');
tracerFolder.add(settings,'flowTracers').name('Flow markers');
tracerFolder.add(settings,'tracerCount',1,96,1).name('Marker count');
const post=gui.addFolder('Post processing');
post.add(settings,'bloom').name('Bloom');
post.add(settings,'bloomStrength',0,2,.01).name('Bloom strength');
post.add(settings,'bloomRadius',0,1,.01).name('Bloom radius');
post.add(settings,'bloomThreshold',0,2,.01).name('Bloom threshold');
post.add(settings,'exposure',.3,2,.01).name('Exposure');
post.add(settings,'vignette',0,.7,.01).name('Vignette');
const playback=gui.addFolder('Playback & camera');
playback.add(settings,'speed',.1,8,.1).name('Reveal speed');
playback.add(settings,'loop').name('Loop reveal');
playback.add(settings,'autoRotate').name('Auto orbit');
playback.add(settings,'rotationSpeed',.05,1,.05).name('Orbit speed');
playback.add(settings,'axes').name('World axes');
playback.add(settings,'quality',['Performance','High','Ultra']).name('Quality').onChange(resize);
playback.add({fitCamera},'fitCamera').name('Fit to trajectory');
const simulation=gui.addFolder('Integration');
for(const [key,label,min,max,step] of [['x0','Initial x',-50,50,.001],['y0','Initial y',-50,50,.001],['z0','Initial z',-50,50,.001],['dt','Time step',.001,.05,.001],['T','Duration',10,3000,1],['scale','World scale',.05,18,.05]])simulation.add(settings,key,min,max,step).name(label);
simulation.add({apply:()=>rebuild()},'apply').name('Apply & rebuild');
simulation.add({reset:()=>{Object.assign(settings,presetValues(settings.attractor));rebuild();}},'reset').name('Restore system defaults');
tracerFolder.close();post.close();playback.close();simulation.close();
function updateGui(){gui.controllersRecursive().forEach(c=>c.updateDisplay());}
$('system').onchange=e=>{settings.attractor=e.target.value;Object.assign(settings,presetValues(settings.attractor));rebuild();};
$('pause-button').onclick=()=>setPaused(!settings.paused);
$('restart-button').onclick=replay;
$('settings-button').onclick=()=>{const open=$('gui-container').hidden;$('gui-container').hidden=!open;$('settings-button').setAttribute('aria-expanded',open);};
$('timeline').oninput=e=>{progress=Number(e.target.value);setPaused(true);};
$('reveal-button').onclick=()=>{progress=1;setPaused(true);};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('capture-button').onclick=()=>{capturePending=true;};
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Fullscreen is unavailable in this browser.');}}
$('fullscreen-button').onclick=fullscreen;
function toggleUI(){const hidden=document.body.classList.toggle('ui-hidden');$('restore-ui').hidden=!hidden;}
$('restore-ui').onclick=toggleUI;
addEventListener('keydown',e=>{
    if(e.target.matches('input,select,textarea')||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.target.matches('button')&&e.code==='Space')return;
    if(e.code==='Space'){e.preventDefault();setPaused(!settings.paused);}
    if(e.key.toLowerCase()==='h')toggleUI();
    if(e.key.toLowerCase()==='r')replay();
    if(e.key.toLowerCase()==='p')capturePending=true;
    if(e.key.toLowerCase()==='f')fullscreen();
});
function resize(){
    const ratio=Math.min(devicePixelRatio,{Performance:1,High:1.5,Ultra:2}[settings.quality]);
    renderer.setPixelRatio(ratio);renderer.setSize(innerWidth,innerHeight);
    composer.setPixelRatio(ratio);composer.setSize(innerWidth,innerHeight);
    camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
    uniforms.uPixelRatio.value=ratio;
    wakeMaterial.resolution.set(innerWidth,innerHeight);
    fxaa.material.uniforms.resolution.value.set(1/(innerWidth*ratio),1/(innerHeight*ratio));
    $('quality-value').textContent=settings.quality.toUpperCase();
    $('resolution-value').textContent=`${renderer.domElement.width} × ${renderer.domElement.height}`;
}
addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{lastTime=null;});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();setPaused(true);toast('Graphics context lost. Reload this page to restore rendering.');});
function animate(now){
    requestAnimationFrame(animate);
    const delta=lastTime===null?0:Math.min((now-lastTime)/1000,.1);lastTime=now;
    if(result){
        if(!settings.paused&&!busy){
            clock+=delta;
            // Preserve each preset's reference pace at 60 Hz, independent of FPS.
            const rate=ATTRACTORS[activeSettings.attractor].maxPointsPerFrame*60*settings.speed;
            progress+=delta*rate/(result.count-1);
            if(progress>=1){if(settings.loop)progress%=1;else{progress=1;setPaused(true);}}
        }
        uniforms.uHead.value=progress;uniforms.uTrail.value=settings.trail;
        uniforms.uIntensity.value=settings.intensity;uniforms.uClock.value=clock;
        uniforms.uColorMode.value=settings.colorBy==='Speed'?1:0;
        uniforms.uPointSize.value=settings.pointSize;
        const palette=paletteColors[settings.palette];
        uniforms.uColorA.value.set(palette[0]);uniforms.uColorB.value.set(palette[1]);uniforms.uColorC.value.set(palette[2]);
        pointUniforms.uOpacity.value=settings.cloudOpacity;
        const end=Math.min(result.count,Math.floor(progress*(result.count-1))+1);
        const start=Math.max(0,Math.floor((progress-settings.trail)*(result.count-1)));
        geometry.setDrawRange(start,Math.max(0,end-start));
        line.visible=settings.mode!=='Particles';cloud.visible=settings.mode!=='Trajectory';
        wakeMaterial.linewidth=settings.wakeWidth;
        updateHead();
        $('timeline').value=progress;$('progress-value').textContent=`${(progress*100).toFixed(1)}%`;
        $('time-value').textContent=`t = ${(progress*(result.count-1)*activeSettings.dt).toFixed(2)}`;
        $('sample-value').textContent=`${end.toLocaleString()} / ${result.count.toLocaleString()} samples`;
    }
    controls.autoRotate=settings.autoRotate&&!settings.paused;
    controls.autoRotateSpeed=settings.rotationSpeed;controls.update(delta);
    axes.visible=settings.axes;
    bloom.enabled=settings.bloom;bloom.strength=settings.bloomStrength;bloom.radius=settings.bloomRadius;bloom.threshold=settings.bloomThreshold;
    renderer.toneMappingExposure=settings.exposure;finish.uniforms.uVignette.value=settings.vignette;
    composer.render(delta);
    if(capturePending){
        capturePending=false;
        renderer.domElement.toBlob(blob=>{if(!blob){toast('Capture failed.');return;}const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`Nitrous-${activeSettings?.attractor||settings.attractor}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Image saved.');},'image/png');
    }
    fpsTime+=delta;fpsFrames++;
    if(fpsTime>=.5){$('fps-value').textContent=Math.round(fpsFrames/fpsTime);fpsFrames=0;fpsTime=0;}
}
resize();setMode(settings.mode);setPaused(settings.paused);updateSystemText();rebuild();requestAnimationFrame(animate);

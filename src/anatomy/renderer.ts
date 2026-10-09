import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { airwayProfile, layerInfo } from './airway';
import type { Layer, LayerVisibility, Region, AirwayProfile } from './airway';
import { createBronchialTree, lobeAnchors } from './tree';
import type { Parameters, Metrics } from '../model';

export type AnatomyView = 'anatomy' | 'cutaway' | 'endoscopy';
export type AnatomyOptions = {
  view: AnatomyView; region: Region; layers: LayerVisibility;
  tissue: number; ribs: boolean; airflow: boolean; exploded: boolean; reset: number;
};
export type AnatomyState = { parameters: Parameters; metrics: Metrics; phase: number; paused: boolean; options: AnatomyOptions };
type RadialFunction = (theta: number, z: number) => number;
const TAU = Math.PI * 2;

// Closed annular volumes retain their cut surfaces while the lining deforms.
function shellGeometry(inner: RadialFunction, outer: RadialFunction, cut: boolean, length = 3.6) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const radialSteps = 72, axialSteps = 12;
  const start = cut ? Math.PI * .52 : 0, span = cut ? TAU-start : TAU;
  const surface = (fn: (u: number,v: number) => number[], nu: number,nv: number, reverse = false) => {
    const offset = positions.length/3;
    for(let j=0;j<=nv;j++) for(let i=0;i<=nu;i++) { positions.push(...fn(i/nu,j/nv)); uvs.push(i/nu*2,j/nv*2); }
    for(let j=0;j<nv;j++) for(let i=0;i<nu;i++) {
      const a=offset+j*(nu+1)+i, b=a+1, c=a+nu+1, d=c+1;
      indices.push(...(reverse?[a,c,b,b,c,d]:[a,b,c,b,d,c]));
    }
  };
  const point=(theta:number,z:number,r:number)=>[r*Math.cos(theta),r*Math.sin(theta),z];
  surface((u,v)=>{const t=start+u*span,z=(v-.5)*length;return point(t,z,outer(t,z));},radialSteps,axialSteps,true);
  surface((u,v)=>{const t=start+u*span,z=(v-.5)*length;return point(t,z,inner(t,z));},radialSteps,axialSteps);
  for(const front of [false,true]) {
    const z=(front?.5:-.5)*length;
    surface((u,v)=>{const t=start+u*span;return point(t,z,THREE.MathUtils.lerp(inner(t,z),outer(t,z),v));},radialSteps,1,front);
  }
  if(cut) for(const last of [false,true]) {
    const t=last?start+span:start;
    surface((u,v)=>{const z=(v-.5)*length;return point(t,z,THREE.MathUtils.lerp(inner(t,z),outer(t,z),u));},1,axialSteps,!last);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
function tissueTexture() {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#b6a4ac';ctx.fillRect(0,0,256,256);
  let seed=132;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<4200;i++) {
    const r=1+random()*3;ctx.beginPath();ctx.arc(random()*256,random()*256,r,0,TAU);
    ctx.fillStyle=`rgba(${110+random()*80},${70+random()*60},${90+random()*65},${.04+random()*.16})`;ctx.fill();
  }
  for(let i=0;i<65;i++) {
    const x=random()*256,y=random()*256;ctx.beginPath();ctx.moveTo(x,y);
    ctx.bezierCurveTo(x+15,y+5,x-12,y+15,x+random()*30-15,y+25);
    ctx.lineWidth=.4;ctx.strokeStyle='rgba(99,50,67,.28)';ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function lungGeometry(side:number) {
  const geometry=new THREE.SphereGeometry(1,64,56);
  const position=geometry.getAttribute('position');
  const colors=new Float32Array(position.count*3);
  for(let i=0;i<position.count;i++) {
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
    const v=(1-y)/2;
    const radial=Math.sqrt(x*x+z*z);
    const breadth=Math.pow(Math.sin(v*Math.PI),.52)*(1.02+.18*v);
    const inward=x*side<0;
    const cardiac=side>0&&inward?.24*Math.exp(-(((y+.15)*2.3)**2)):0;
    const texture=1+.015*Math.sin(x*23+z*17)*Math.cos(y*31);
    const nx=side*(1.38+.12*Math.sin(v*Math.PI))+(radial>.001?x/radial:0)*breadth*(1-cardiac);
    const ny=2.6-4.9*Math.sin(v*Math.PI/2);
    const nz=(radial>.001?z/radial:0)*breadth*.78*texture+.05;
    position.setXYZ(i,nx,ny,nz);
    const oblique=ny-(-.55+.55*nz+.16*Math.abs(nx));
    const upper=ny>.42&&oblique>0;
    const color=new THREE.Color(upper?0xc88792:side<0&&oblique>0?0xb67588:0xa36680);
    const crease=Math.min(Math.abs(oblique),side<0&&oblique>0?Math.abs(ny-.42):10);
    color.multiplyScalar(.84+.16*Math.min(1,crease*28));colors.set(color.toArray(),i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geometry.computeVertexNormals();return geometry;
}
function lineCurve(points:THREE.Vector3[],radius:number,material:THREE.Material,segments=32) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),segments,radius,7,false),material);
}

export function createAnatomyRenderer(host: HTMLDivElement, getState: () => AnatomyState, onRegion: (region: Region) => void) {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));
  renderer.setClearColor(0x08131e,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
  renderer.domElement.setAttribute('aria-label','Interactive three-dimensional respiratory anatomy');
  renderer.domElement.setAttribute('role','img');renderer.domElement.tabIndex=0;
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(37,1,.05,100);
  const controls=new OrbitControls(camera,renderer.domElement);
  let cameraDirty=true;
  controls.addEventListener('change',()=>{cameraDirty=true;});
  controls.enableDamping=true;controls.dampingFactor=.09;controls.enablePan=false;
  controls.minDistance=3.5;controls.maxDistance=17;
  const pmrem=new THREE.PMREMGenerator(renderer);
  const environment=new RoomEnvironment();
  const environmentMap=pmrem.fromScene(environment,.04);
  scene.environment=environmentMap.texture;scene.environmentIntensity=.55;environment.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xd4e9ff,0x2d1629,.85));
  const key=new THREE.DirectionalLight(0xffe5da,2.5);key.position.set(-4,7,8);scene.add(key);
  const rim=new THREE.DirectionalLight(0x62b6ea,2);rim.position.set(4,3,-4);scene.add(rim);
  const fill=new THREE.DirectionalLight(0xc1edff,.6);fill.position.set(0,-3,6);scene.add(fill);
  const anatomy=new THREE.Group(), inspection=new THREE.Group();scene.add(anatomy,inspection);
  const texture=tissueTexture();
  const tissueMaterial=new THREE.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,roughness:.57,metalness:0,transparent:true,opacity:.18,depthWrite:false,map:texture,bumpMap:texture,bumpScale:.065,side:THREE.FrontSide,clearcoat:.15});
  const lungShells=new THREE.Group();
  for(const side of [-1,1]) lungShells.add(new THREE.Mesh(lungGeometry(side),tissueMaterial));
  anatomy.add(lungShells);
  const fissureMaterial=new THREE.MeshBasicMaterial({color:0x94b6c8,transparent:true,opacity:.19,depthWrite:false});
  const fissures=new THREE.Group();anatomy.add(fissures);
  for(const side of [-1,1]) {
    const points=[];
    for(let i=0;i<=28;i++) {
      const u=i/28, x=side*(.55+1.92*u), y=-.7+.85*u;
      const local=(Math.abs(x)-1.47)/1.2;
      points.push(new THREE.Vector3(x,y,.1+.81*Math.sqrt(Math.max(.03,1-local*local-(y/2.44)**2))));
    }
    fissures.add(lineCurve(points,.009,fissureMaterial));
    if(side<0) fissures.add(lineCurve([new THREE.Vector3(-.58,.35,.57),new THREE.Vector3(-1.4,.45,.9),new THREE.Vector3(-2.45,.28,.43)],.009,fissureMaterial));
  }

  // A merged centerline attribute lets every airway narrow without reallocating its mesh.
  const tree=createBronchialTree();
  const tubeGeometries=tree.map(branch=>{
    const segments=branch.generation<3?16:7;
    const geometry=new THREE.TubeGeometry(branch.curve,segments,branch.radius,branch.generation<3?12:7,false);
    const vertices=geometry.getAttribute('position');const center=new Float32Array(vertices.count*3),sensitivity=new Float32Array(vertices.count);
    const radial=branch.generation<3?12:7;
    for(let i=0;i<vertices.count;i++) {
      const t=Math.floor(i/(radial+1))/segments;const point=branch.curve.getPointAt(t);
      center.set(point.toArray(),i*3);sensitivity[i]=branch.generation===0?.08:Math.min(1.12,.75+branch.generation*.065);
      const taper=1-.22*t;
      vertices.setXYZ(i,point.x+(vertices.getX(i)-point.x)*taper,point.y+(vertices.getY(i)-point.y)*taper,point.z+(vertices.getZ(i)-point.z)*taper);
    }
    geometry.setAttribute('centerline',new THREE.BufferAttribute(center,3));geometry.setAttribute('sensitivity',new THREE.BufferAttribute(sensitivity,1));return geometry;
  });
  const treeGeometry=mergeGeometries(tubeGeometries)!;tubeGeometries.forEach(g=>g.dispose());
  const wallUniform={value:0}, lumenUniform={value:0};
  const airwayMaterial=(lumen:boolean)=>{
    const mat=new THREE.MeshPhysicalMaterial({color:lumen?0x673637:0xe6b29e,roughness:lumen?.28:.42,metalness:0,transparent:!lumen,opacity:lumen?1:.32,depthWrite:lumen,clearcoat:.25,side:THREE.FrontSide});
    mat.onBeforeCompile=shader=>{
      shader.uniforms.obstruction=lumen?lumenUniform:wallUniform;
      shader.vertexShader='attribute vec3 centerline; attribute float sensitivity; uniform float obstruction;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`vec3 transformed = centerline + (position - centerline) * ${lumen?'0.76':'1.08'} * max(0.13, 1.0 - obstruction * sensitivity);`);
    };
    mat.customProgramCacheKey=()=>lumen?'lumen-shader':'wall-shader';return mat;
  };
  const wallMaterial=airwayMaterial(false),lumenMaterial=airwayMaterial(true);
  anatomy.add(new THREE.Mesh(treeGeometry,wallMaterial),new THREE.Mesh(treeGeometry,lumenMaterial));

  const cartilage=new THREE.Group();anatomy.add(cartilage);
  const cartilageMaterial=new THREE.MeshStandardMaterial({color:0xc8d0ce,roughness:.65,transparent:true,opacity:.72});
  for(let i=0;i<16;i++) {
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.196,.022,6,28,Math.PI*1.65),cartilageMaterial);
    ring.rotation.x=Math.PI/2;ring.rotation.z=.58;ring.position.set(0,1.84+i*.115,-.035);cartilage.add(ring);
  }
  const larynx=new THREE.Mesh(new THREE.CylinderGeometry(.26,.2,.45,12,1,true),new THREE.MeshStandardMaterial({color:0x88a6b8,roughness:.6,transparent:true,opacity:.35,side:THREE.DoubleSide}));
  larynx.position.set(0,3.9,-.015);anatomy.add(larynx);

  const ribs=new THREE.Group();anatomy.add(ribs);
  const boneMaterial=new THREE.MeshStandardMaterial({color:0x99bac9,roughness:.7,transparent:true,opacity:.085,depthWrite:false});
  for(let j=0;j<9;j++) for(const side of [-1,1]) {
    const y=2.0-j*.47,width=2.5+Math.sin(j/9*Math.PI)*.25;
    const points=[new THREE.Vector3(side*.13,y-.13,.99),new THREE.Vector3(side*1.3,y-.3,1.1),new THREE.Vector3(side*width,y+.04,.25),new THREE.Vector3(side*2.0,y+.22,-.88),new THREE.Vector3(side*.3,y+.24,-1.0)];
    ribs.add(lineCurve(points,.042,boneMaterial));
  }
  for(const side of [-1,1]) ribs.add(lineCurve([new THREE.Vector3(side*.05,2.8,.5),new THREE.Vector3(side*.9,2.83,.56),new THREE.Vector3(side*2.12,2.55,.1)],.067,boneMaterial));
  const thoraxProfile=[new THREE.Vector2(1.9,-3.0),new THREE.Vector2(2.3,-2.4),new THREE.Vector2(2.72,-.5),new THREE.Vector2(2.82,1.3),new THREE.Vector2(2.84,2.25),new THREE.Vector2(2.5,2.6),new THREE.Vector2(1.4,3.05),new THREE.Vector2(.5,3.35),new THREE.Vector2(.43,4.2)];
  const thorax=new THREE.Mesh(new THREE.LatheGeometry(thoraxProfile,56),new THREE.MeshPhysicalMaterial({color:0x477c9b,transparent:true,opacity:.055,roughness:.4,depthWrite:false,side:THREE.FrontSide}));thorax.scale.z=.43;ribs.add(thorax);
  const sternum=new THREE.Mesh(new THREE.CapsuleGeometry(.09,2.25,5,8),boneMaterial);sternum.position.set(0,.87,1.07);ribs.add(sternum);
  const spine=new THREE.Mesh(new THREE.CylinderGeometry(.11,.13,5.5,8),boneMaterial);spine.position.set(0,.35,-1);ribs.add(spine);
  const diaphragm=new THREE.Mesh(new THREE.SphereGeometry(1,36,16,0,TAU,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0xa67187,roughness:.6,transparent:true,opacity:.14,depthWrite:false,side:THREE.DoubleSide}));
  diaphragm.scale.set(2.63,.53,.95);diaphragm.position.set(0,-2.7,0);anatomy.add(diaphragm);

  const markerMaterial=new THREE.MeshBasicMaterial({color:0x8fe5f5});
  const markerGeometry=new THREE.SphereGeometry(.066,12,8);const markers:THREE.Mesh[]=[];
  lobeAnchors.forEach(lobe=>{const dot=new THREE.Mesh(markerGeometry,markerMaterial);dot.position.copy(lobe.point);dot.position.z+=.18;dot.userData.region=lobe.region;anatomy.add(dot);markers.push(dot);});
  const selection=new THREE.Mesh(new THREE.TorusGeometry(.16,.008,6,32),new THREE.MeshBasicMaterial({color:0xb5efff,transparent:true,opacity:.8}));anatomy.add(selection);

  const spriteCanvas=document.createElement('canvas');spriteCanvas.width=64;spriteCanvas.height=64;
  const spriteContext=spriteCanvas.getContext('2d')!;
  const gradient=spriteContext.createRadialGradient(32,32,2,32,32,30);gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.3,'#d1f4ff');gradient.addColorStop(.7,'rgba(130,210,240,.45)');gradient.addColorStop(1,'rgba(130,210,240,0)');
  spriteContext.fillStyle=gradient;spriteContext.fillRect(0,0,64,64);
  const spriteTexture=new THREE.CanvasTexture(spriteCanvas);
  const particleCount=200;
  const flowPositions=new Float32Array(particleCount*3),flowGeometry=new THREE.BufferGeometry();
  flowGeometry.setAttribute('position',new THREE.BufferAttribute(flowPositions,3));
  const flow=new THREE.Points(flowGeometry,new THREE.PointsMaterial({color:0xa6ecfa,size:.065,map:spriteTexture,alphaTest:.03,transparent:true,opacity:.85,depthWrite:false,sizeAttenuation:true}));anatomy.add(flow);
  let flowTime=0;
  const mucusGeometry=new THREE.SphereGeometry(1,8,6);
  const mucusMaterial=new THREE.MeshPhysicalMaterial({color:0xbca653,roughness:.18,clearcoat:.75,transparent:true,opacity:.83});
  const deposits=new THREE.InstancedMesh(mucusGeometry,mucusMaterial,72);anatomy.add(deposits);
  const dummy=new THREE.Object3D();

  const layerMeshes={} as Record<Layer,THREE.Mesh>;
  for(const layer of Object.keys(layerInfo) as Layer[]) {
    const material=new THREE.MeshPhysicalMaterial({color:layerInfo[layer].color,roughness:layer==='mucus'?.16:layer==='epithelium'?.32:.58,metalness:0,clearcoat:layer==='mucus'?.9:.22,side:THREE.DoubleSide,transparent:layer==='mucus',depthWrite:layer!=='mucus',map:layer==='mucus'?null:texture,bumpMap:layer==='mucus'?null:texture,bumpScale:layer==='muscle'?.06:.025});
    const mesh=new THREE.Mesh(new THREE.BufferGeometry(),material);inspection.add(mesh);layerMeshes[layer]=mesh;
  }
  const muscleBands=new THREE.Group();inspection.add(muscleBands);
  const bandMaterial=new THREE.MeshStandardMaterial({color:0x9e414e,roughness:.45});
  for(let i=0;i<14;i++) {const band=new THREE.Mesh(new THREE.TorusGeometry(1,.017,5,72,TAU-Math.PI*.52),bandMaterial);band.rotation.z=Math.PI*.52;band.position.z=-1.72+i*.26;muscleBands.add(band);}
  // Fine epithelial folds and mucus variation are part of the shell geometry, not a color overlay.
  const inspectionFlowGeometry=new THREE.BufferGeometry();
  const inspectionFlowPositions=new Float32Array(54*3);inspectionFlowGeometry.setAttribute('position',new THREE.BufferAttribute(inspectionFlowPositions,3));
  const inspectionFlow=new THREE.Points(inspectionFlowGeometry,new THREE.PointsMaterial({color:0xa7eaf4,size:.045,map:spriteTexture,alphaTest:.03,transparent:true,opacity:.85,depthWrite:false}));inspection.add(inspectionFlow);
  const bronchialFork=new THREE.Group();inspection.add(bronchialFork);
  const forkMaterial=new THREE.MeshStandardMaterial({color:0x976252,roughness:.43,side:THREE.DoubleSide});
  for(const side of [-1,1]) {
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*.22,0,-1.8),new THREE.Vector3(side*.47,.03,-2.7),new THREE.Vector3(side*1.1,.12,-3.8)]);
    bronchialFork.add(new THREE.Mesh(new THREE.TubeGeometry(curve,20,.44,32,false),forkMaterial));
  }
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let pointerStart={x:0,y:0};
  const pointerDown=(event:PointerEvent)=>{pointerStart={x:event.clientX,y:event.clientY};};
  const pointerUp=(event:PointerEvent)=>{
    if(getState().options.view!=='anatomy'||Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>6)return;
    const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(markers);
    if(hits.length)onRegion(hits[0].object.userData.region as Region);
  };
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
  const keyDown=(event:KeyboardEvent)=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(event.key))return;
    event.preventDefault();
    const offset=camera.position.clone().sub(controls.target);
    const spherical=new THREE.Spherical().setFromVector3(offset);
    if(event.key==='ArrowLeft')spherical.theta-=.1;if(event.key==='ArrowRight')spherical.theta+=.1;
    if(event.key==='ArrowUp')spherical.phi=Math.max(.2,spherical.phi-.1);if(event.key==='ArrowDown')spherical.phi=Math.min(Math.PI-.2,spherical.phi+.1);
    if(event.key==='+')spherical.radius=Math.max(controls.minDistance,spherical.radius*.9);if(event.key==='-')spherical.radius=Math.min(controls.maxDistance,spherical.radius*1.1);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();
  };
  renderer.domElement.addEventListener('keydown',keyDown);
  let sizeDirty=true,inViewport=true;
  const resize=()=>{sizeDirty=true;const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const visibilityObserver=new IntersectionObserver(([entry])=>{inViewport=entry.isIntersecting;sizeDirty=true;});visibilityObserver.observe(host);
  let lastView:AnatomyView|null=null,lastReset=-1,lastShape='',lastParams='',lastPhase=getState().phase;
  const updateInspection=(profile:AirwayProfile,options:AnatomyOptions)=>{
    const cut=options.view!=='endoscopy';const separated=options.exploded&&cut;
    const boundaries:Record<Layer,[RadialFunction,RadialFunction]>={
      mucus:[profile.lumenRadius,profile.epithelialRadius],
      epithelium:[profile.epithelialRadius,()=>profile.lining+.045],
      mucosa:[()=>profile.lining+.045,()=>profile.mucosa],
      muscle:[()=>profile.mucosa,()=>profile.muscle],
      outer:[()=>profile.muscle,()=>profile.outer],
    };
    const offsets:Record<Layer,number>={mucus:0,epithelium:.16,mucosa:.32,muscle:.48,outer:.64};
    for(const layer of Object.keys(layerMeshes) as Layer[]) {
      const [inner,outer]=boundaries[layer],offset=separated?offsets[layer]:0;
      const geometry=shellGeometry((t,z)=>inner(t,z)+offset,(t,z)=>outer(t,z)+offset,cut);
      layerMeshes[layer].geometry.dispose();layerMeshes[layer].geometry=geometry;
    }
    muscleBands.children.forEach(b=>b.scale.set(profile.muscle+(separated?.48:0),profile.muscle+(separated?.48:0),1));
  };
  let lastFrame=0,lastRenderedPhase=-1,lastRenderKey='';
  renderer.setAnimationLoop((timestamp)=>{
    if(!inViewport||document.hidden||timestamp-lastFrame<1000/30)return;
    lastFrame=timestamp;
    const {metrics:m,parameters:p,phase,options:o}=getState();
    controls.update();
    const renderKey=JSON.stringify([p,o]);
    if(phase===lastRenderedPhase&&renderKey===lastRenderKey&&!cameraDirty&&!sizeDirty)return;
    lastRenderedPhase=phase;lastRenderKey=renderKey;sizeDirty=false;
    const deltaPhase=Math.max(0,phase-lastPhase);lastPhase=phase;
    flowTime+=deltaPhase*(.15+m.airflow/110);
    if(o.view!==lastView||o.reset!==lastReset) {
      const narrow=camera.aspect<.8;
      if(o.view==='anatomy') {camera.position.set(1.1,1.05, narrow?14.5:12.2);controls.target.set(0,.6,0);controls.minDistance=5;controls.maxDistance=18;}
      else if(o.view==='cutaway') {camera.position.set(3.2,2.6,narrow?8.3:5.9);controls.target.set(0,0,0);controls.minDistance=4;controls.maxDistance=14;}
      else {camera.position.set(.015,.015,1.5);controls.target.set(0,0,-2);controls.minDistance=3.3;controls.maxDistance=5;}
      controls.enableRotate=o.view!=='endoscopy';controls.enableZoom=o.view!=='endoscopy';controls.update();lastView=o.view;lastReset=o.reset;
    }
    anatomy.visible=o.view==='anatomy';inspection.visible=!anatomy.visible;
    const expansion=1+Math.sin(phase)*.022*m.airflow/100;
    anatomy.scale.set(expansion,1+(expansion-1)*.7,expansion);
    diaphragm.position.y=-2.64-Math.sin(phase)*.13*m.airflow/100;
    tissueMaterial.opacity=o.tissue/100;lungShells.visible=o.tissue>0;fissures.visible=o.tissue>0;ribs.visible=o.ribs;
    wallUniform.value=p.constriction*.0048;
    lumenUniform.value=1-m.radius;
    wallMaterial.color.set(0xe6b29e).lerp(new THREE.Color(0xc56665),p.inflammation/150);
    lumenMaterial.color.set(0x70403e).lerp(new THREE.Color(0x844626),p.mucus/140);
    const lobe=lobeAnchors.find(a=>a.region===o.region);
    selection.visible=!!lobe&&anatomy.visible;if(lobe){selection.position.copy(lobe.point);selection.position.z+=.22;selection.quaternion.copy(camera.quaternion);}
    const paramsKey=[p.constriction,p.inflammation,p.mucus,p.activity,p.allergen].map(v=>v.toFixed(1)).join(',');
    if(paramsKey!==lastParams) {
      for(let i=0;i<72;i++) {
        const branch=tree[3+(i*13)%(tree.length-3)];const point=branch.curve.getPointAt(.2+(i%5)*.14);
        dummy.position.copy(point);dummy.position.z+=branch.radius*.35;
        const r=branch.radius*(p.mucus/100)*.75;
        dummy.scale.set(r,r*.8,r*1.2);dummy.updateMatrix();deposits.setMatrixAt(i,dummy.matrix);
      }
      deposits.instanceMatrix.needsUpdate=true;lastParams=paramsKey;
    }
    deposits.visible=o.layers.mucus&&p.mucus>0;
    flow.visible=o.airflow;
    flowGeometry.setDrawRange(0,Math.floor(particleCount*(.18+.82*m.airflow/100)));
    for(let i=0;i<particleCount;i++) {
      const branch=tree[i<30?0:1+(i*17)%(tree.length-1)];
      const raw=(flowTime*.24+i*.137)%1;
      const t=Math.cos(phase)>0?raw:1-raw;
      const point=branch.curve.getPointAt(t);
      flowPositions.set(point.toArray(),i*3);
    }
    flowGeometry.getAttribute('position').needsUpdate=true;
    if(inspection.visible) {
      const profile=airwayProfile(p,o.region);
      const shapeKey=paramsKey+o.region+o.view+o.exploded;
      if(shapeKey!==lastShape){updateInspection(profile,o);lastShape=shapeKey;}
      (layerMeshes.mucus.material as THREE.MeshPhysicalMaterial).opacity=.09+p.mucus/100*.87;
      for(const layer of Object.keys(layerMeshes) as Layer[])layerMeshes[layer].visible=o.layers[layer]&&(layer!=='mucus'||p.mucus>0);
      muscleBands.visible=o.layers.muscle&&o.view==='cutaway';
      bronchialFork.visible=o.view==='endoscopy';bronchialFork.scale.set(profile.metrics.radius,profile.metrics.radius,1);
      inspectionFlow.visible=o.airflow;inspectionFlowGeometry.setDrawRange(0,Math.max(5,Math.floor(54*m.airflow/100)));
      for(let i=0;i<54;i++) {
        const angle=i*2.39996,rad=profile.lumenRadius(angle)*(.22+(i%5)*.1);
        const t=(flowTime*.28+i*.137)%1;
        inspectionFlowPositions.set([Math.cos(angle)*rad,Math.sin(angle)*rad,(Math.cos(phase)>0?1-t:t)*3.2-1.6],i*3);
      }
      inspectionFlowGeometry.getAttribute('position').needsUpdate=true;
    }
    controls.update();renderer.render(scene,camera);cameraDirty=false;
  });
  return ()=>{
    renderer.setAnimationLoop(null);observer.disconnect();visibilityObserver.disconnect();controls.dispose();
    renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('keydown',keyDown);
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Points){geometries.add(object.geometry);const mats=Array.isArray(object.material)?object.material:[object.material];mats.forEach(m=>materials.add(m));}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());texture.dispose();spriteTexture.dispose();environmentMap.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
  };
}

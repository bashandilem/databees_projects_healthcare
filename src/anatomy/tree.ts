import * as THREE from 'three';
import type { Region } from './airway';
export interface AirwayBranch {
  curve: THREE.CatmullRomCurve3;
  radius: number;
  generation: number;
  region: Region;
}
export const lobeAnchors: { region: Region; side: number; point: THREE.Vector3; root: THREE.Vector3; targets: number[][] }[] = [
  { region: 'rightUpper', side: -1, root: new THREE.Vector3(-.55, 1.15, 0), point: new THREE.Vector3(-1.15, 1.15, -.05), targets: [[-1.45,2.05,-.1],[-2,1.5,-.35],[-1.75,1,.65]] },
  { region: 'rightMiddle', side: -1, root: new THREE.Vector3(-.73,.72,0), point: new THREE.Vector3(-1.35,.2,.2), targets: [[-2,.05,.7],[-1.3,-.5,.65]] },
  { region: 'rightLower', side: -1, root: new THREE.Vector3(-.78,.48,-.06), point: new THREE.Vector3(-1.28,-.65,-.12), targets: [[-1.3,.12,-.7],[-2,-1.35,-.35],[-1.4,-1.75,.6],[-1,-1.85,-.5],[-2,-1.9,.15]] },
  { region: 'leftUpper', side: 1, root: new THREE.Vector3(.68,1.05,0), point: new THREE.Vector3(1.25,.85,.03), targets: [[1.5,2.0,-.1],[2,1.2,-.35],[1.75,.5,.65],[1.75,-.3,.65]] },
  { region: 'leftLower', side: 1, root: new THREE.Vector3(.9,.48,-.08), point: new THREE.Vector3(1.45,-.65,-.16), targets: [[1.3,.04,-.65],[2,-1.25,-.4],[1.65,-1.8,.6],[1,-1.8,-.4],[2.15,-1.8,.08]] },
];
function makeCurve(start: THREE.Vector3, end: THREE.Vector3, bend = 0) {
  const mid = start.clone().lerp(end, .48);
  mid.z += bend;
  return new THREE.CatmullRomCurve3([start.clone(), mid, end.clone()]);
}
export function createBronchialTree(): AirwayBranch[] {
  const tree: AirwayBranch[] = [{ curve: makeCurve(new THREE.Vector3(0,3.65,0),new THREE.Vector3(0,1.65,0),-.06), radius:.18, generation:0, region:'trachea' }];
  for (const side of [-1,1]) tree.push({ curve: makeCurve(new THREE.Vector3(0,1.65,0),new THREE.Vector3(side*.9,.45,-.06),.03),radius:.14,generation:1,region:side<0?'rightLower':'leftLower' });
  const grow = (start: THREE.Vector3, end: THREE.Vector3, generation: number, radius: number, region: Region, seed: number) => {
    tree.push({ curve: makeCurve(start,end,.035*Math.sin(seed)), radius,generation,region });
    if (generation>=8) return;
    const direction = end.clone().sub(start).normalize();
    const axis = new THREE.Vector3(Math.cos(seed*2.3), .35, Math.sin(seed*2.3)).normalize();
    const perpendicular = new THREE.Vector3().crossVectors(direction,axis).normalize();
    for(let j=0;j<2;j++) {
      const length = .45*Math.pow(.76,generation-3);
      const d = direction.clone().multiplyScalar(.65).addScaledVector(perpendicular,j===0?.62:-.62).normalize();
      const target = end.clone().addScaledVector(d,length);
      target.y=THREE.MathUtils.clamp(target.y,-2.16,2.22);
      const v=Math.asin(THREE.MathUtils.clamp((2.6-target.y)/4.9,0,1))*2/Math.PI;
      const width=Math.pow(Math.sin(v*Math.PI),.52)*(1.02+.18*v)*.9;
      const center=(end.x<0?-1:1)*(1.38+.12*Math.sin(v*Math.PI));
      target.x=THREE.MathUtils.clamp(target.x,center-width,center+width);
      const lateral=(target.x-center)/width;
      const depth=width*.72*Math.sqrt(Math.max(.04,1-lateral*lateral));
      target.z=THREE.MathUtils.clamp(target.z,-depth,depth);
      grow(end,target,generation+1,radius*.66,region,seed*1.17+j*3.7);
    }
  };
  lobeAnchors.forEach((lobe,i)=>{
    tree.push({curve:makeCurve(lobe.root,lobe.point,.025),radius:.103,generation:2,region:lobe.region});
    lobe.targets.forEach((p,j)=>grow(lobe.point,new THREE.Vector3(...p),3,.071,lobe.region,i*7+j+1));
  });
  return tree;
}

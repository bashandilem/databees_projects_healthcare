import * as THREE from 'three';

// A smooth implicit surface joins the thorax, neck, head and arms into one
// envelope. Shared tetrahedron edges retain continuous normals at the joins.
export function humanEnvelope() {
  const smoothMin = (a: number, b: number, k: number) => {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * .25;
  };
  const ellipsoid = (x: number, y: number, z: number, rx: number, ry: number, rz: number) => {
    const k0 = Math.hypot(x / rx, y / ry, z / rz);
    const k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz));
    return k1 > 1e-8 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
  };
  const capsule = (x: number, y: number, z: number, ax: number, ay: number, bx: number, by: number, r: number) => {
    const dx = bx - ax, dy = by - ay;
    const t = THREE.MathUtils.clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(x - ax - t * dx, y - ay - t * dy, z) - r * (1 - .25 * t);
  };
  const field = (x: number, y: number, z: number) => {
    let d = ellipsoid(x, y - .3, z + .2, 2.9, 3.0, 1.22);
    d = smoothMin(d, ellipsoid(x, y + 2.8, z + .27, 2.05, 2.8, .96), .8);
    d = smoothMin(d, ellipsoid(x, y - 3.8, z + .2, .56, 1.25, .53), .6);
    d = smoothMin(d, ellipsoid(x, y - 5.57, z + .25, .86, 1.22, .77), .24);
    d = smoothMin(d, ellipsoid(x, y - 4.98, z - .02, .64, .62, .62), .22);
    d = smoothMin(d, ellipsoid(x, y - 5.48, z - .55, .12, .28, .25), .1);
    // Shallow eye sockets and brow/nose relief read in the rim lighting.
    const socket = ellipsoid(Math.abs(x) - .3, y - 5.66, z - .55, .21, .13, .18);
    d = Math.max(d, -socket);
    const sx = Math.abs(x);
    d = smoothMin(d, ellipsoid(sx - .86, y - 5.48, z + .2, .13, .27, .17), .08);
    d = smoothMin(d, ellipsoid(sx - 2.73, y - 2.34, z + .18, .72, .82, .71), .55);
    d = smoothMin(d, capsule(sx, y, z + .15, 2.95, 2.25, 3.45, -.7, .53), .48);
    d = smoothMin(d, capsule(sx, y, z + .06, 3.45, -.7, 3.72, -4.12, .4), .28);
    // The cut at the waist is intentional: this is an upper-body anatomical atlas.
    return Math.max(d, -5.05 - y);
  };
  const step = .15, nx = 59, ny = 84, nz = 24;
  const origin = new THREE.Vector3(-4.35, -5.2, -1.9);
  const values = new Float32Array(nx * ny * nz);
  const index = (x: number, y: number, z: number) => (y * nz + z) * nx + x;
  for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    values[index(x, y, z)] = field(origin.x + x * step, origin.y + y * step, origin.z + z * step);
  }
  const offsets = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
  const tetrahedra = [[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
  const positions: number[] = [], indices: number[] = [];
  const edgeVertices = new Map<string, number>();
  const vertex = (a: number, b: number) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const cached = edgeVertices.get(key);
    if (cached !== undefined) return cached;
    const t = values[a] / (values[a] - values[b]);
    const point = (id: number) => [id % nx, Math.floor(id / (nx * nz)), Math.floor(id / nx) % nz];
    const pa = point(a), pb = point(b);
    const id = positions.length / 3;
    positions.push(origin.x + (pa[0] + (pb[0] - pa[0]) * t) * step, origin.y + (pa[1] + (pb[1] - pa[1]) * t) * step, origin.z + (pa[2] + (pb[2] - pa[2]) * t) * step);
    edgeVertices.set(key, id);
    return id;
  };
  const triangle = (a: number, b: number, c: number) => {
    const p = new THREE.Vector3().fromArray(positions, a * 3);
    const q = new THREE.Vector3().fromArray(positions, b * 3);
    const r = new THREE.Vector3().fromArray(positions, c * 3);
    const normal = q.clone().sub(p).cross(r.clone().sub(p)).normalize();
    const center = p.clone().add(q).add(r).multiplyScalar(1 / 3);
    const outside = center.clone().addScaledVector(normal, .012);
    if (field(outside.x, outside.y, outside.z) > field(center.x, center.y, center.z)) indices.push(a,b,c);
    else indices.push(a,c,b);
  };
  for (let y = 0; y < ny - 1; y++) for (let z = 0; z < nz - 1; z++) for (let x = 0; x < nx - 1; x++) {
    const ids = offsets.map(([dx,dy,dz]) => index(x + dx,y + dy,z + dz));
    if (ids.every(id => values[id] >= 0) || ids.every(id => values[id] < 0)) continue;
    for (const tet of tetrahedra) {
      const inside = tet.map(i => ids[i]).filter(id => values[id] < 0);
      const outside = tet.map(i => ids[i]).filter(id => values[id] >= 0);
      if (!inside.length || !outside.length) continue;
      if (inside.length === 1) triangle(...outside.map(b => vertex(inside[0], b)) as [number,number,number]);
      else if (outside.length === 1) triangle(...inside.map(a => vertex(a, outside[0])) as [number,number,number]);
      else {
        const a = vertex(inside[0], outside[0]), b = vertex(inside[0], outside[1]);
        const c = vertex(inside[1], outside[0]), d = vertex(inside[1], outside[1]);
        triangle(a,b,c); triangle(b,d,c);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function envelopeMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.FrontSide,
    uniforms: { color: { value: new THREE.Color('#a999ce') } },
    vertexShader: `varying vec3 vNormal; varying vec3 vEye;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal); vEye = -view.xyz;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `uniform vec3 color; varying vec3 vNormal; varying vec3 vEye;
      void main() {
        float facing = abs(dot(normalize(vNormal), normalize(vEye)));
        float rim = pow(1.0 - facing, 3.2);
        float light = .65 + .35 * max(0.0, dot(normalize(vNormal), normalize(vec3(-.6, .7, 1.0))));
        gl_FragColor = vec4(color * light, .028 + rim * .62);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

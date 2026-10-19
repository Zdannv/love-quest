// Peliharaan 3D (model Kenney Cube Pets, lisensi CC0: img/pets/LICENSE.txt) dirender pakai three.js (MIT: js/vendor/three-LICENSE.txt).
// three.js baru dimuat pas layar peliharaan dibuka, jadi halaman lain nggak jadi berat.
// Animasi bawaan model: idle, walk, run, eat, dance, gesture-positive, gesture-negative (+ tidur = rebahan diam).

let THREE = null, GLTFLoader = null;
async function lib() {
  if (!THREE) {
    THREE = await import('./vendor/three.module.min.js');
    ({ GLTFLoader } = await import('./vendor/GLTFLoader.js'));
  }
  return THREE;
}
const cache = new Map(); // model yang udah dimuat (dipakai ulang)

// Aksesoris 3D: dibikin dari bentuk dasar three.js, ditempel ke badan hewan (ikut gerak animasinya).
// A = titik patokan kepala di koordinat badan: top (atas kepala), front (muka), eye (tinggi mata), hw (setengah lebar), cx/cz (tengah).
const ACC = {
  pita(A) { const g = grp(), m = mat(0xff5c93); const k = ball(0.09, m); g.add(k);
    for (const sd of [-1, 1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 4), m); c.rotation.z = sd * Math.PI / 2; c.position.x = sd * 0.15; c.scale.z = 0.5; g.add(c); }
    g.position.set(A.cx + A.hw * 0.5, A.top + 0.07, A.front - 0.25); g.rotation.z = -0.35; return g; },
  topi(A) { const g = grp(), m = mat(0x3b9cff), w = mat(0xffffff);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(A.hw * 0.82, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m); dome.scale.y = 0.62; g.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(A.hw * 0.62, A.hw * 0.62, 0.04, 20, 1, false, -Math.PI / 2, Math.PI), m); brim.position.set(0, 0.02, A.hw * 0.55); brim.scale.z = 1.1; g.add(brim);
    g.add(at(ball(0.06, w), 0, A.hw * 0.52, 0));
    g.position.set(A.cx, A.top - 0.02, A.cz + (A.front - A.cz) * 0.15); return g; },
  kacamata(A) { const g = grp(), m = mat(0x222233, 0.3), l = mat(0x5a6bff, 0.15);
    for (const sd of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.05), m); f.position.x = sd * A.hw * 0.42; g.add(f); const gl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.02), l); gl.position.set(sd * A.hw * 0.42, 0, 0.02); g.add(gl); }
    const br = new THREE.Mesh(new THREE.BoxGeometry(A.hw * 0.5, 0.04, 0.04), m); br.position.y = 0.04; g.add(br);
    g.position.set(A.cx, A.eye, A.front + 0.04); return g; },
  bunga(A) { const g = grp(), band = mat(0xffffff);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(A.hw * 1.02, 0.045, 8, 24, Math.PI), band); arc.position.y = -A.hw * 0.75; arc.scale.y = 0.8; g.add(arc);
    [[-0.45, 0xff8fb7], [0, 0xffd166], [0.45, 0xc9a6ff]].forEach(([x, c]) => { const fl = flower(c); fl.position.set(x * A.hw, 0.06 + (x ? 0 : 0.03), 0.02); g.add(fl); });
    g.position.set(A.cx, A.top, A.cz + (A.front - A.cz) * 0.2); return g; },
  pesta(A) { const g = grp(); const tex = stripes(['#ff6fa3', '#ffd166', '#6fc8ff']);
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.62, 20), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })); c.position.y = 0.3; g.add(c);
    g.add(at(ball(0.08, mat(0xffffff)), 0, 0.62, 0));
    g.position.set(A.cx - A.hw * 0.25, A.top - 0.02, A.cz); g.rotation.z = 0.25; return g; },
  headset(A) { const g = grp(), m = mat(0xff6f9f), d = mat(0x333344);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(A.hw * 1.05, 0.05, 8, 24, Math.PI), m); arc.position.y = -A.hw * 0.62; g.add(arc);
    for (const sd of [-1, 1]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 16), m); cup.rotation.z = Math.PI / 2; cup.position.set(sd * (A.hw + 0.05), -A.hw * 0.62, 0); g.add(cup); const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16), d); pad.rotation.z = Math.PI / 2; pad.position.set(sd * (A.hw - 0.02), -A.hw * 0.62, 0); g.add(pad); }
    g.position.set(A.cx, A.top, A.cz + (A.front - A.cz) * 0.1); return g; },
  santa(A) { const g = grp(), r = mat(0xe53950), w = mat(0xffffff);
    const c = new THREE.Mesh(new THREE.ConeGeometry(A.hw * 0.7, 0.6, 18), r); c.position.set(0, 0.3, 0); c.rotation.z = 0.35; g.add(c);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(A.hw * 0.68, 0.07, 8, 22), w); rim.rotation.x = Math.PI / 2; g.add(rim);
    g.add(at(ball(0.09, w), -0.2, 0.58, 0));
    g.position.set(A.cx, A.top + 0.03, A.cz); return g; },
  tinggi(A) { const g = grp(), b = mat(0x2a2233), r = mat(0xe8558f);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(A.hw * 0.78, A.hw * 0.78, 0.04, 22), b); g.add(brim);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(A.hw * 0.5, A.hw * 0.5, 0.5, 22), b); body.position.y = 0.27; g.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(A.hw * 0.51, A.hw * 0.51, 0.09, 22), r); band.position.y = 0.08; g.add(band);
    g.position.set(A.cx, A.top + 0.01, A.cz); g.rotation.z = -0.08; return g; },
  halo(A) { const g = grp(), m = new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xffc21a, emissiveIntensity: 0.8, roughness: 0.3 });
    const t = new THREE.Mesh(new THREE.TorusGeometry(A.hw * 0.55, 0.05, 10, 30), m); t.rotation.x = Math.PI / 2; g.add(t);
    g.position.set(A.cx, A.top + 0.32, A.cz); g.userData.bob = A.top + 0.32; return g; },
  mahkota(A) { const g = grp(), gold = mat(0xffc93c, 0.35), gem = [mat(0xff4d6d, 0.2), mat(0x4dc3ff, 0.2)];
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(A.hw * 0.55, A.hw * 0.5, 0.16, 20, 1, true), gold); ring.material.side = THREE.DoubleSide; ring.position.y = 0.08; g.add(ring);
    for (let i = 0; i < 6; i++) { const an = (i / 6) * Math.PI * 2, sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), gold); sp.position.set(Math.sin(an) * A.hw * 0.53, 0.23, Math.cos(an) * A.hw * 0.53); g.add(sp);
      g.add(at(ball(0.035, gem[i % 2]), Math.sin(an) * A.hw * 0.56, 0.08, Math.cos(an) * A.hw * 0.56)); }
    g.position.set(A.cx, A.top, A.cz); return g; },
};
const grp = () => new THREE.Group();
const mat = (c, r = 0.55) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
const ball = (r, m) => new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
function flower(c) { const g = grp(), m = mat(c); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.add(at(ball(0.055, m), Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0)); } g.add(ball(0.045, mat(0xffb020))); return g; }
function stripes(cols) { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); cols.forEach((col, i) => { x.fillStyle = col; x.fillRect(0, (i * 64) / cols.length, 64, 64 / cols.length + 1); }); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

export async function createPet3D() {
  await lib();
  const el = document.createElement('div');
  el.className = 'pet3d';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 2.1, 5.2);
  camera.lookAt(0, 0.55, 0);
  scene.add(new THREE.HemisphereLight(0xfff2f8, 0xd9a3c4, 1.35));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(2.5, 5, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 15 });
  sun.shadow.radius = 4;
  scene.add(sun);
  // karpet bulat
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.45, 48), new THREE.MeshStandardMaterial({ color: 0xffc7dc, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.receiveShadow = true; scene.add(rug);
  const rim = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.58, 48), new THREE.MeshStandardMaterial({ color: 0xff9fc2, roughness: 1 }));
  rim.rotation.x = -Math.PI / 2; rim.position.y = 0.002; scene.add(rim);

  const holder = new THREE.Group(); scene.add(holder);
  let body = null, anchor = null, outfitId = null, outfitObj = null;
  let model = null, mixer = null, actions = {}, current = null, kind = null, sleeping = false, size = 1;
  let wander = { t: 4 + Math.random() * 4, target: null };
  let back = 0; // jeda sebelum balik ke idle
  const clock = new THREE.Clock();
  let raf = 0, running = false, W = 0, H = 0;

  function fit() {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || (r.width === W && r.height === H)) return;
    W = r.width; H = r.height;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
  }
  function play(name, { once = false, fade = 0.25, hold = 0 } = {}) {
    const a = actions[name]; if (!a) return;
    if (current && current !== a) current.fadeOut(fade);
    a.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade);
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    a.clampWhenFinished = true;
    a.play();
    current = a;
    back = once ? (a.getClip().duration + hold) : 0;
  }
  async function load(k) {
    if (k === kind && model) return;
    kind = k;
    let gltf = cache.get(k);
    if (!gltf) { gltf = await new GLTFLoader().loadAsync(`/img/pets/animal-${k}.glb`); cache.set(k, gltf); }
    if (kind !== k) return;
    if (model) holder.remove(model);
    model = gltf.scene.clone(true);
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    // samain tinggi semua hewan (±1 unit), taruh di tengah karpet
    const box = new THREE.Box3().setFromObject(model), sz = box.getSize(new THREE.Vector3());
    const s = 1.32 / Math.max(sz.y, sz.x * 0.8);
    model.scale.setScalar(s);
    const b2 = new THREE.Box3().setFromObject(model);
    model.position.set(-(b2.min.x + b2.max.x) / 2, -b2.min.y, -(b2.min.z + b2.max.z) / 2);
    holder.add(model);
    holder.position.set(0, 0, 0); holder.rotation.set(0, 0, 0);
    const hs = holder.scale.x; holder.scale.setScalar(1);
    findAnchor();
    holder.scale.setScalar(hs);
    mountOutfit();
    mixer = new THREE.AnimationMixer(model);
    actions = {};
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    current = null;
    holder.position.set(0, 0, 0); holder.rotation.set(0, 0, 0);
    if (sleeping) applySleep(); else play('idle', { fade: 0 });
  }
  // Cari titik atas kepala / muka pakai sinar (raycast) di pose diam, lalu simpen dalam koordinat badan
  function findAnchor() {
    body = null; anchor = null;
    model.traverse((o) => { if (!body && o.isMesh && o.name === 'body') body = o; });
    if (!body) model.traverse((o) => { if (!body && o.isMesh) body = o; });
    if (!body) return;
    holder.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(), bb = new THREE.Box3().setFromObject(body);
    const cast = (o, d) => { ray.set(o, d); const h = ray.intersectObject(body, false)[0]; return h ? h.point : null; };
    const cx = (bb.min.x + bb.max.x) / 2, cz0 = (bb.min.z + bb.max.z) / 2;
    // muka = permukaan paling depan di tengah
    const fz = cast(new THREE.Vector3(cx, (bb.min.y + bb.max.y) / 2, bb.max.z + 1), new THREE.Vector3(0, 0, -1))?.z ?? bb.max.z;
    const cz = Math.min(cz0 + 0.1, fz - 0.45);
    // atas kepala: tembak ke bawah di beberapa titik, ambil yang paling rendah (biar kuping/jambul nggak kehitung)
    // atas kepala: tembak ke bawah di banyak titik; atas kubus itu datar jadi tingginya paling sering muncul
    // (kuping/jambul lebih tinggi, hidung/moncong lebih rendah → kalah suara)
    const hits = {};
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 2; j++) {
      const z = cz + j * 0.1; if (z > fz - 0.08) continue;
      const p = cast(new THREE.Vector3(cx + i * 0.1, bb.max.y + 1, z), new THREE.Vector3(0, -1, 0)); if (!p) continue;
      const key = Math.round(p.y * 25); hits[key] = (hits[key] || 0) + 1;
    }
    const best = Object.entries(hits).sort((x, y) => y[1] - x[1] || x[0] - y[0])[0];
    const top = best ? +best[0] / 25 : bb.max.y;
    const eyeY = top - 0.36;
    let front = -Infinity;
    for (const dx of [-0.25, 0.25]) { const p = cast(new THREE.Vector3(cx + dx, eyeY, bb.max.z + 1), new THREE.Vector3(0, 0, -1)); if (p) front = Math.max(front, p.z); }
    if (!isFinite(front)) front = fz;
    const side = cast(new THREE.Vector3(bb.max.x + 1, eyeY, cz), new THREE.Vector3(-1, 0, 0));
    const hw = side ? side.x - cx : (bb.max.x - bb.min.x) / 2;
    const L = (x, y, z) => body.worldToLocal(new THREE.Vector3(x, y, z));
    const pT = L(cx, top, cz), pF = L(cx, eyeY, front), pS = L(cx + hw, eyeY, cz), pC = L(cx, eyeY, cz);
    const k = 1 / body.getWorldScale(new THREE.Vector3()).x; // ukuran aksesoris dalam satuan dunia → satuan badan
    anchor = { top: pT.y, eye: pF.y, front: pF.z, cz: pT.z, cx: pT.x, hw: pS.distanceTo(pC), k };
  }
  function mountOutfit() {
    if (outfitObj) { outfitObj.removeFromParent(); outfitObj = null; }
    if (!body || !anchor || !outfitId || !ACC[outfitId]) return;
    // dibikin dalam satuan dunia lalu diskalakan ke satuan badan
    const k = anchor.k, A = { ...anchor, top: anchor.top / k, eye: anchor.eye / k, front: anchor.front / k, cz: anchor.cz / k, cx: anchor.cx / k, hw: anchor.hw / k };
    A.hw = Math.min(A.hw, outfitId === 'headset' || outfitId === 'bunga' ? 0.8 : 0.56);
    const g = ACC[outfitId](A);
    const wrap = new THREE.Group(); wrap.add(g); wrap.scale.setScalar(k);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    body.add(wrap); outfitObj = wrap;
    pop = 1;
  }
  let pop = 0;
  function applySleep() {
    if (!model) return;
    if (sleeping) { play('static', { fade: 0.4 }); holder.rotation.z = 0; holder.userData.lie = 1; }
    else { holder.userData.lie = 0; play('gesture-positive', { once: true }); }
  }

  function tick() {
    raf = requestAnimationFrame(tick);
    if (!running) return;
    fit();
    const dt = Math.min(0.05, clock.getDelta());
    mixer?.update(dt);
    const lie = holder.userData.lie || 0;
    // rebahan pelan-pelan pas tidur
    holder.rotation.z += ((lie ? -Math.PI / 2.2 : 0) - holder.rotation.z) * Math.min(1, dt * 4);
    holder.position.y += ((lie ? 0.3 * size : 0) - holder.position.y) * Math.min(1, dt * 4);
    holder.scale.setScalar(holder.scale.x + (size - holder.scale.x) * Math.min(1, dt * 3));
    if (back > 0) { back -= dt; if (back <= 0 && !sleeping) play('idle'); }
    // jalan-jalan di karpet sesekali
    if (!sleeping && model && back <= 0) {
      if (wander.target) {
        const p = holder.position, dx = wander.target.x - p.x, dz = wander.target.z - p.z, d = Math.hypot(dx, dz);
        const ang = Math.atan2(dx, dz);
        holder.rotation.y += (ang - holder.rotation.y) * Math.min(1, dt * 6);
        if (d < 0.05) { wander.target = null; play('idle'); }
        else { const sp = current === actions.run ? 1.6 : 0.7; p.x += (dx / d) * dt * sp; p.z += (dz / d) * dt * sp; }
      } else {
        holder.rotation.y += (0 - holder.rotation.y) * Math.min(1, dt * 3); // balik ngadep kamera
        wander.t -= dt;
        if (wander.t <= 0) {
          wander.t = 6 + Math.random() * 6;
          const home = Math.hypot(holder.position.x, holder.position.z) > 0.3;
          wander.target = home ? { x: 0, z: 0 } : { x: (Math.random() - 0.5) * 1.5, z: (Math.random() - 0.3) * 0.8 };
          play('walk');
        }
      }
    }
    if (outfitObj) {
      const g = outfitObj.children[0];
      if (g.userData.bob != null) { g.position.y = g.userData.bob + Math.sin(clock.elapsedTime * 2.4) * 0.04; g.rotation.y += dt * 0.8; }
      if (pop > 0) { pop = Math.max(0, pop - dt * 3); const s = 1 + Math.sin(pop * Math.PI) * 0.35; g.scale.setScalar(s); }
    }
    if (walkTarget && !sleeping && back <= 0) { wander.target = walkTarget; walkTarget = null; play('run'); }
    renderer.render(scene, camera);
  }
  let walkTarget = null;

  // posisi kepala di layar (buat naruh aksesoris / gelembung)
  function headPos(mouth = false) {
    if (!model) return null;
    let v;
    if (body && anchor) { body.updateMatrixWorld(true); v = body.localToWorld(new THREE.Vector3(anchor.cx, mouth ? anchor.eye - 0.15 * anchor.k : anchor.top, mouth ? anchor.front : anchor.cz)); }
    else { const box = new THREE.Box3().setFromObject(model); v = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2); }
    v.project(camera);
    return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H };
  }

  return {
    el,
    load,
    start() { if (running) return; running = true; clock.getDelta(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); },
    stop() { running = false; cancelAnimationFrame(raf); },
    act(name) { // makan / joget / senang / sedih (sekali, lalu balik idle)
      if (sleeping) return;
      wander.target = null;
      holder.rotation.y = 0;
      const map = { eat: 'eat', dance: 'dance', happy: 'gesture-positive', sad: 'gesture-negative', run: 'run' };
      play(map[name] || name, { once: name !== 'run', hold: name === 'eat' ? 0.4 : 0.2 });
    },
    setSleep(v) { if (sleeping === v) return; sleeping = v; applySleep(); },
    setSize(s) { size = s; },
    setOutfit(id) { if (id === outfitId) return; outfitId = id; mountOutfit(); },
    setRug(hex) { rug.material.color.set(hex); rim.material.color.set(hex).offsetHSL(0, 0.05, -0.08); },
    walkTo(clientX, clientY) { // tap lantai → jalan ke situ
      if (sleeping || !model) return false;
      const r = el.getBoundingClientRect(), ndc = new THREE.Vector2(((clientX - r.left) / W) * 2 - 1, -((clientY - r.top) / H) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
      const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return false;
      const d = Math.hypot(p.x, p.z), lim = 1.2; if (d > lim) { p.x *= lim / d; p.z *= lim / d; }
      walkTarget = { x: p.x, z: p.z }; back = 0; return true;
    },
    headPos,
    get anchor() { return anchor && { ...anchor }; },
    hit(clientX, clientY) { // tap kena peliharaan?
      const p = headPos(); if (!p) return false;
      const r = el.getBoundingClientRect();
      return Math.abs(clientX - r.left - p.x) < W * 0.22 && clientY - r.top > p.y - 20 && clientY - r.top < H * 0.92;
    },
  };
}

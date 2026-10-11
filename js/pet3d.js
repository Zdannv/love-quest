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
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.9, 48), new THREE.MeshStandardMaterial({ color: 0xffc7dc, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.receiveShadow = true; scene.add(rug);
  const rim = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.05, 48), new THREE.MeshStandardMaterial({ color: 0xff9fc2, roughness: 1 }));
  rim.rotation.x = -Math.PI / 2; rim.position.y = 0.002; scene.add(rim);

  const holder = new THREE.Group(); scene.add(holder);
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
    mixer = new THREE.AnimationMixer(model);
    actions = {};
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    current = null;
    holder.position.set(0, 0, 0); holder.rotation.set(0, 0, 0);
    if (sleeping) applySleep(); else play('idle', { fade: 0 });
  }
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
        else { p.x += (dx / d) * dt * 0.7; p.z += (dz / d) * dt * 0.7; }
      } else {
        holder.rotation.y += (0 - holder.rotation.y) * Math.min(1, dt * 3); // balik ngadep kamera
        wander.t -= dt;
        if (wander.t <= 0) {
          wander.t = 6 + Math.random() * 6;
          const home = Math.hypot(holder.position.x, holder.position.z) > 0.3;
          wander.target = home ? { x: 0, z: 0 } : { x: (Math.random() - 0.5) * 1.8, z: (Math.random() - 0.3) * 0.9 };
          play('walk');
        }
      }
    }
    renderer.render(scene, camera);
  }

  // posisi kepala di layar (buat naruh aksesoris / gelembung)
  function headPos() {
    if (!model) return null;
    const box = new THREE.Box3().setFromObject(model);
    const v = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2).project(camera);
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
    headPos,
    hit(clientX, clientY) { // tap kena peliharaan?
      const p = headPos(); if (!p) return false;
      const r = el.getBoundingClientRect();
      return Math.abs(clientX - r.left - p.x) < W * 0.22 && clientY - r.top > p.y - 20 && clientY - r.top < H * 0.92;
    },
  };
}

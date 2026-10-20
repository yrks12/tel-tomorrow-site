// Tel Tomorrow city: one house per subscriber, laid out on a spiral of lots around the first road.
// Data: houses.json = {day, subs, updated, claims:[{house, name, day}]}. A house with no claim shows "unclaimed".
(function () {
  const $ = (id) => document.getElementById(id);
  const canvas = $("c");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6ab0ff);
  scene.fog = new THREE.Fog(0x6ab0ff, 120, 420);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 900);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x88aa66, 0.55));
  const sun = new THREE.DirectionalLight(0xfff0d0, 0.6);
  sun.position.set(-60, 90, 50);
  scene.add(sun);

  const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const SEA = mat(0x1a8fe0), SAND = mat(0xffd27f), GRASS = mat(0x3f9a30), ROAD = mat(0x2d2d33), LINE = mat(0xf5f5ee);
  const WALLS = [0xf5efe6, 0xffe9c4, 0xdbe9f7, 0xf8d9d3, 0xe3f2d6].map(mat);
  const ROOFS = [0xcc4030, 0xb5532a, 0x8a3b2c, 0xd9602f].map(mat);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), SEA);
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.6; scene.add(sea);
  const S = 10; // lot size
  const houseGroup = new THREE.Group(); scene.add(houseGroup);
  const lots = []; // lot index -> {x,z}
  // spiral: rows along the main road (z=0), ring after ring
  (function buildLots() {
    const n = 4000, seen = new Set();
    let x = 0, z = 1, dx = 1, dz = 0, leg = 1, run = 0, turns = 0;
    for (let i = 0; i < n; i++) {
      const key = x + "," + z;
      if (!seen.has(key) && z !== 0) { seen.add(key); lots.push({ x: x * S, z: z * S }); }
      x += dx; z += dz; run++;
      if (run === leg) { run = 0; const t = dx; dx = -dz; dz = t; turns++; if (turns % 2 === 0) leg++; }
    }
  })();
  const roadX = new THREE.Mesh(new THREE.BoxGeometry(2000, 0.12, 5), ROAD); roadX.position.y = 0.06; scene.add(roadX);
  for (let i = -200; i < 200; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.4), LINE); d.position.set(i * 6, 0.1, 0); scene.add(d); }

  let ground; // grows with the city
  function setGround(radius) {
    if (ground) scene.remove(ground);
    const g = new THREE.Group();
    const land = new THREE.Mesh(new THREE.BoxGeometry(radius * 2 + 60, 1, radius * 2 + 60), GRASS); land.position.y = -0.5; g.add(land);
    const beach = new THREE.Mesh(new THREE.BoxGeometry(radius * 2 + 100, 0.9, radius * 2 + 100), SAND); beach.position.y = -0.55; g.add(beach);
    land.position.y = -0.45;
    g.children = [beach, land]; ground = g; scene.add(g);
  }

  const houses = []; // meshes, index = lot index
  function addHouse(i, day) {
    const l = lots[i]; if (!l) return;
    const g = new THREE.Group();
    g.position.set(l.x, 0, l.z);
    const w = new THREE.Mesh(new THREE.BoxGeometry(5, 3.4, 5), WALLS[i % WALLS.length]); w.position.y = 1.7;
    const r = new THREE.Mesh(new THREE.ConeGeometry(4.3, 2.4, 4), ROOFS[(i * 7) % ROOFS.length]); r.position.y = 4.6; r.rotation.y = Math.PI / 4;
    const dr = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.12), mat(0x3a5fb0)); dr.position.set(0, 1, l.z > 0 ? -2.55 : 2.55);
    g.add(w, r, dr);
    g.userData = { house: i + 1, day: day || 0 };
    houseGroup.add(g); houses.push(g);
  }

  // palms at the edge for colour
  function palm(x, z) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(.25, .35, 4, 6), mat(0x735029)); t.position.set(x, 2, z);
    const c = new THREE.Mesh(new THREE.ConeGeometry(2, 1.4, 6), mat(0x2f8f32)); c.position.set(x, 4.4, z);
    scene.add(t, c);
  }

  let data = { day: 1, subs: 0, claims: [] };
  function build() {
    houseGroup.clear(); houses.length = 0;
    const n = Math.min(data.subs, lots.length);
    for (let i = 0; i < n; i++) addHouse(i, data.dayOf ? data.dayOf[i] : null);
    const radius = Math.max(40, Math.ceil(Math.sqrt(n)) * S * 0.8 + 30);
    setGround(radius);
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; palm(Math.cos(a) * (radius + 6), Math.sin(a) * (radius + 6)); }
    $("day").textContent = "Day " + data.day;
    $("count").textContent = n;
    const claimBy = {}; (data.claims || []).forEach((c) => (claimBy[c.house] = c));
    const ul = $("list"); ul.innerHTML = "";
    houses.forEach((h) => { const c = claimBy[h.userData.house]; const li = document.createElement("li"); li.textContent = "House " + h.userData.house + ": " + (c ? c.name : "unclaimed"); ul.appendChild(li); });
    window.__claimBy = claimBy;
    controls.target.set(0, 0, 0);
  }

  // ---- camera: orbit (fly over) or street-level walk
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2.05; controls.minDistance = 8; controls.maxDistance = 360;
  camera.position.set(60, 55, 85);
  let mode = "fly", yaw = 0, pitch = 0; const keys = {};
  function setMode(m) {
    mode = m;
    $("walk").textContent = m === "walk" ? "Fly over" : "Walk in";
    controls.enabled = m === "fly";
    if (m === "walk") { camera.position.set(0, 2.2, 8); yaw = Math.PI; pitch = 0; $("hint").textContent = "Drag to look · WASD / arrows or the stick to walk · click a house"; }
    else { camera.position.set(60, 55, 85); camera.up.set(0, 1, 0); controls.target.set(0, 0, 0); controls.update(); $("hint").textContent = "Drag to look around · scroll or pinch to zoom · click a house"; }
  }
  $("walk").onclick = () => setMode(mode === "walk" ? "fly" : "walk");
  addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
  addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));
  let drag = null, moved = 0;
  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; moved = 0; });
  addEventListener("pointerup", () => (drag = null));
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return; moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
    if (mode === "walk") { yaw -= (e.clientX - drag.x) * 0.005; pitch = Math.max(-1, Math.min(1, pitch - (e.clientY - drag.y) * 0.004)); }
    drag = { x: e.clientX, y: e.clientY };
  });
  // touch walking: hold the lower half of the screen to move forward
  let touchFwd = false;
  canvas.addEventListener("touchstart", (e) => { if (mode === "walk" && e.touches[0].clientY > innerHeight * 0.7) touchFwd = true; }, { passive: true });
  addEventListener("touchend", () => (touchFwd = false));

  // ---- picking
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  canvas.addEventListener("click", (e) => {
    if (moved > 6) return;
    mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(houseGroup.children, true)[0];
    if (!hit) { $("panel").style.display = "none"; return; }
    let o = hit.object; while (o.parent && !o.userData.house) o = o.parent;
    const c = (window.__claimBy || {})[o.userData.house];
    $("ptitle").textContent = c ? c.name + "'s house" : "House " + o.userData.house;
    $("pbody").textContent = c
      ? "House " + o.userData.house + " · claimed on Day " + c.day + ". Welcome home!"
      : "House " + o.userData.house + " is unclaimed. Subscribe, then comment your name under the newest Short, and it goes on the door.";
    $("pclaim").textContent = c ? "Visit the channel" : "Claim your house";
    $("panel").style.display = "block";
  });
  $("pclose").onclick = () => ($("panel").style.display = "none");

  function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  addEventListener("resize", resize); resize();
  let last = performance.now();
  (function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (mode === "walk") {
      const f = (keys["w"] || keys["arrowup"] || touchFwd ? 1 : 0) - (keys["s"] || keys["arrowdown"] ? 1 : 0);
      const s = (keys["d"] || keys["arrowright"] ? 1 : 0) - (keys["a"] || keys["arrowleft"] ? 1 : 0);
      const sp = 9 * dt;
      camera.position.x += (-Math.sin(yaw) * f + Math.cos(yaw) * s) * sp;
      camera.position.z += (-Math.cos(yaw) * f - Math.sin(yaw) * s) * sp;
      camera.position.y = 2.2;
      camera.rotation.set(pitch, yaw, 0, "YXZ");
    } else controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  })(last);

  fetch("houses.json?" + Date.now()).then((r) => r.json()).catch(() => ({ day: 1, subs: 9, claims: [] })).then((d) => { data = d; build(); });
})();

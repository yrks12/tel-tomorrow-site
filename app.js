// Tel Tomorrow city: the very same Blender models the Shorts are rendered from (assets/city.glb, exported by tel_scene.py --export-glb),
// one house per subscriber, one named card per resident.
// Data: houses.json = {day, subs, updated, claims:[{house, name, day}], dayOf:[day each house went up]}.
(function () {
  const $ = (id) => document.getElementById(id);
  const canvas = $("c");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;     // Blender's "Standard" view transform: no tone mapping
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const SKY = 0x8db8f0, HORIZON = 0xf3d9b6;           // the render's blue sky with a warm low horizon
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(HORIZON, 160, 520);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 1200);   // 35 mm lens, same as the Shorts

  // the render's sun: warm, low, long side shadows (Blender euler 66,8,118 deg, color 1.0/0.78/0.52)
  scene.add(new THREE.HemisphereLight(0xa9c9f5, 0x6d7f4c, 0.5));
  const sun = new THREE.DirectionalLight(0xffc88a, 1.15);
  (function aim() {
    const r = (d) => (d * Math.PI) / 180, a = r(66), b = r(8), c = r(118);
    let v = [0, 0, -1];
    const rx = (p) => [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)];
    const ry = (p) => [p[0] * Math.cos(b) + p[2] * Math.sin(b), p[1], -p[0] * Math.sin(b) + p[2] * Math.cos(b)];
    const rz = (p) => [p[0] * Math.cos(c) - p[1] * Math.sin(c), p[0] * Math.sin(c) + p[1] * Math.cos(c), p[2]];
    v = rz(ry(rx(v)));                                  // direction the light travels, Blender axes
    sun.userData.dir = new THREE.Vector3(v[0], v[2], -v[1]);   // Blender (x,y,z) -> glTF (x,z,-y)
  })();
  scene.add(sun, sun.target);

  const houses = {};                 // house number -> glTF node
  const houseGroup = new THREE.Group(); scene.add(houseGroup);
  let data = { day: 1, subs: 0, claims: [], dayOf: [] };
  let center = new THREE.Vector3(), radius = 60, roadZ = -12;
  const claimBy = {};

  function nameSprite(text) {
    const cv = document.createElement("canvas"), g = cv.getContext("2d");
    g.font = "bold 84px Anton, Impact, 'Arial Narrow Bold', sans-serif";
    const w = Math.ceil(g.measureText(text.toUpperCase()).width) + 70;
    cv.width = w; cv.height = 150;
    g.font = "bold 84px Anton, Impact, 'Arial Narrow Bold', sans-serif";
    g.fillStyle = "rgba(18,23,36,.92)"; g.beginPath(); g.roundRect ? g.roundRect(0, 10, w, 120, 26) : g.rect(0, 10, w, 120); g.fill();
    g.fillStyle = "#ffd84d"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text.toUpperCase(), w / 2, 72);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
    sp.scale.set(w / 150 * 1.7, 1.7, 1); sp.renderOrder = 10;
    return sp;
  }

  function cardText(h) {
    const c = claimBy[h], day = (data.dayOf && data.dayOf[h - 1]) || data.day;
    if (c) return { title: c.name + "'s house", body: "Hi " + c.name + "! Welcome to Tel Tomorrow. Your house is number " + h + ", it went up on Day " + day + ", and your name is on the door. Walk in any time.", claimed: true, day };
    return { title: "Resident #" + h, body: "Hi Resident #" + h + "! Your house went up on Day " + day + ". Comment your name under the newest Short to claim it, and it goes on the door.", claimed: false, day };
  }

  function showCard(h) {
    const t = cardText(h);
    $("ptitle").textContent = t.title;
    $("pbody").textContent = t.body;
    $("pclaim").textContent = t.claimed ? "Visit the channel" : "Comment your name to claim it";
    $("panel").style.display = "block";
    if (window.__sel) { try { window.__sel.userData.restore(); } catch (e) {} }
    const n = houses[h];
    if (n) {
      const roofs = [];
      n.traverse((o) => { if (o.isMesh && /roof|Cone/i.test(o.name + (o.material && o.material.name))) roofs.push(o); });
      const olds = roofs.map((o) => { const m = o.material; o.material = m.clone(); o.material.emissive = new THREE.Color(0x553300); return m; });
      n.userData.restore = () => roofs.forEach((o, i) => (o.material = olds[i]));
      window.__sel = n;
    }
  }

  function buildList() {
    const ul = $("list"); ul.innerHTML = "";
    const grid = $("rgrid"); if (grid) grid.innerHTML = "";
    for (let h = 1; h <= data.subs; h++) {
      const t = cardText(h);
      const li = document.createElement("li"); li.textContent = "House " + h + ": " + (claimBy[h] ? claimBy[h].name : "unclaimed"); ul.appendChild(li);
      if (grid) {
        const d = document.createElement("button"); d.className = "rcard" + (t.claimed ? " on" : "");
        d.innerHTML = "<b></b><i></i><p></p>";
        d.children[0].textContent = t.title; d.children[1].textContent = "House " + h + " · Day " + t.day; d.children[2].textContent = t.body;
        d.onclick = () => { $("residents").style.display = "none"; focusHouse(h); showCard(h); };
        grid.appendChild(d);
      }
    }
  }

  function focusHouse(h) {
    const n = houses[h]; if (!n) return;
    const p = new THREE.Vector3(); n.getWorldPosition(p);
    setMode("fly");
    controls.target.copy(p);
    camera.position.set(p.x - 12, 9, p.z + 16);
    controls.update();
  }

  function build(gltf) {
    gltf.scene.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      if (o.userData && o.userData.house) houses[o.userData.house] = o;
    });
    scene.add(gltf.scene);
    const pts = Object.values(houses).map((n) => { const v = new THREE.Vector3(); n.getWorldPosition(v); return v; });
    if (pts.length) {
      center.set(pts.reduce((s, p) => s + p.x, 0) / pts.length, 0, pts.reduce((s, p) => s + p.z, 0) / pts.length);
      radius = Math.max(26, Math.max(...pts.map((p) => Math.hypot(p.x - center.x, p.z - center.z))) * 1.1 + 22);
    }
    sun.position.copy(center).addScaledVector(sun.userData.dir, -160);
    sun.target.position.copy(center);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sh = Math.max(60, radius * 1.4);
    Object.assign(sun.shadow.camera, { left: -sh, right: sh, top: sh, bottom: -sh, near: 1, far: 400 });
    sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0005;
    (data.claims || []).slice(0, 40).forEach((c) => {
      const n = houses[c.house]; if (!n) return;
      const sp = nameSprite(c.name); sp.position.set(0, 8.4, 0); n.add(sp);
    });
    setMode("fly");
    $("day").textContent = "Day " + data.day;
    $("count").textContent = data.subs;
    buildList();
  }

  // ---- camera: orbit (fly over) or street-level walk
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2.05; controls.minDistance = 6; controls.maxDistance = 420;
  let mode = "fly", yaw = 0, pitch = 0; const keys = {};
  function setMode(m) {
    mode = m;
    $("walk").textContent = m === "walk" ? "Fly over" : "Walk in";
    controls.enabled = m === "fly";
    if (m === "walk") { camera.position.set(center.x, 2.2, roadZ + 18); yaw = 0; pitch = 0; $("hint").textContent = "Drag to look · WASD / arrows or the stick to walk · click a house"; }
    else {
      camera.up.set(0, 1, 0);
      camera.position.set(center.x + radius * 1.25, 18 + radius * 0.5, center.z - radius * 0.75);
      controls.target.copy(center); controls.update();
      $("hint").textContent = "Drag to look around · scroll or pinch to zoom · click a house";
    }
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
  let touchFwd = false;
  canvas.addEventListener("touchstart", (e) => { if (mode === "walk" && e.touches[0].clientY > innerHeight * 0.7) touchFwd = true; }, { passive: true });
  addEventListener("touchend", () => (touchFwd = false));

  // ---- picking
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  canvas.addEventListener("click", (e) => {
    if (moved > 6) return;
    mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(Object.values(houses), true)[0];
    if (!hit) { $("panel").style.display = "none"; return; }
    let o = hit.object; while (o.parent && !(o.userData && o.userData.house)) o = o.parent;
    showCard(o.userData.house);
  });
  $("pclose").onclick = () => ($("panel").style.display = "none");
  if ($("rbtn")) { $("rbtn").onclick = () => ($("residents").style.display = "block"); $("rclose").onclick = () => ($("residents").style.display = "none"); }

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

  fetch("houses.json?" + Date.now()).then((r) => r.json()).catch(() => ({ day: 1, subs: 9, claims: [] })).then((d) => {
    data = d; (d.claims || []).forEach((c) => (claimBy[c.house] = c));
    new THREE.GLTFLoader().load("assets/city.glb?d=" + d.day + "-" + d.subs, build, undefined, (e) => { $("hint").textContent = "The city could not load. Reload the page."; console.error(e); });
  });
})();

// Tel Tomorrow city: the very same Blender models the Shorts are rendered from (assets/city.glb, exported by tel_scene.py --export-glb),
// one house per subscriber, one named card per resident.
// Data: houses.json = {day, subs, updated, claims:[{house, name, day}], dayOf:[day each house went up]}.
(function () {
  const $ = (id) => document.getElementById(id);
  const T = Object.assign({ brand: "Tel Tomorrow", thing: "house", who: "Resident", data: "houses.json", glb: "assets/city-finished.glb", sky: 0x998578, horizon: 0xb19a80,
    liveSlots: true, exposure: .65, gltfLightScale: .002, fly: {position:[100,85,100],target:[12,14,-22],lens:48,speed:.08}, fog:{color:0xb19a80,near:450,far:1400},
    verb: "tap", walk: {x:57,y:3,z:10,yaw:.78,pitch:.08}, sunEuler: [76, -15, -145], sunColor: 0xffa859, sunInt: 0, hemiSky: 0xb8a999, hemiGround: 0x35432c, hemiInt:.65, slots: 0, empty: "" }, window.TT ? Object.assign({liveSlots:false, fly:null, fog:null, exposure:null, gltfLightScale:null}, window.TT) : {});
  const canvas = $("c");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;     // Blender's "Standard" view transform: no tone mapping
  if (T.exposure != null) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = T.exposure; }
  if (T.physicalLights) renderer.physicallyCorrectLights = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const SKY = T.sky, HORIZON = T.horizon;           // the render's blue sky with a warm low horizon
  scene.background = new THREE.Color(SKY);
  if (T.skyGradient) {
    const skyCanvas = document.createElement('canvas'); skyCanvas.width=2; skyCanvas.height=512;
    const ctx=skyCanvas.getContext('2d'), gradient=ctx.createLinearGradient(0,0,0,180);
    T.skyGradient.forEach((color,i)=>gradient.addColorStop(i/(T.skyGradient.length-1),color));
    ctx.fillStyle=gradient; ctx.fillRect(0,0,2,512);
    const texture=new THREE.CanvasTexture(skyCanvas); texture.encoding=THREE.sRGBEncoding;
    scene.background=texture;
  }
  scene.fog = new THREE.Fog(T.fog ? T.fog.color : HORIZON, T.fog ? T.fog.near : 160, T.fog ? T.fog.far : 520);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 1200);   // 35 mm lens, same as the Shorts

  // the render's sun: warm, low, long side shadows (Blender euler 66,8,118 deg, color 1.0/0.78/0.52)
  scene.add(new THREE.HemisphereLight(T.hemiSky, T.hemiGround, T.hemiInt == null ? 0.5 : T.hemiInt));
  const sun = new THREE.DirectionalLight(T.sunColor, T.sunInt);
  (function aim() {
    const r = (d) => (d * Math.PI) / 180, a = r(T.sunEuler[0]), b = r(T.sunEuler[1]), c = r(T.sunEuler[2]);
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

  const labels = [];
  function nameSprite(text) {
    const cv = document.createElement("canvas"), g = cv.getContext("2d");
    g.font = "bold 84px Anton, Impact, 'Arial Narrow Bold', sans-serif";
    const w = Math.ceil(g.measureText(text.toUpperCase()).width) + 70;
    cv.width = w; cv.height = 150;
    g.font = "bold 84px Anton, Impact, 'Arial Narrow Bold', sans-serif";
    g.fillStyle = "rgba(18,23,36,.92)"; g.beginPath(); g.roundRect ? g.roundRect(0, 10, w, 120, 26) : g.rect(0, 10, w, 120); g.fill();
    g.fillStyle = "#ffd84d"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text.toUpperCase(), w / 2, 72);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true, toneMapped: false }));
    sp.scale.set(w / 150 * 1.7, 1.7, 1); sp.renderOrder = 10;
    sp.userData.aspect = w / 150;
    return sp;
  }

  function cardText(h) {
    const c = claimBy[h], day = (data.dayOf && data.dayOf[h - 1]) || (c && c.day) || data.day;
    if (c) return { title: c.name + "'s " + T.thing, body: "Hi " + c.name + "! Welcome to " + T.brand + ". Your " + T.thing + " is number " + h + ", it went up on Day " + day + ", and your name is on it. Come by any time.", claimed: true, day };
    if (h > data.subs && T.empty) return { title: T.who + " #" + h, body: T.empty.replace("#N", "#" + h), claimed: false, day: data.day };
    return { title: T.who + " #" + h, body: "Hi " + T.who + " #" + h + "! Welcome to " + T.brand + ". Your " + T.thing + " is number " + h + ", it went up on Day " + day + ". Comment your name under the newest Short to claim it, and it goes on it.", claimed: false, day };
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
    const order = Array.from({length: T.liveSlots ? data.subs : Math.max(data.subs, T.slots)}, (_,i) => i+1);
    order.sort((a,b) => Number(!!claimBy[b])-Number(!!claimBy[a]) || a-b);
    for (const h of order) {
      const t = cardText(h);
      const li = document.createElement("li"); li.textContent = T.thing[0].toUpperCase() + T.thing.slice(1) + " " + h + ": " + (claimBy[h] ? claimBy[h].name : "unclaimed"); ul.appendChild(li);
      if (grid) {
        const d = document.createElement("button"); d.className = "rcard" + (t.claimed ? " on" : "");
        d.innerHTML = "<b></b><i></i><p></p>";
        d.children[0].textContent = t.title; d.children[1].textContent = T.thing[0].toUpperCase() + T.thing.slice(1) + " " + h + " · Day " + t.day; d.children[2].textContent = t.body;
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
    camera.position.set(p.x - 12, T.staticEnd ? p.y + 9 : 9, p.z + 16);
    controls.update();
  }

  function build(gltf) {
    // Opt-in static end frame and slot names for clone exports without house extras.
    if (T.staticEnd && gltf.animations.length) {
      const mixer = new THREE.AnimationMixer(gltf.scene);
      gltf.animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
      });
      mixer.update(Math.max(...gltf.animations.map((clip) => clip.duration)));
    }
    (T.slotNodes || []).forEach((name, i) => {
      const node = gltf.scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
      if (node) {
        node.userData.house = i + 1;
        if (node.userData.pickSize) {
          const proxy = new THREE.Mesh(new THREE.BoxGeometry(...node.userData.pickSize), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
          proxy.userData.slotProxy = true;
          node.add(proxy);
        }
      }
    });
    (T.pointLights || []).forEach((cfg) => {
      const light = new THREE.PointLight(cfg.color, cfg.intensity, cfg.distance);
      light.position.fromArray(cfg.position); scene.add(light);
    });
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (o.isLight && T.gltfLightScale != null) o.intensity *= T.gltfLightScale;
      if (o.isMesh) { o.castShadow = !o.userData.slotProxy; o.receiveShadow = !o.userData.slotProxy; }
      if (o.userData && o.userData.house) houses[o.userData.house] = o;
    });
    if (T.liveSlots) Object.entries(houses).forEach(([h,n]) => { n.visible = Number(h) <= data.subs; });
    if (T.liveSlots) {
      const materials = new Set();
      let treeIndex = 0;
      gltf.scene.traverse(o => {
        if (T.thing === "house" && /garden (tree|clusters)/.test(o.name)) {
          const p = o.getWorldPosition(new THREE.Vector3());
          const nearHome = Object.values(houses).some(n => n.visible && n.position.distanceTo(p) < 10);
          o.visible = nearHome && treeIndex++ % 3 === 0;
        }
        if (T.thing === "house" && /garden|civic grove|plaza trees/.test(o.name)) {
          const p=o.getWorldPosition(new THREE.Vector3());
          if (Math.hypot(p.x-T.walk.x,p.z-T.walk.z)<25) o.visible=false;
        }
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => {
          if (materials.has(m)) return;
          materials.add(m);
          if (T.thing === "house" && /foliage/.test(m.name)) m.color.lerp(new THREE.Color(0xa5b66a), .28);
          if (/deep teal sea/.test(m.name)) { m.roughness = .62; m.metalness = 0; }
          if (/warm windows/.test(m.name)) { m.emissive.setRGB(1,.32,.075); m.emissiveIntensity = 1.6; }
          if (T.thing === "pen" && /fountain turquoise/.test(m.name)) m.emissiveIntensity = .35;
        });
        // The enormous ground/sea mesh must receive shadows, never cast them.
        if (mats.some(m => /sage lawns|deep teal sea/.test(m.name))) o.castShadow = false;
      });
    }
    if (T.windowEmission) {
      const seen=new Set();
      gltf.scene.traverse(o=>{
        if (!o.isMesh) return;
        (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{
          if (seen.has(m) || !/warm windows/.test(m.name)) return;
          seen.add(m); m.emissive.fromArray(T.windowEmission.color);
          m.emissiveIntensity=T.windowEmission.intensity;
        });
      });
    }
    if (T.windowSpill) {
      const cfg=T.windowSpill, cv=document.createElement('canvas'); cv.width=cv.height=64;
      const ctx=cv.getContext('2d'), gradient=ctx.createRadialGradient(32,32,0,32,32,32);
      gradient.addColorStop(0,'rgba(255,255,255,.8)'); gradient.addColorStop(.3,'rgba(255,255,255,.4)'); gradient.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=gradient; ctx.fillRect(0,0,64,64);
      const mat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),color:cfg.color,transparent:true,opacity:cfg.opacity,blending:THREE.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
      const geometry=new THREE.PlaneGeometry(cfg.size,cfg.size);
      if (cfg.haloSize) {
        const haloMat=new THREE.PointsMaterial({map:mat.map,color:cfg.color,size:cfg.haloSize,transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false});
        // Bias halo depth toward the camera so a wall cannot slice its soft
        // disc diagonally; keep depth testing against other buildings.
        haloMat.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n gl_Position = projectionMatrix * vec4(mvPosition.xyz + vec3(0.0,0.0,1.4),1.0);');};
        const sources=[];
        gltf.scene.traverse(o=>{if(o.isMesh && !Array.isArray(o.material) && /warm windows/.test(o.material.name)) sources.push(o);});
        sources.forEach(o=>{
          const g=o.geometry, index=g.index, pos=g.attributes.position, points=[];
          // The exported window rectangles use two triangles each. A small soft
          // halo at each rectangle gives emission a visible edge without a pass.
          for(let i=0;i<(index?index.count:pos.count);i+=6) {
            const center=new THREE.Vector3(), normal=new THREE.Vector3(); let count=0;
            for(let j=i;j<Math.min(i+6,index?index.count:pos.count);j++) {
              const vertex=index?index.getX(j):j;
              center.add(new THREE.Vector3().fromBufferAttribute(pos,vertex));
              if(g.attributes.normal) normal.add(new THREE.Vector3().fromBufferAttribute(g.attributes.normal,vertex)); count++;
            }
            center.divideScalar(count).addScaledVector(normal.normalize(),.12); points.push(center.x,center.y,center.z);
          }
          const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
          const halo=new THREE.Points(geometry,haloMat); halo.name='window halo'; o.add(halo);
        });
      }
      Object.values(houses).forEach(n=>{
        // Parent the spill to its house so unoccupied slots never emit light.
        const spill=new THREE.Mesh(geometry,mat); spill.name='window light spill';
        const box=new THREE.Box3().setFromObject(n), p=box.getCenter(new THREE.Vector3());
        p.y=.12; spill.position.copy(n.worldToLocal(p));
        spill.quaternion.copy(n.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2));
        n.add(spill);
      });
    }
    scene.add(gltf.scene);
    window.__TT = {scene, houses, camera, data, ready:true};
    const pts = Object.values(houses).filter(n => !T.liveSlots || n.visible).map((n) => { const v = new THREE.Vector3(); n.getWorldPosition(v); return v; });
    if (pts.length) {
      center.set(pts.reduce((s, p) => s + p.x, 0) / pts.length, 0, pts.reduce((s, p) => s + p.z, 0) / pts.length);
      radius = Math.max(26, Math.max(...pts.map((p) => Math.hypot(p.x - center.x, p.z - center.z))) * 1.1 + 22);
    }
    sun.position.copy(center).addScaledVector(sun.userData.dir, -160);
    sun.target.position.copy(center);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sh = T.liveSlots ? Math.max(50, radius * .85) : Math.max(60, radius * 1.4);
    Object.assign(sun.shadow.camera, { left: -sh, right: sh, top: sh, bottom: -sh, near: 1, far: 400 });
    sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = T.shadowBias == null ? -0.0005 : T.shadowBias;
    if (T.liveSlots) { sun.shadow.mapSize.set(4096,4096); sun.shadow.normalBias=.6; }
    if (T.shadowNormalBias != null) sun.shadow.normalBias=T.shadowNormalBias;
    if (T.liveSlots) gltf.scene.traverse(o => {
      if (o.isDirectionalLight) {
        o.castShadow=true; o.shadow.mapSize.set(4096,4096);
        // Exported directional lights sit at the origin; move along their original
        // direction so the shadow frustum covers the scene without changing light.
        const direction = o.getWorldDirection(new THREE.Vector3());
        const position = center.clone().addScaledVector(direction,160);
        o.position.copy(o.parent.worldToLocal(position));
        o.target.position.copy(center); scene.add(o.target);
        Object.assign(o.shadow.camera,{left:-sh,right:sh,top:sh,bottom:-sh,near:1,far:450});
        o.shadow.camera.updateProjectionMatrix();o.shadow.bias=-.0008;o.shadow.normalBias=.65;
      }
    });
    (data.claims || []).filter(c => c.house <= data.subs).forEach((c) => {
      const n = houses[c.house]; if (!n) return;
      const sp = nameSprite(c.name); sp.position.set(0, T.thing === "pen" ? 5 : 8.4, 0); n.add(sp);
      if (T.liveSlots) labels.push({sp, number:false});
    });
    if (T.liveSlots && T.thing === "pen") {
      Object.entries(houses).forEach(([h,n]) => {
        if (+h > Math.max(24,data.subs)) return;
        const sp = nameSprite(String(h));
        const p = n.getWorldPosition(new THREE.Vector3());
        sp.position.copy(p).add(new THREE.Vector3(0,2.8,1.8));
        sp.userData.penNumber = +h;
        sp.userData.anchor = sp.position.clone();
        if (!n.visible) sp.material.color.setHex(0xa0c2c8);
        scene.add(sp); labels.push({sp,number:true,empty:!n.visible});
      });
    }
    setMode("fly");
    $("day").textContent = "Day " + data.day;
    $("count").textContent = data.subs;
    buildList();
  }

  // ---- camera: orbit (fly over) or street-level walk
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.autoRotate = !!(T.fly && T.fly.speed);
  controls.autoRotateSpeed = T.fly && T.fly.speed || 0;
  controls.addEventListener("start", () => { controls.autoRotate = false; }); controls.maxPolarAngle = Math.PI / 2.05; controls.minDistance = 6; controls.maxDistance = 420;
  let mode = "fly", yaw = 0, pitch = 0; const keys = {};
  function walkStart() {
    if (T.walk) { camera.position.set(T.walk.x, T.walk.y == null ? 2.2 : T.walk.y, T.walk.z); yaw = T.walk.yaw; pitch = T.walk.pitch; return; }   // stand in front of the first house (the nearest claimed one if any), facing it, so a wall never fills the screen
    const h = houses[(data.claims && data.claims[0] && data.claims[0].house) || 1] || Object.values(houses)[0];
    if (!h) { camera.position.set(center.x, 2.2, roadZ + 18); yaw = 0; pitch = 0; return; }
    const p = new THREE.Vector3(); h.getWorldPosition(p);
    let dx = p.x - center.x, dz = p.z - center.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    if (l < 1) { dx = 0; dz = 1; }
    camera.position.set(p.x + dx * 26, 2.2, p.z + dz * 26);
    yaw = Math.atan2(dx, dz); pitch = 0.12;
  }
  function setMode(m) {
    mode = m;
    $("walk").textContent = m === "walk" ? "Fly over" : "Walk in";
    controls.enabled = m === "fly";
    if (m === "walk") { walkStart(); $("hint").textContent = "Drag to look · WASD / arrows or the stick to walk · " + T.verb + " a " + T.thing; }
    else {
      camera.up.set(0, 1, 0);
      camera.position.set(center.x + radius * 1.25, 18 + radius * 0.5, center.z - radius * 0.75);
      controls.target.copy(center);
      if (T.fly) { camera.position.fromArray(T.fly.position); controls.target.fromArray(T.fly.target); }
      controls.update();
      $("hint").textContent = "Drag to look around · scroll or pinch to zoom · " + T.verb + " a " + T.thing;
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
    const hit = ray.intersectObjects(Object.values(houses).filter(n => n.visible), true)[0];
    if (!hit) { $("panel").style.display = "none"; return; }
    let o = hit.object; while (o.parent && !(o.userData && o.userData.house)) o = o.parent;
    showCard(o.userData.house);
  });
  $("pclose").onclick = () => ($("panel").style.display = "none");
  if ($("rbtn")) { $("rbtn").onclick = () => ($("residents").style.display = "block"); $("rclose").onclick = () => ($("residents").style.display = "none"); }

  function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; if (T.fly && T.fly.lens) camera.fov = 2 * Math.atan(18 / (camera.aspect>1 && T.fly.desktopLens ? T.fly.desktopLens : T.fly.lens) / (T.liveSlots ? Math.min(camera.aspect,.72) : camera.aspect)) * 180 / Math.PI; camera.updateProjectionMatrix(); }
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
      camera.position.y = T.walk && T.walk.y != null ? T.walk.y : 2.2;
      camera.rotation.set(pitch, yaw, 0, "YXZ");
    } else controls.update();
    if (T.liveSlots && labels.length) {
      camera.updateMatrixWorld();
      const occupied = [];
      const ordered = labels.slice().sort((a,b) => (mode === "walk" ? Number(a.number)-Number(b.number) : Number(b.number)-Number(a.number)) || camera.position.distanceTo(a.sp.getWorldPosition(new THREE.Vector3()))-camera.position.distanceTo(b.sp.getWorldPosition(new THREE.Vector3())));
      let named = 0;
      ordered.forEach(({sp,number,empty}) => {
        const p = number ? sp.userData.anchor.clone() : sp.getWorldPosition(new THREE.Vector3());
        const projected = p.clone().project(camera);
        const depth = -p.clone().applyMatrix4(camera.matrixWorldInverse).z;
        const height = number ? 18 : (named === 0 ? 32 : 26);
        const width = height * sp.userData.aspect;
        let x = (projected.x+1)*innerWidth/2, y=(1-projected.y)*innerHeight/2;
        if (number) {
          const baseY=y;
          for (const dy of [0,-18,18,-36,36]) {
            y=baseY+dy;
            if (!occupied.some(b => x-width/2-3<b.r && x+width/2+3>b.l && y-height/2-3<b.b && y+height/2+3>b.t)) break;
          }
          sp.position.copy(new THREE.Vector3(x/innerWidth*2-1,1-y/innerHeight*2,projected.z).unproject(camera));
        }
        const box = {l:x-width/2-3,r:x+width/2+3,t:y-height/2-3,b:y+height/2+3};
        sp.visible = depth>0 && projected.z<1 && x>width/2 && x<innerWidth-width/2 && y>145 && y<innerHeight-205 && (number || mode==="walk");
        if (sp.visible && occupied.some(b => box.l<b.r && box.r>b.l && box.t<b.b && box.b>b.t)) sp.visible=false;
        if (sp.visible) {
          occupied.push(box); if (!number) named++;
          const size=2*depth*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*height/innerHeight;
          const scale = sp.parent.getWorldScale(new THREE.Vector3());
          sp.scale.set(size*sp.userData.aspect/scale.x,size/scale.y,1);
        }
      });
    }
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  })(last);

  fetch(T.data + "?" + Date.now()).then((r) => r.json()).catch(() => ({ day: 1, subs: 9, claims: [] })).then((d) => {
    data = d; (d.claims || []).filter(c => c.house <= d.subs).forEach((c) => (claimBy[c.house] = c));
    new THREE.GLTFLoader().load(T.glb + "?d=" + d.day + "-" + d.subs, build, undefined, (e) => { $("hint").textContent = "The city could not load. Reload the page."; console.error(e); });
  });
})();

const canvas = document.querySelector("#scene");
const appRoot = document.querySelector("#app");
const modeLabel = document.querySelector("#modeLabel");
const timeLabel = document.querySelector("#timeLabel");
const scoreLabel = document.querySelector("#scoreLabel");
const shotsLabel = document.querySelector("#shotsLabel");
const hitsLabel = document.querySelector("#hitsLabel");
const accLabel = document.querySelector("#accLabel");
const sensLabel = document.querySelector("#sensLabel");
const sensRange = document.querySelector("#sensRange");
const sensValue = document.querySelector("#sensValue");
const dpiInput = document.querySelector("#dpiInput");
const edpiValue = document.querySelector("#edpiValue");
const playBtn = document.querySelector("#playBtn");
const menu = document.querySelector("#menu");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#0d0f12");

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 1.6, 6);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const ambient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(3, 8, 4);
scene.add(dirLight);

const floorGeo = new THREE.PlaneGeometry(200, 200);
const floorMat = new THREE.MeshStandardMaterial({ color: "#1c2026", roughness: 0.9 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const wallMat = new THREE.MeshStandardMaterial({ color: "#15181d", roughness: 0.7 });
const backWall = new THREE.Mesh(new THREE.PlaneGeometry(200, 40), wallMat);
backWall.position.set(0, 20, -40);
scene.add(backWall);

const targetMat = new THREE.MeshStandardMaterial({ color: "#e95f4f" });
const targetGeo = new THREE.SphereGeometry(0.35, 18, 18);

const raycaster = new THREE.Raycaster();
const targets = [];

const keys = new Set();
let pointerLocked = false;
let yaw = 0;
let pitch = 0;
let menuOpen = true;

const state = {
  score: 0,
  shots: 0,
  hits: 0,
  timeLeft: 0,
  targetCount: 3,
  currentSens: 0.35,
  userSens: 0.35
};

function updateHud() {
  modeLabel.textContent = "自由練習";
  timeLabel.textContent = formatTime(state.timeLeft);
  scoreLabel.textContent = String(state.score);
  shotsLabel.textContent = String(state.shots);
  hitsLabel.textContent = String(state.hits);
  accLabel.textContent = state.shots > 0 ? `${Math.round((state.hits / state.shots) * 100)}%` : "0%";
  sensLabel.textContent = state.currentSens.toFixed(2);
}

function formatTime(time) {
  const clamped = Math.max(0, time);
  const min = Math.floor(clamped / 60);
  const sec = Math.floor(clamped % 60);
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function setSensitivity(value) {
  state.currentSens = value;
  sensLabel.textContent = value.toFixed(2);
}

function setUserSensitivity(value) {
  state.userSens = value;
  sensRange.value = value.toFixed(2);
  sensValue.textContent = value.toFixed(2);
  setSensitivity(value);
  updateEdpi();
}

function updateEdpi() {
  const dpi = Number(dpiInput.value) || 0;
  const edpi = dpi * state.userSens;
  edpiValue.textContent = edpi.toFixed(0);
}

function lockPointer() {
  if (!pointerLocked) {
    canvas.requestPointerLock();
  }
}

function unlockPointer() {
  if (pointerLocked) {
    document.exitPointerLock();
  }
}

function openMenu() {
  menu.style.display = "flex";
  menuOpen = true;
  appRoot.classList.add("menu-open");
}

function closeMenu() {
  menu.style.display = "none";
  menuOpen = false;
  appRoot.classList.remove("menu-open");
}

function resetStats() {
  state.score = 0;
  state.shots = 0;
  state.hits = 0;
}

function clearTargets() {
  while (targets.length) {
    const t = targets.pop();
    scene.remove(t.mesh);
  }
}

function spawnTarget() {
  const angle = THREE.MathUtils.degToRad(THREE.MathUtils.randFloat(-40, 40));
  const distance = THREE.MathUtils.randFloat(6, 14);
  const height = THREE.MathUtils.randFloat(1.1, 3.2);
  const x = Math.sin(angle) * distance;
  const z = Math.cos(angle) * -distance;

  const mesh = new THREE.Mesh(targetGeo, targetMat.clone());
  mesh.position.set(x, height, z);
  scene.add(mesh);
  targets.push({ mesh, hit: false });
}

function ensureTargets() {
  while (targets.length < state.targetCount) {
    spawnTarget();
  }
}

function shoot() {
  if (!pointerLocked) return;
  state.shots += 1;
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const hit = raycaster.intersectObjects(targets.map((t) => t.mesh));
  if (hit.length > 0) {
    const mesh = hit[0].object;
    const target = targets.find((t) => t.mesh === mesh);
    if (target && !target.hit) {
      target.hit = true;
      state.hits += 1;
      state.score += 100;
      scene.remove(mesh);
      targets.splice(targets.indexOf(target), 1);
      ensureTargets();
    }
  }
  updateHud();
}

function startFree() {
  resetStats();
  clearTargets();
  ensureTargets();
  setSensitivity(state.userSens);
  closeMenu();
  updateHud();
  lockPointer();
}

function update(dt) {
  if (pointerLocked) {
    const speed = 4;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const move = new THREE.Vector3();

    if (keys.has("KeyW")) move.add(forward);
    if (keys.has("KeyS")) move.sub(forward);
    if (keys.has("KeyA")) move.sub(right);
    if (keys.has("KeyD")) move.add(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt);
      camera.position.add(move);
    }
  }

  updateHud();
}

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  update(dt);
  renderer.render(scene, camera);
}

let lastFrameTime = performance.now();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "Escape") {
    unlockPointer();
    openMenu();
  }
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
});

window.addEventListener("mousedown", (e) => {
  if (menuOpen) return;
  if (e.button === 0) {
    if (!pointerLocked) {
      lockPointer();
      return;
    }
    shoot();
  }
});

window.addEventListener("mousemove", (e) => {
  if (!pointerLocked) return;
  const sensScale = state.currentSens * 0.002;
  yaw -= e.movementX * sensScale;
  pitch -= e.movementY * sensScale;
  pitch = THREE.MathUtils.clamp(pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
  camera.rotation.set(pitch, yaw, 0, "YXZ");
});

document.addEventListener("click", () => {
  if (menuOpen) return;
  if (!pointerLocked) lockPointer();
});

document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (pointerLocked) {
    closeMenu();
  } else {
    openMenu();
  }
});

sensRange.addEventListener("input", (e) => {
  const value = Number(e.target.value);
  setUserSensitivity(value);
});

dpiInput.addEventListener("input", () => {
  updateEdpi();
});

playBtn.addEventListener("click", () => {
  startFree();
});

setUserSensitivity(0.35);
updateEdpi();
updateHud();
ensureTargets();
animate();
openMenu();

menu.addEventListener("mousedown", (e) => {
  e.stopPropagation();
});

menu.addEventListener("click", (e) => {
  e.stopPropagation();
});

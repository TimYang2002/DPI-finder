import * as THREE from "three";
import "./style.css";

const canvas = document.querySelector("#scene");
const appRoot = document.querySelector("#app");
const modeLabel = document.querySelector("#modeLabel");
const timeLabel = document.querySelector("#timeLabel");
const scoreLabel = document.querySelector("#scoreLabel");
const drillLabel = document.querySelector("#drillLabel");
const shotsLabel = document.querySelector("#shotsLabel");
const hitsLabel = document.querySelector("#hitsLabel");
const accLabel = document.querySelector("#accLabel");
const sensLabel = document.querySelector("#sensLabel");
const sensRange = document.querySelector("#sensRange");
const sensValue = document.querySelector("#sensValue");
const playBtn = document.querySelector("#playBtn");
const calibrateBtn = document.querySelector("#calibrateBtn");
const quickBtn = document.querySelector("#quickBtn");
const precisionBtn = document.querySelector("#precisionBtn");
const drillSelect = document.querySelector("#drillSelect");
const calibrationHint = document.querySelector("#calibrationHint");
const menu = document.querySelector("#menu");
const resultSection = document.querySelector("#resultSection");
const recommendLabel = document.querySelector("#recommendLabel");
const recommendDetail = document.querySelector("#recommendDetail");
const tableSection = document.querySelector("#tableSection");
const resultsTable = document.querySelector("#resultsTable");
const savePresetBtn = document.querySelector("#savePresetBtn");
const presetStatus = document.querySelector("#presetStatus");
const shareCodeInput = document.querySelector("#shareCodeInput");
const makeShareBtn = document.querySelector("#makeShareBtn");
const applyShareBtn = document.querySelector("#applyShareBtn");

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
let lastMouseDX = 0;
let menuOpen = true;

const state = {
  mode: "free",
  score: 0,
  shots: 0,
  hits: 0,
  timeLeft: 0,
  drillDuration: 20,
  targetCount: 3,
  currentSens: 0.35,
  calibration: null,
  currentDrill: "mix",
  spawnCounter: 0,
  lastRecommendation: null
};

const calibrationModes = {
  standard: { label: "標準", stages: 7, duration: 20, targetCount: 3 },
  quick: { label: "快速", stages: 5, duration: 12, targetCount: 3 },
  precision: { label: "精準", stages: 9, duration: 25, targetCount: 4 }
};

const drillProfiles = {
  tap: {
    label: "微調點射",
    size: 0.75,
    distance: [5, 10],
    angle: [-20, 20],
    height: [1.2, 2.4],
    speed: 0,
    life: 6,
    color: "#f0a24a"
  },
  flick: {
    label: "快速甩槍",
    size: 0.6,
    distance: [8, 16],
    angle: [-55, 55],
    height: [1.1, 3.1],
    speed: 0,
    life: 3.2,
    color: "#e95f4f"
  },
  strafe: {
    label: "橫向追槍",
    size: 0.85,
    distance: [7, 13],
    angle: [-35, 35],
    height: [1.0, 2.6],
    speed: 1.2,
    life: 7,
    color: "#4ab9a7"
  }
};

function updateHud() {
  modeLabel.textContent = state.mode === "free" ? "自由練習" : "校準中";
  drillLabel.textContent =
    state.mode === "calibration" ? "校準混合" : drillProfiles[state.currentDrill]?.label ?? "混合";
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
  sensRange.value = value.toFixed(2);
  sensValue.textContent = value.toFixed(2);
  sensLabel.textContent = value.toFixed(2);
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
  state.spawnCounter = 0;
}

function clearTargets() {
  while (targets.length) {
    const t = targets.pop();
    scene.remove(t.mesh);
  }
}

function pickDrillProfile() {
  if (state.mode === "calibration") {
    const cycle = ["flick", "tap", "strafe"];
    const pick = cycle[state.spawnCounter % cycle.length];
    return drillProfiles[pick];
  }

  if (state.currentDrill === "mix") {
    const picks = ["flick", "tap", "strafe"];
    const pick = picks[Math.floor(Math.random() * picks.length)];
    return drillProfiles[pick];
  }

  return drillProfiles[state.currentDrill];
}

function spawnTarget() {
  const profile = pickDrillProfile();
  const angle = THREE.MathUtils.degToRad(
    THREE.MathUtils.randFloat(profile.angle[0], profile.angle[1])
  );
  const distance = THREE.MathUtils.randFloat(profile.distance[0], profile.distance[1]);
  const height = THREE.MathUtils.randFloat(profile.height[0], profile.height[1]);
  const x = Math.sin(angle) * distance;
  const z = Math.cos(angle) * -distance;

  const mesh = new THREE.Mesh(targetGeo, targetMat.clone());
  mesh.material.color.set(profile.color);
  mesh.scale.setScalar(profile.size);
  mesh.position.set(x, height, z);
  mesh.userData.spawnTime = performance.now();
  mesh.userData.profile = profile;
  mesh.userData.life = profile.life;
  mesh.userData.velocity = new THREE.Vector3();
  if (profile.speed > 0) {
    mesh.userData.velocity.set(profile.speed * (Math.random() > 0.5 ? 1 : -1), 0, 0);
    mesh.userData.centerX = x;
    mesh.userData.rangeX = 2.2;
  }
  scene.add(mesh);
  targets.push({ mesh, spawnTime: mesh.userData.spawnTime, hit: false });
  state.spawnCounter += 1;
}

function ensureTargets() {
  while (targets.length < state.targetCount) {
    spawnTarget();
  }
}

function updateTargets(dt) {
  const now = performance.now();
  for (let i = targets.length - 1; i >= 0; i -= 1) {
    const target = targets[i];
    const { mesh } = target;
    const profile = mesh.userData.profile;
    if (profile.speed > 0) {
      mesh.position.addScaledVector(mesh.userData.velocity, dt);
      const offset = mesh.position.x - mesh.userData.centerX;
      if (Math.abs(offset) > mesh.userData.rangeX) {
        mesh.userData.velocity.x *= -1;
      }
    }

    if (profile.life && now - mesh.userData.spawnTime > profile.life * 1000) {
      scene.remove(mesh);
      targets.splice(i, 1);
      ensureTargets();
    }
  }
}

const metrics = {
  totalReaction: 0,
  totalTtk: 0,
  totalAngleError: 0,
  overshoot: 0,
  undershoot: 0,
  samples: 0,
  hitSamples: 0
};

function resetMetrics() {
  metrics.totalReaction = 0;
  metrics.totalTtk = 0;
  metrics.totalAngleError = 0;
  metrics.overshoot = 0;
  metrics.undershoot = 0;
  metrics.samples = 0;
  metrics.hitSamples = 0;
}

function recordShotMetrics(target, hit) {
  const now = performance.now();
  const reaction = hit ? (now - target.spawnTime) / 1000 : null;

  const targetPos = target.mesh.position.clone();
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  const toTarget = targetPos.clone().sub(camera.position).normalize();
  const angle = THREE.MathUtils.radToDeg(camDir.angleTo(toTarget));

  const local = targetPos.clone();
  camera.worldToLocal(local);
  const horizontalAngle = THREE.MathUtils.radToDeg(Math.atan2(local.x, local.z));
  const angleThreshold = 1.5;

  if (Math.abs(horizontalAngle) > angleThreshold && Math.abs(lastMouseDX) > 0.01) {
    const signError = Math.sign(horizontalAngle);
    const signMove = Math.sign(lastMouseDX);
    if (signError !== signMove) {
      metrics.overshoot += 1;
    } else {
      metrics.undershoot += 1;
    }
  }

  metrics.totalAngleError += angle;
  metrics.samples += 1;

  if (reaction !== null) {
    metrics.totalReaction += reaction;
    metrics.totalTtk += reaction;
    metrics.hitSamples += 1;
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
      recordShotMetrics(target, true);
      scene.remove(mesh);
      targets.splice(targets.indexOf(target), 1);
      ensureTargets();
    }
  } else if (targets[0]) {
    recordShotMetrics(targets[0], false);
  }
  updateHud();
}

function startFree() {
  state.mode = "free";
  state.timeLeft = 0;
  state.targetCount = 3;
  state.drillDuration = 20;
  state.currentDrill = drillSelect.value;
  setSensitivity(Number(sensRange.value));
  resetStats();
  resetMetrics();
  clearTargets();
  ensureTargets();
  closeMenu();
  updateHud();
  lockPointer();
}

function buildCalibrationValues(min, max, count) {
  const values = [];
  const step = (max - min) / (count - 1);
  for (let i = 0; i < count; i += 1) {
    values.push(Number((min + step * i).toFixed(2)));
  }
  return values;
}

function startCalibration(modeKey) {
  const mode = calibrationModes[modeKey];
  const values = buildCalibrationValues(0.05, 1.0, mode.stages);
  state.calibration = {
    values,
    index: 0,
    results: [],
    mode: modeKey
  };
  state.drillDuration = mode.duration;
  state.targetCount = mode.targetCount;
  calibrationHint.textContent = `校準流程: ${mode.stages} 個靈敏度，每段 ${mode.duration} 秒`;
  runCalibrationStage();
}

function runCalibrationStage() {
  const value = state.calibration.values[state.calibration.index];
  setSensitivity(value);
  state.mode = "calibration";
  state.timeLeft = state.drillDuration;
  resetStats();
  resetMetrics();
  clearTargets();
  ensureTargets();
  closeMenu();
  updateHud();
  lockPointer();
}

function finishStage() {
  const accuracy = state.shots > 0 ? state.hits / state.shots : 0;
  const avgReaction = metrics.hitSamples > 0 ? metrics.totalReaction / metrics.hitSamples : 0;
  const avgTtk = metrics.hitSamples > 0 ? metrics.totalTtk / metrics.hitSamples : 0;
  const avgError = metrics.samples > 0 ? metrics.totalAngleError / metrics.samples : 0;
  const over = metrics.overshoot;
  const under = metrics.undershoot;
  const balance = over + under > 0 ? over / (over + under) : 0.5;

  state.calibration.results.push({
    sens: state.currentSens,
    accuracy,
    avgReaction,
    avgTtk,
    avgError,
    balance
  });

  state.calibration.index += 1;
  if (state.calibration.index < state.calibration.values.length) {
    runCalibrationStage();
  } else {
    finishCalibration();
  }
}

function normalize(value, min, max, invert = false) {
  if (max === min) return 1;
  const clamped = (value - min) / (max - min);
  const normalized = THREE.MathUtils.clamp(clamped, 0, 1);
  return invert ? 1 - normalized : normalized;
}

function finishCalibration() {
  unlockPointer();
  state.mode = "free";
  openMenu();
  resultSection.hidden = false;
  tableSection.hidden = false;

  const results = state.calibration.results;
  const minRT = Math.min(...results.map((r) => r.avgReaction));
  const maxRT = Math.max(...results.map((r) => r.avgReaction));
  const minTTK = Math.min(...results.map((r) => r.avgTtk));
  const maxTTK = Math.max(...results.map((r) => r.avgTtk));
  const minErr = Math.min(...results.map((r) => r.avgError));
  const maxErr = Math.max(...results.map((r) => r.avgError));

  results.forEach((r) => {
    const accScore = r.accuracy;
    const rtScore = normalize(r.avgReaction, minRT, maxRT, true);
    const ttkScore = normalize(r.avgTtk, minTTK, maxTTK, true);
    const errScore = normalize(r.avgError, minErr, maxErr, true);
    const balanceScore = 1 - Math.abs(r.balance - 0.5) * 2;

    r.score =
      accScore * 0.35 +
      rtScore * 0.25 +
      ttkScore * 0.15 +
      errScore * 0.15 +
      balanceScore * 0.1;
  });

  const ranked = [...results].sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const top3 = ranked.slice(0, 3).map((r) => r.sens.toFixed(2));

  recommendLabel.textContent = `建議靈敏度: ${best.sens.toFixed(2)}`;
  recommendDetail.textContent = `候選最佳區間: ${top3.join(" / ")}`;
  state.lastRecommendation = {
    sens: best.sens,
    top3,
    mode: state.calibration.mode,
    time: new Date().toISOString()
  };

  resultsTable.innerHTML = "";
  const header = ["Sens", "命中率", "反應", "TTK", "角度誤差", "分數"];
  header.forEach((label) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.textContent = label;
    resultsTable.appendChild(cell);
  });

  state.calibration.results.forEach((r) => {
    const cells = [
      r.sens.toFixed(2),
      `${Math.round(r.accuracy * 100)}%`,
      r.avgReaction ? r.avgReaction.toFixed(2) + "s" : "—",
      r.avgTtk ? r.avgTtk.toFixed(2) + "s" : "—",
      r.avgError.toFixed(1) + "°",
      r.score.toFixed(3)
    ];

    cells.forEach((text) => {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.textContent = text;
      resultsTable.appendChild(cell);
    });
  });

  updatePresetStatus();
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

  if (state.mode === "calibration") {
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      finishStage();
    }
  }

  updateTargets(dt);
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
  lastMouseDX = e.movementX;
});

canvas.addEventListener("click", () => {
  if (menuOpen) return;
  if (!pointerLocked) lockPointer();
});

document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (pointerLocked) {
    closeMenu();
  } else if (state.mode !== "calibration") {
    openMenu();
  }
});

sensRange.addEventListener("input", (e) => {
  const value = Number(e.target.value);
  setSensitivity(value);
});

playBtn.addEventListener("click", () => {
  startFree();
});

calibrateBtn.addEventListener("click", () => {
  startCalibration("standard");
});

quickBtn.addEventListener("click", () => {
  startCalibration("quick");
});

precisionBtn.addEventListener("click", () => {
  startCalibration("precision");
});

drillSelect.addEventListener("change", (e) => {
  state.currentDrill = e.target.value;
  clearTargets();
  ensureTargets();
  updateHud();
});

savePresetBtn.addEventListener("click", () => {
  const payload = state.lastRecommendation
    ? state.lastRecommendation
    : { sens: state.currentSens, top3: [state.currentSens.toFixed(2)], mode: "manual", time: new Date().toISOString() };
  localStorage.setItem("fps-sens-preset", JSON.stringify(payload));
  updatePresetStatus();
});

makeShareBtn.addEventListener("click", async () => {
  const payload = state.lastRecommendation
    ? state.lastRecommendation
    : { sens: state.currentSens, top3: [state.currentSens.toFixed(2)], mode: "manual", time: new Date().toISOString() };
  const json = JSON.stringify(payload);
  const code = btoa(unescape(encodeURIComponent(json)));
  shareCodeInput.value = code;
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(code);
  }
});

applyShareBtn.addEventListener("click", () => {
  try {
    const decoded = decodeURIComponent(escape(atob(shareCodeInput.value.trim())));
    const payload = JSON.parse(decoded);
    if (payload?.sens) {
      setSensitivity(Number(payload.sens));
      localStorage.setItem("fps-sens-preset", JSON.stringify(payload));
      updatePresetStatus();
    }
  } catch (err) {
    presetStatus.textContent = "分享碼無效";
  }
});

function updatePresetStatus() {
  const data = localStorage.getItem("fps-sens-preset");
  if (!data) {
    presetStatus.textContent = "尚未儲存";
    return;
  }
  try {
    const payload = JSON.parse(data);
    const date = payload.time ? new Date(payload.time) : null;
    const when = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : "";
    presetStatus.textContent = `已儲存: ${Number(payload.sens).toFixed(2)} ${when ? `(${when})` : ""}`;
  } catch {
    presetStatus.textContent = "尚未儲存";
  }
}

function applyCalibrationHint() {
  calibrationHint.textContent = "校準流程: 7 個靈敏度，每段 20 秒";
}

function loadPreset() {
  const data = localStorage.getItem("fps-sens-preset");
  if (!data) return;
  try {
    const payload = JSON.parse(data);
    if (payload?.sens) {
      setSensitivity(Number(payload.sens));
      shareCodeInput.value = "";
    }
  } catch {
    // ignore corrupted data
  }
}

setSensitivity(0.35);
updateHud();
ensureTargets();
applyCalibrationHint();
loadPreset();
updatePresetStatus();
animate();
openMenu();
menu.addEventListener("mousedown", (e) => {
  e.stopPropagation();
});

menu.addEventListener("click", (e) => {
  e.stopPropagation();
});

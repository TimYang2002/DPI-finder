// main.js
// ---------------------------
// 遊戲初始設定
// ---------------------------
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

window.gameScore = 0; // 全域分數

let animationId;
let targetSpawnInterval;
let targets = [];

// 生成目標
function spawnTarget() {
  const target = {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: 20
  };
  targets.push(target);
}

// 偵測點擊
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  targets.forEach((t, i) => {
    const dist = Math.hypot(mx - t.x, my - t.y);
    if(dist < t.r){
      targets.splice(i,1);
      window.gameScore += 10;
      document.getElementById('scoreLabel').innerText = window.gameScore;
    }
  });
});

// ---------------------------
// 遊戲動畫
// ---------------------------
function animate() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = 'red';
  targets.forEach(t => {
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI*2);
    ctx.fill();
  });
  animationId = requestAnimationFrame(animate);
}

// ---------------------------
// 開始遊戲
// ---------------------------
function startGame() {
  targets = [];
  window.gameScore = 0;
  document.getElementById('scoreLabel').innerText = 0;
  if(targetSpawnInterval) clearInterval(targetSpawnInterval);
  targetSpawnInterval = setInterval(spawnTarget, 1000);
  animate();
}

// 暫停遊戲
window.pauseGame = () => {
  if(animationId) cancelAnimationFrame(animationId);
  if(targetSpawnInterval) clearInterval(targetSpawnInterval);
};

// 自動開始遊戲
startGame();


"use strict";

/* =========================================
   SHADOW STRIKE - COMPLETE GAME UPGRADE
   Features:
   Boss Attacks, 4 Weapons, Levels,
   High Score, Sound Effects, Mobile Controls
========================================= */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const $ = (id) => document.getElementById(id);

const scoreEl = $("score");
const healthEl = $("health");
const coinsEl = $("coins");
const enemyCountEl = $("enemyCount");
const weaponLevelEl = $("weaponLevel");

const mainMenu = $("mainMenu");
const howToPanel = $("howToPanel");
const pauseMenu = $("pauseMenu");
const gameOverPanel = $("gameOver");
const pauseBtn = $("pauseBtn");
const upgradeBtn = $("upgradeBtn");

const bossHUD = $("bossHUD");
const bossHealthFill = $("bossHealthFill");

const finalScoreEl = $("finalScore");
const finalCoinsEl = $("finalCoins");

// ---------- GAME STATE ----------

let state = "menu";
let score = 0;
let coins = Number(localStorage.getItem("ss_coins") || 0);
let weaponLevel = Number(localStorage.getItem("ss_weaponLevel") || 1);
let highScore = Number(localStorage.getItem("ss_highScore") || 0);

let level = 1;
let enemies = [];
let bullets = [];
let enemyBullets = [];
let particles = [];
let pickups = [];
let boss = null;

let spawnTimer = 0;
let pickupTimer = 0;
let nextBossScore = 100;
let lastTime = 0;
let gameTime = 0;

let audioCtx = null;
let soundEnabled = true;
let shooting = false;
let mouseDown = false;
let mobileAim = false;

const keys = {};
const pointer = { x: 0, y: 0 };

const WEAPONS = [
  {
    name: "Pistol",
    price: 0,
    damage: 1,
    fireRate: 280,
    bullets: 1,
    spread: 0.03,
    speed: 570,
    color: "#ffe36e"
  },
  {
    name: "Rifle",
    price: 100,
    damage: 1,
    fireRate: 120,
    bullets: 1,
    spread: 0.015,
    speed: 720,
    color: "#6df5ff"
  },
  {
    name: "Shotgun",
    price: 200,
    damage: 1,
    fireRate: 480,
    bullets: 5,
    spread: 0.42,
    speed: 530,
    color: "#ffb56d"
  },
  {
    name: "Laser Gun",
    price: 350,
    damage: 3,
    fireRate: 190,
    bullets: 1,
    spread: 0,
    speed: 1000,
    color: "#ff5bff"
  }
];

let selectedWeapon = Number(localStorage.getItem("ss_weapon") || 0);
selectedWeapon = Math.max(0, Math.min(3, selectedWeapon));

const ownedWeapons = JSON.parse(
  localStorage.getItem("ss_ownedWeapons") || "[true,false,false,false]"
);

while (ownedWeapons.length < WEAPONS.length) {
  ownedWeapons.push(false);
}

ownedWeapons[0] = true;

// ---------- CANVAS SIZE ----------

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();

  canvas.width = Math.max(320, Math.floor(rect.width || 800));
  canvas.height = Math.max(320, Math.floor(rect.height || 500));

  if (player) {
    player.x = Math.max(20, Math.min(canvas.width - 20, player.x));
    player.y = Math.max(20, Math.min(canvas.height - 20, player.y));
  }
}

let player = {
  x: 400,
  y: 300,
  radius: 15,
  speed: 260,
  health: 100,
  maxHealth: 100,
  angle: 0,
  shootCooldown: 0,
  invincible: 0
};

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ---------- AUDIO ----------

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }

  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function sound(type) {
  if (!soundEnabled || !audioCtx) return;

  const presets = {
    shoot: [520, 0.045, "square", 0.025],
    laser: [950, 0.08, "sawtooth", 0.035],
    hit: [150, 0.09, "triangle", 0.05],
    explosion: [75, 0.28, "sawtooth", 0.07],
    pickup: [750, 0.12, "sine", 0.04],
    boss: [90, 0.5, "sawtooth", 0.06],
    level: [650, 0.2, "sine", 0.045],
    damage: [100, 0.16, "square", 0.05]
  };

  const [frequency, duration, wave, volume] =
    presets[type] || presets.shoot;

  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = wave;
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    if (type === "explosion" || type === "damage") {
      osc.frequency.exponentialRampToValueAtTime(
        40,
        audioCtx.currentTime + duration
      );
    }

    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + duration
    );

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (error) {
    // Audio is optional; the game continues without sound.
  }
}

// ---------- DYNAMIC GAME UI ----------

const extraStyle = document.createElement("style");

extraStyle.textContent = `
.ss-extra {
  font-family: Arial, sans-serif;
  color: #fff;
  background: #111827;
  border: 1px solid #374151;
  border-radius: 10px;
  padding: 10px;
  margin: 8px auto;
  max-width: 520px;
  box-sizing: border-box;
}
.ss-extra button {
  background: #24364b;
  color: white;
  border: 1px solid #52657a;
  padding: 8px 10px;
  border-radius: 7px;
  cursor: pointer;
  margin: 3px;
}
.ss-extra button:disabled {
  opacity: .45;
  cursor: not-allowed;
}
.ss-extra button.active {
  background: #087f8c;
  border-color: #54f4ff;
}
.ss-extra button:hover:not(:disabled) {
  filter: brightness(1.2);
}
.ss-extra-title {
  font-weight: bold;
  color: #71f7ff;
  margin-bottom: 7px;
}
.ss-extra small {
  color: #cbd5e1;
}
`;

document.head.appendChild(extraStyle);

function createPanel(id, title) {
  let panel = $(id);

  if (!panel) {
    panel = document.createElement("div");
    panel.id = id;
    panel.className = "ss-extra";

    const anchor = canvas.parentElement || canvas;
    anchor.insertAdjacentElement("afterend", panel);
  }

  panel.innerHTML = `<div class="ss-extra-title">${title}</div>`;
  return panel;
}

const weaponPanel = createPanel("weaponPanel", "🔫 WEAPONS");
const progressPanel = createPanel("progressPanel", "🏆 PROGRESS");
const soundPanel = createPanel("soundPanel", "🔊 SOUND");

const weaponButtons = [];

function buildWeaponUI() {
  weaponPanel.innerHTML =
    '<div class="ss-extra-title">🔫 WEAPONS</div>' +
    "<small>Unlock weapons with coins. Press 1–4 to switch.</small><br>";

  weaponButtons.length = 0;

  WEAPONS.forEach((weapon, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.addEventListener("click", () => {
      initAudio();

      if (ownedWeapons[index]) {
        selectedWeapon = index;
        localStorage.setItem("ss_weapon", selectedWeapon);
        updateHUD();
        buildWeaponUI();
        return;
      }

      if (coins >= weapon.price) {
        coins -= weapon.price;
        ownedWeapons[index] = true;
        selectedWeapon = index;

        localStorage.setItem("ss_coins", coins);
        localStorage.setItem(
          "ss_ownedWeapons",
          JSON.stringify(ownedWeapons)
        );
        localStorage.setItem("ss_weapon", selectedWeapon);

        sound("pickup");
        updateHUD();
        buildWeaponUI();
      } else {
        button.textContent = "Need more coins!";
      }
    });

    weaponButtons.push(button);
    weaponPanel.appendChild(button);
  });

  updateWeaponUI();
}

function updateWeaponUI() {
  weaponButtons.forEach((button, index) => {
    const weapon = WEAPONS[index];

    button.classList.toggle("active", selectedWeapon === index);

    if (ownedWeapons[index]) {
      button.textContent =
        `${index + 1}. ${weapon.name}` +
        (selectedWeapon === index ? " ✓" : "");
      button.disabled = false;
    } else {
      button.textContent =
        `${weapon.name} — ${weapon.price} coins`;
      button.disabled = false;
    }
  });
}

function buildProgressUI() {
  progressPanel.innerHTML = `
    <div class="ss-extra-title">🏆 PROGRESS</div>
    <div id="ssHighScore">Best Score: ${highScore}</div>
    <div id="ssLevel">Level: ${level}</div>
    <div id="ssWeaponName">Weapon: ${WEAPONS[selectedWeapon].name}</div>
  `;

  soundPanel.innerHTML = `
    <div class="ss-extra-title">🔊 SOUND</div>
    <button id="ssSoundToggle" type="button">
      ${soundEnabled ? "Sound ON" : "Sound OFF"}
    </button>
  `;

  $("ssSoundToggle").addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    if (soundEnabled) initAudio();
    $("ssSoundToggle").textContent =
      soundEnabled ? "Sound ON" : "Sound OFF";
    sound("pickup");
  });
}

buildWeaponUI();
buildProgressUI();

// ---------- HUD ----------

function updateHUD() {
  if (scoreEl) scoreEl.textContent = score;
  if (healthEl) healthEl.textContent = Math.max(0, Math.ceil(player.health));
  if (coinsEl) coinsEl.textContent = coins;
  if (enemyCountEl) enemyCountEl.textContent = enemies.length;

  if (weaponLevelEl) {
    weaponLevelEl.textContent = weaponLevel;
  }

  if (bossHUD) {
    bossHUD.classList.toggle("hidden", !boss || state === "menu" || state === "over");
  }

  if (bossHealthFill && boss) {
    bossHealthFill.style.width =
      `${Math.max(0, (boss.health / boss.maxHealth) * 100)}%`;
  }

  const highScoreEl = $("ssHighScore");
  const levelEl = $("ssLevel");
  const weaponNameEl = $("ssWeaponName");

  if (highScoreEl) highScoreEl.textContent = `Best Score: ${highScore}`;
  if (levelEl) levelEl.textContent = `Level: ${level}`;
  if (weaponNameEl) {
    weaponNameEl.textContent = `Weapon: ${WEAPONS[selectedWeapon].name}`;
  }

  updateWeaponUI();
}

// ---------- MENUS ----------

function showOnly(panelToShow) {
  [mainMenu, howToPanel, pauseMenu, gameOverPanel].forEach((panel) => {
    if (panel) panel.classList.add("hidden");
  });

  if (panelToShow) panelToShow.classList.remove("hidden");
}

function startGame() {
  initAudio();
  resetGame();
  state = "playing";
  showOnly(null);
  lastTime = performance.now();
  updateHUD();
  requestAnimationFrame(gameLoop);
}

function resetGame() {
  score = 0;
  level = 1;
  gameTime = 0;
  spawnTimer = 0;
  pickupTimer = 0;
  nextBossScore = 100;

  enemies = [];
  bullets = [];
  enemyBullets = [];
  particles = [];
  pickups = [];
  boss = null;

  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  player.health = player.maxHealth;
  player.angle = 0;
  player.shootCooldown = 0;
  player.invincible = 0;

  shooting = false;
  mouseDown = false;
  mobileAim = false;

  updateHUD();
}

function pauseGame() {
  if (state !== "playing") return;
  state = "paused";
  shooting = false;
  showOnly(pauseMenu);
  updateHUD();
}

function resumeGame() {
  if (state !== "paused") return;
  state = "playing";
  showOnly(null);
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function showMenu() {
  state = "menu";
  shooting = false;
  resetGame();
  showOnly(mainMenu);
  updateHUD();
  draw();
}

function endGame() {
  if (state === "over") return;

  state = "over";
  shooting = false;

  if (score > highScore) {
    highScore = score;
    localStorage.setItem("ss_highScore", highScore);
  }

  if (finalScoreEl) finalScoreEl.textContent = score;
  if (finalCoinsEl) finalCoinsEl.textContent = coins;

  if (gameOverPanel) showOnly(gameOverPanel);
  else showOnly(mainMenu);

  updateHUD();
  draw();
  sound("explosion");
}

// ---------- LEVELS ----------

function checkLevel() {
  const newLevel = Math.floor(score / 150) + 1;

  if (newLevel > level) {
    level = newLevel;
    sound("level");
    createTextParticle(
      canvas.width / 2,
      canvas.height / 2,
      `LEVEL ${level}!`,
      "#75f7ff",
      32
    );

    // Every third level gives a small health reward.
    if (level % 3 === 0) {
      player.health = Math.min(
        player.maxHealth,
        player.health + 20
      );
    }
  }
}

// ---------- PLAYER AND WEAPONS ----------

function shoot() {
  if (state !== "playing" || player.shootCooldown > 0) return;

  const weapon = WEAPONS[selectedWeapon];
  player.shootCooldown = weapon.fireRate;

  for (let i = 0; i < weapon.bullets; i++) {
    const spread =
      (Math.random() - 0.5) * weapon.spread;

    const angle = player.angle + spread;

    bullets.push({
      x: player.x + Math.cos(angle) * 20,
      y: player.y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * weapon.speed,
      vy: Math.sin(angle) * weapon.speed,
      radius: selectedWeapon === 3 ? 4 : 3,
      damage: weapon.damage,
      color: weapon.color,
      life: 1.3
    });
  }

  sound(selectedWeapon === 3 ? "laser" : "shoot");
}

function movePlayer(dt) {
  let dx = 0;
  let dy = 0;

  if (keys.ArrowLeft || keys.a || keys.A) dx--;
  if (keys.ArrowRight || keys.d || keys.D) dx++;
  if (keys.ArrowUp || keys.w || keys.W) dy--;
  if (keys.ArrowDown || keys.s || keys.S) dy++;

  if (dx !== 0 || dy !== 0) {
    const length = Math.hypot(dx, dy);
    dx /= length;
    dy /= length;
  }

  player.x += dx * player.speed * dt;
  player.y += dy * player.speed * dt;

  player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

  player.angle = Math.atan2(
    pointer.y - player.y,
    pointer.x - player.x
  );

  if (player.shootCooldown > 0) {
    player.shootCooldown -= dt * 1000;
  }

  if (player.invincible > 0) {
    player.invincible -= dt;
  }

  if (shooting || mouseDown) shoot();
}

// ---------- ENEMIES ----------

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x;
  let y;

  if (side === 0) {
    x = Math.random() * canvas.width;
    y = -20;
  } else if (side === 1) {
    x = canvas.width + 20;
    y = Math.random() * canvas.height;
  } else if (side === 2) {
    x = Math.random() * canvas.width;
    y = canvas.height + 20;
  } else {
    x = -20;
    y = Math.random() * canvas.height;
  }

  const hp = 1 + Math.floor((level - 1) / 3);

  enemies.push({
    x,
    y,
    radius: 12 + Math.min(level, 8),
    health: hp,
    speed: 55 + level * 5 + Math.random() * 25,
    shootTimer: 1.2 + Math.random() * 2,
    color: level > 3 ? "#ff884d" : "#ff4567"
  });
}

function damagePlayer(amount) {
  if (player.invincible > 0 || state !== "playing") return;

  player.health -= amount;
  player.invincible = 0.55;
  sound("damage");
  burst(player.x, player.y, "#ff5364", 8);

  if (player.health <= 0) {
    player.health = 0;
    endGame();
  }
}

function killEnemy(index) {
  const enemy = enemies[index];
  if (!enemy) return;

  burst(enemy.x, enemy.y, enemy.color, 12);
  enemies.splice(index, 1);

  score += 10;
  coins += 5;

  localStorage.setItem("ss_coins", coins);
  checkLevel();
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;

    enemy.x += (dx / distance) * enemy.speed * dt;
    enemy.y += (dy / distance) * enemy.speed * dt;

    // Enemies from higher levels occasionally shoot.
    enemy.shootTimer -= dt;

    if (level >= 2 && enemy.shootTimer <= 0 && distance < 430) {
      enemy.shootTimer = Math.max(
        0.8,
        2.8 - level * 0.12
      );

      const angle = Math.atan2(dy, dx);

      enemyBullets.push({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * (160 + level * 8),
        vy: Math.sin(angle) * (160 + level * 8),
        radius: 5,
        damage: 8,
        color: "#ff8b4d",
        life: 3
      });
    }

    if (distance < enemy.radius + player.radius) {
      damagePlayer(15);
      enemy.x -= (dx / distance) * 20;
      enemy.y -= (dy / distance) * 20;
    }
  }
}

// ---------- BOSS FIGHT ----------

function spawnBoss() {
  if (boss) return;

  boss = {
    x: canvas.width / 2,
    y: 70,
    radius: 34 + Math.min(level * 2, 20),
    maxHealth: 40 + level * 12,
    health: 40 + level * 12,
    speed: 65 + level * 3,
    shootTimer: 1.1,
    specialTimer: 4,
    phase: 0,
    flash: 0
  };

  sound("boss");
  createTextParticle(
    canvas.width / 2,
    canvas.height / 2,
    "⚠ BOSS FIGHT!",
    "#ff4545",
    30
  );

  updateHUD();
}

function bossShoot() {
  if (!boss) return;

  const angle = Math.atan2(
    player.y - boss.y,
    player.x - boss.x
  );

  // Three aimed projectiles.
  for (let i = -1; i <= 1; i++) {
    const a = angle + i * 0.22;

    enemyBullets.push({
      x: boss.x,
      y: boss.y,
      vx: Math.cos(a) * (190 + level * 8),
      vy: Math.sin(a) * (190 + level * 8),
      radius: 7,
      damage: 12,
      color: "#ff2f55",
      life: 4
    });
  }
}

function bossSpecialAttack() {
  if (!boss) return;

  // A circular burst of projectiles.
  const count = 12 + Math.min(level, 8);

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;

    enemyBullets.push({
      x: boss.x,
      y: boss.y,
      vx: Math.cos(angle) * 145,
      vy: Math.sin(angle) * 145,
      radius: 6,
      damage: 9,
      color: "#ff9b42",
      life: 4
    });
  }

  sound("explosion");
  burst(boss.x, boss.y, "#ff4a4a", 22);
}

function updateBoss(dt) {
  if (!boss) return;

  const dx = player.x - boss.x;
  const dy = player.y - boss.y;
  const distance = Math.hypot(dx, dy) || 1;

  // The boss moves toward the player but keeps some distance.
  if (distance > 170) {
    boss.x += (dx / distance) * boss.speed * dt;
    boss.y += (dy / distance) * boss.speed * dt;
  }

  boss.x = Math.max(boss.radius, Math.min(canvas.width - boss.radius, boss.x));
  boss.y = Math.max(boss.radius, Math.min(canvas.height - boss.radius, boss.y));

  boss.shootTimer -= dt;
  boss.specialTimer -= dt;

  if (boss.shootTimer <= 0) {
    boss.shootTimer = Math.max(0.45, 1.3 - level * 0.035);
    bossShoot();
  }

  if (boss.specialTimer <= 0) {
    boss.specialTimer = Math.max(2.2, 5 - level * 0.1);
    bossSpecialAttack();
  }

  if (distance < boss.radius + player.radius) {
    damagePlayer(20);
  }

  if (boss.flash > 0) boss.flash -= dt;
}

function defeatBoss() {
  if (!boss) return;

  burst(boss.x, boss.y, "#ff3f60", 35);

  score += 100;
  coins += 50;

  localStorage.setItem("ss_coins", coins);

  boss = null;
  nextBossScore = score + 150;

  createTextParticle(
    canvas.width / 2,
    canvas.height / 2,
    "BOSS DEFEATED! +50 COINS",
    "#ffe36e",
    23
  );

  checkLevel();
  sound("explosion");
  updateHUD();
}

// ---------- BULLETS ----------

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];

    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    let removed = false;

    if (boss) {
      const distance = Math.hypot(
        bullet.x - boss.x,
        bullet.y - boss.y
      );

      if (distance < boss.radius + bullet.radius) {
        boss.health -= bullet.damage;
        boss.flash = 0.12;

        burst(bullet.x, bullet.y, bullet.color, 3);
        bullets.splice(i, 1);
        removed = true;

        if (boss.health <= 0) defeatBoss();
      }
    }

    if (removed) continue;

    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];

      const distance = Math.hypot(
        bullet.x - enemy.x,
        bullet.y - enemy.y
      );

      if (distance < enemy.radius + bullet.radius) {
        enemy.health -= bullet.damage;
        burst(bullet.x, bullet.y, bullet.color, 3);
        bullets.splice(i, 1);
        removed = true;

        if (enemy.health <= 0) killEnemy(j);
        break;
      }
    }

    if (
      !removed &&
      (
        bullet.life <= 0 ||
        bullet.x < -30 ||
        bullet.x > canvas.width + 30 ||
        bullet.y < -30 ||
        bullet.y > canvas.height + 30
      )
    ) {
      bullets.splice(i, 1);
    }
  }
}

function updateEnemyBullets(dt) {
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const bullet = enemyBullets[i];

    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    const distance = Math.hypot(
      bullet.x - player.x,
      bullet.y - player.y
    );

    if (distance < bullet.radius + player.radius) {
      damagePlayer(bullet.damage);
      burst(bullet.x, bullet.y, bullet.color, 5);
      enemyBullets.splice(i, 1);
      continue;
    }

    if (
      bullet.life <= 0 ||
      bullet.x < -40 ||
      bullet.x > canvas.width + 40 ||
      bullet.y < -40 ||
      bullet.y > canvas.height + 40
    ) {
      enemyBullets.splice(i, 1);
    }
  }
}

// ---------- HEALTH PICKUPS ----------

function spawnPickup() {
  pickups.push({
    x: 25 + Math.random() * Math.max(1, canvas.width - 50),
    y: 25 + Math.random() * Math.max(1, canvas.height - 50),
    radius: 12,
    life: 12
  });
}

function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pickup = pickups[i];
    pickup.life -= dt;

    const distance = Math.hypot(
      pickup.x - player.x,
      pickup.y - player.y
    );

    if (distance < pickup.radius + player.radius) {
      player.health = Math.min(
        player.maxHealth,
        player.health + 25
      );

      burst(pickup.x, pickup.y, "#51ff9a", 10);
      pickups.splice(i, 1);
      sound("pickup");
      continue;
    }

    if (pickup.life <= 0) {
      pickups.splice(i, 1);
    }
  }
}

// ---------- PARTICLES AND TEXT ----------

function burst(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 200;

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.3 + Math.random() * 0.6,
      maxLife: 0.9,
      radius: 2 + Math.random() * 4,
      color
    });
  }
}

function createTextParticle(x, y, text, color, size = 24) {
  particles.push({
    x,
    y,
    vx: 0,
    vy: -25,
    life: 1.8,
    maxLife: 1.8,
    radius: size,
    color,
    text
  });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;

    if (!p.text) {
      p.vx *= 0.97;
      p.vy *= 0.97;
    }

    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ---------- DRAWING ----------

function drawBackground() {
  ctx.fillStyle = "#080d18";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid
  ctx.strokeStyle = "rgba(72, 125, 170, 0.12)";
  ctx.lineWidth = 1;

  const gridSize = 40;

  for (let x = 0; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawPlayer() {
  if (!player) return;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  if (player.invincible > 0 && Math.floor(gameTime * 16) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }

  ctx.fillStyle = "#41d9ff";
  ctx.shadowColor = "#27cfff";
  ctx.shadowBlur = 15;

  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-12, -12);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-12, 12);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawEnemies() {
  enemies.forEach((enemy) => {
    ctx.fillStyle = enemy.color;
    ctx.shadowColor = enemy.color;
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    if (enemy.health > 1) {
      ctx.fillStyle = "#fff";
      ctx.font = "11px Arial";
      ctx.textAlign = "center";
      ctx.fillText(enemy.health, enemy.x, enemy.y + 4);
    }
  });
}

function drawBoss() {
  if (!boss) return;

  ctx.save();
  ctx.translate(boss.x, boss.y);

  ctx.fillStyle = boss.flash > 0 ? "#ffffff" : "#b32045";
  ctx.shadowColor = "#ff234f";
  ctx.shadowBlur = 25;

  // Outer body
  ctx.beginPath();
  ctx.arc(0, 0, boss.radius, 0, Math.PI * 2);
  ctx.fill();

  // Armor spikes
  ctx.fillStyle = "#ff536e";

  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8;

    ctx.beginPath();
    ctx.moveTo(
      Math.cos(a) * (boss.radius - 5),
      Math.sin(a) * (boss.radius - 5)
    );
    ctx.lineTo(
      Math.cos(a) * (boss.radius + 12),
      Math.sin(a) * (boss.radius + 12)
    );
    ctx.lineTo(
      Math.cos(a + 0.35) * (boss.radius - 5),
      Math.sin(a + 0.35) * (boss.radius - 5)
    );
    ctx.closePath();
    ctx.fill();
  }

  // Eyes
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff16e";

  ctx.beginPath();
  ctx.arc(-10, -5, 5, 0, Math.PI * 2);
  ctx.arc(10, -5, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBullets() {
  bullets.forEach((bullet) => {
    ctx.fillStyle = bullet.color;
    ctx.shadowColor = bullet.color;
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  enemyBullets.forEach((bullet) => {
    ctx.fillStyle = bullet.color;
    ctx.shadowColor = bullet.color;
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.shadowBlur = 0;
}

function drawPickups() {
  pickups.forEach((pickup) => {
    ctx.fillStyle = "#50ff9c";
    ctx.shadowColor = "#50ff9c";
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.arc(pickup.x, pickup.y, pickup.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#073b27";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+", pickup.x, pickup.y);
  });

  ctx.shadowBlur = 0;
}

function drawParticles() {
  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(
      0,
      Math.min(1, p.life / p.maxLife)
    );

    if (p.text) {
      ctx.fillStyle = p.color;
      ctx.font = `bold ${p.radius}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.fillStyle = p.color;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.globalAlpha = 1;
}

function draw() {
  drawBackground();
  drawPickups();
  drawBullets();
  drawEnemies();
  drawBoss();
  drawPlayer();
  drawParticles();
}

// ---------- MAIN GAME LOOP ----------

function update(dt) {
  if (state !== "playing") return;

  gameTime += dt;

  movePlayer(dt);

  spawnTimer -= dt;
  pickupTimer -= dt;

  const spawnInterval = Math.max(0.32, 1.35 - level * 0.07);

  if (spawnTimer <= 0 && enemies.length < 30) {
    spawnEnemy();
    spawnTimer = spawnInterval;
  }

  if (pickupTimer <= 0 && pickups.length < 2) {
    spawnPickup();
    pickupTimer = 12 + Math.random() * 8;
  }

  // Start the first boss at score 100, then after each victory.
  if (!boss && score >= nextBossScore) {
    spawnBoss();
  }

  updateEnemies(dt);
  updateBoss(dt);
  updateBullets(dt);
  updateEnemyBullets(dt);
  updatePickups(dt);
  updateParticles(dt);

  updateHUD();
}

function gameLoop(timestamp) {
  if (state !== "playing") {
    draw();
    return;
  }

  let dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  // Avoid large jumps when the browser tab resumes.
  dt = Math.max(0, Math.min(dt, 0.035));

  update(dt);
  draw();

  if (state === "playing") {
    requestAnimationFrame(gameLoop);
  }
}

// ---------- KEYBOARD CONTROLS ----------

window.addEventListener("keydown", (event) => {
  keys[event.key] = true;

  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "]
      .includes(event.key)
  ) {
    event.preventDefault();
  }

  if (event.key === "Escape" || event.key.toLowerCase() === "p") {
    if (state === "playing") pauseGame();
    else if (state === "paused") resumeGame();
  }

  if (event.key === " ") {
    shooting = true;
    initAudio();
  }

  if (/^[1-4]$/.test(event.key)) {
    const index = Number(event.key) - 1;

    if (ownedWeapons[index]) {
      selectedWeapon = index;
      localStorage.setItem("ss_weapon", selectedWeapon);
      updateHUD();
    }
  }

  if (event.key.toLowerCase() === "m") {
    soundEnabled = !soundEnabled;

    const toggle = $("ssSoundToggle");
    if (toggle) {
      toggle.textContent = soundEnabled ? "Sound ON" : "Sound OFF";
    }
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.key] = false;

  if (event.key === " ") {
    shooting = false;
  }
});

window.addEventListener("blur", () => {
  shooting = false;
  mouseDown = false;

  if (state === "playing") pauseGame();
});

// ---------- MOUSE AIM AND SHOOT ----------

canvas.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();

  pointer.x = (event.clientX - rect.left) * canvas.width / rect.width;
  pointer.y = (event.clientY - rect.top) * canvas.height / rect.height;
});

canvas.addEventListener("pointerdown", (event) => {
  initAudio();

  if (event.pointerType === "mouse") {
    mouseDown = true;
  }
});

window.addEventListener("pointerup", () => {
  mouseDown = false;
});

// ---------- MOBILE CONTROLS ----------

document.querySelectorAll("[data-key]").forEach((button) => {
  const key = button.dataset.key;

  const press = (event) => {
    event.preventDefault();
    keys[key] = true;
  };

  const release = (event) => {
    event.preventDefault();
    keys[key] = false;
  };

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointerleave", release);
  button.addEventListener("pointercancel", release);
});

const fireBtn = $("fireBtn");

if (fireBtn) {
  fireBtn.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    initAudio();
    shooting = true;
  });

  ["pointerup", "pointerleave", "pointercancel"].forEach((type) => {
    fireBtn.addEventListener(type, (event) => {
      event.preventDefault();
      shooting = false;
    });
  });
}

// ---------- EXISTING BUTTONS ----------

if ($("playBtn")) {
  $("playBtn").addEventListener("click", startGame);
}

if ($("howToBtn")) {
  $("howToBtn").addEventListener("click", () => {
    showOnly(howToPanel);
  });
}

if ($("backBtn")) {
  $("backBtn").addEventListener("click", () => {
    showOnly(mainMenu);
  });
}

if (pauseBtn) {
  pauseBtn.addEventListener("click", pauseGame);
}

if ($("resumeBtn")) {
  $("resumeBtn").addEventListener("click", resumeGame);
}

if ($("menuBtn")) {
  $("menuBtn").addEventListener("click", showMenu);
}

if ($("restartBtn")) {
  $("restartBtn").addEventListener("click", startGame);
}

if ($("playAgainBtn")) {
  $("playAgainBtn").addEventListener("click", startGame);
}

if ($("gameOverMenuBtn")) {
  $("gameOverMenuBtn").addEventListener("click", showMenu);
}

// Upgrade the base weapon level with coins.
if (upgradeBtn) {
  upgradeBtn.addEventListener("click", () => {
    if (coins >= 50) {
      coins -= 50;
      weaponLevel++;

      player.maxHealth = Math.min(150, player.maxHealth + 5);
      player.health = Math.min(
        player.maxHealth,
        player.health + 10
      );

      localStorage.setItem("ss_coins", coins);
      localStorage.setItem("ss_weaponLevel", weaponLevel);

      sound("pickup");
      updateHUD();
    } else {
      createTextParticle(
        canvas.width / 2,
        canvas.height / 2,
        "Need 50 coins to upgrade!",
        "#ffe36e",
        19
      );
    }
  });
}

// ---------- INITIALIZE ----------

function initializeGame() {
  showOnly(mainMenu);
  updateHUD();
  draw();
}

initializeGame();

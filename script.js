/* =========================================================
   КОСМИЧЕСКИЙ КРИСТАЛЛ — ИГРОВАЯ ЛОГИКА
   ========================================================= */

// ===== СОСТОЯНИЕ ИГРЫ =====
const gameState = {
    energy: 0,
    totalClicks: 0,
    upgrades: {
        finger:      { owned: 0 },
        drone:       { owned: 0 },
        drill:       { owned: 0 },
        accelerator: { owned: 0 }
    }
};

// ===== ОПИСАНИЕ УЛУЧШЕНИЙ =====
const UPGRADES = [
    {
        id: 'finger',
        emoji: '👆',
        name: 'Усиленный палец',
        desc: '+1 к силе клика',
        basePrice: 15,
        type: 'click',
        power: 1
    },
    {
        id: 'drone',
        emoji: '🛸',
        name: 'Космический дрон',
        desc: '+1 энергии / сек',
        basePrice: 100,
        type: 'auto',
        power: 1
    },
    {
        id: 'drill',
        emoji: '⛏️',
        name: 'Лазерный бур',
        desc: '+10 энергии / сек',
        basePrice: 1100,
        type: 'auto',
        power: 10
    },
    {
        id: 'accelerator',
        emoji: '⚛️',
        name: 'Квантовый ускоритель',
        desc: '+100 энергии / сек',
        basePrice: 12000,
        type: 'auto',
        power: 100
    }
];

// ===== ФОРМАТТЕР ЧИСЕЛ =====
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

function formatNumber(n) {
    if (!isFinite(n)) return '∞';
    if (n < 1000) return Math.floor(n).toString();
    const tier = Math.floor(Math.log10(Math.abs(n)) / 3);
    if (tier >= SUFFIXES.length) return n.toExponential(2);
    const scaled = n / Math.pow(1000, tier);
    // 2 знака после запятой, но без лишних нулей
    let str = scaled.toFixed(2);
    str = str.replace(/\.?0+$/, '');
    return str + SUFFIXES[tier];
}

// ===== РАСЧЁТ ХАРАКТЕРИСТИК =====
function getClickPower() {
    return 1 + gameState.upgrades.finger.owned;
}

function getEnergyPerSecond() {
    let eps = 0;
    for (const up of UPGRADES) {
        if (up.type === 'auto') {
            eps += up.power * gameState.upgrades[up.id].owned;
        }
    }
    return eps;
}

function getPrice(upgradeId) {
    const up = UPGRADES.find(u => u.id === upgradeId);
    const owned = gameState.upgrades[upgradeId].owned;
    return Math.ceil(up.basePrice * Math.pow(1.15, owned));
}

// ===== КОМБО-СИСТЕМА =====
const clickTimestamps = [];

function getComboMultiplier() {
    const now = Date.now();
    // Оставляем только клики за последнюю секунду
    while (clickTimestamps.length && now - clickTimestamps[0] > 1000) {
        clickTimestamps.shift();
    }
    const count = clickTimestamps.length;
    if (count >= 6) return 3;
    if (count >= 3) return 2;
    return 1;
}

// ===== DOM-ЭЛЕМЕНТЫ =====
const energyValueEl = document.getElementById('energyValue');
const epsValueEl = document.getElementById('epsValue');
const crystalEl = document.getElementById('crystal');
const clickPowerLabelEl = document.getElementById('clickPowerLabel');
const upgradesListEl = document.getElementById('upgradesList');
const comboDisplayEl = document.getElementById('comboDisplay');
const comboTextEl = document.getElementById('comboText');
const resetBtnEl = document.getElementById('resetBtn');

// ===== WEB AUDIO API — ЗВУК КЛИКА =====
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            audioCtx = null;
        }
    }
}

function playClickSound(multiplier) {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        // Частота зависит от комбо
        const baseFreq = 600 + (multiplier - 1) * 200;
        osc.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, audioCtx.currentTime + 0.08);
        osc.type = 'sine';

        gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.16);
    } catch (e) { /* ignore */ }
}

// ===== ОБНОВЛЕНИЕ UI =====
function updateUI() {
    energyValueEl.textContent = formatNumber(gameState.energy);
    epsValueEl.textContent = formatNumber(getEnergyPerSecond());
    clickPowerLabelEl.textContent = '+' + formatNumber(getClickPower()) + ' за клик';

    // Комбо
    const mult = getComboMultiplier();
    comboTextEl.textContent = 'КОМБО x' + mult;
    comboDisplayEl.classList.remove('active-x2', 'active-x3');
    if (mult === 2) comboDisplayEl.classList.add('active-x2');
    else if (mult === 3) comboDisplayEl.classList.add('active-x3');

    // Карточки магазина
    UPGRADES.forEach(up => {
        const card = document.getElementById('card-' + up.id);
        if (!card) return;
        const owned = gameState.upgrades[up.id].owned;
        const price = getPrice(up.id);
        const canAfford = gameState.energy >= price;

        card.querySelector('.upgrade-level').textContent = 'Ур. ' + owned;
        card.querySelector('.price').textContent = '⚡ ' + formatNumber(price);
        const btn = card.querySelector('.buy-btn');
        btn.disabled = !canAfford;
    });
}

// ===== СОЗДАНИЕ КАРТОЧЕК МАГАЗИНА =====
function renderShop() {
    upgradesListEl.innerHTML = '';
    UPGRADES.forEach(up => {
        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.id = 'card-' + up.id;
        card.innerHTML = `
            <div class="upgrade-emoji">${up.emoji}</div>
            <div class="upgrade-info">
                <div class="upgrade-name">${up.name}</div>
                <div class="upgrade-desc">${up.desc}</div>
                <div class="upgrade-level">Ур. 0</div>
            </div>
            <button class="buy-btn" data-id="${up.id}">
                <span>Купить</span>
                <span class="price">⚡ ${formatNumber(getPrice(up.id))}</span>
            </button>
        `;
        upgradesListEl.appendChild(card);
    });

    // Делегирование событий
    upgradesListEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.buy-btn');
        if (!btn || btn.disabled) return;
        buyUpgrade(btn.dataset.id);
    });
}

// ===== ПОКУПКА УЛУЧШЕНИЯ =====
function buyUpgrade(id) {
    const price = getPrice(id);
    if (gameState.energy < price) return;
    gameState.energy -= price;
    gameState.upgrades[id].owned += 1;
    playBuySound();
    updateUI();
    saveGame();
}

function playBuySound() {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.21);
    } catch (e) { /* ignore */ }
}

// ===== КЛИК ПО КРИСТАЛЛУ =====
function handleCrystalClick(e) {
    initAudio();

    // Регистрируем время клика для комбо
    clickTimestamps.push(Date.now());

    const multiplier = getComboMultiplier();
    const gained = getClickPower() * multiplier;
    gameState.energy += gained;
    gameState.totalClicks += 1;

    // Анимация нажатия
    crystalEl.classList.add('clicked');
    setTimeout(() => crystalEl.classList.remove('clicked'), 100);

    // Координаты клика
    const rect = crystalEl.getBoundingClientRect();
    let x, y;
    if (e.touches && e.touches[0]) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
    } else if (e.clientX !== undefined) {
        x = e.clientX;
        y = e.clientY;
    } else {
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
    }

    // Всплывающий текст
    spawnFloatText(x, y, '+' + formatNumber(gained), multiplier);

    // Частицы
    spawnParticles(x, y, 3 + Math.floor(Math.random() * 3));

    // Звук
    playClickSound(multiplier);

    updateUI();
}

function spawnFloatText(x, y, text, multiplier) {
    const el = document.createElement('div');
    el.className = 'float-text';
    if (multiplier === 2) el.classList.add('combo-x2');
    if (multiplier === 3) el.classList.add('combo-x3');
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.position = 'fixed';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function spawnParticles(x, y, count) {
    const colors = ['#00f5ff', '#ff2bd6', '#ffd700', '#9d4edd', '#00ff88'];
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 80;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        p.style.setProperty('--dx', dx + 'px');
        p.style.setProperty('--dy', dy + 'px');
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.position = 'fixed';
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.boxShadow = '0 0 8px ' + p.style.background;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 800);
    }
}

// ===== ИГРОВОЙ ЦИКЛ (пассивный доход) =====
let lastTick = Date.now();

function gameLoop() {
    const now = Date.now();
    const dt = (now - lastTick) / 1000; // секунды
    lastTick = now;

    const eps = getEnergyPerSecond();
    if (eps > 0) {
        gameState.energy += eps * dt;
    }

    updateUI();
}

// ===== СОХРАНЕНИЕ / ЗАГРУЗКА =====
const SAVE_KEY = 'cosmic_crystal_save_v1';

function saveGame() {
    try {
        const data = {
            energy: gameState.energy,
            totalClicks: gameState.totalClicks,
            upgrades: gameState.upgrades,
            savedAt: Date.now()
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('Не удалось сохранить:', e);
    }
}

function loadGame() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (typeof data.energy === 'number') gameState.energy = data.energy;
        if (typeof data.totalClicks === 'number') gameState.totalClicks = data.totalClicks;
        if (data.upgrades) {
            for (const key in data.upgrades) {
                if (gameState.upgrades[key]) {
                    gameState.upgrades[key].owned = data.upgrades[key].owned || 0;
                }
            }
        }
        // Оффлайн-доход (максимум 2 часа)
        if (data.savedAt) {
            const offlineSec = Math.min((Date.now() - data.savedAt) / 1000, 7200);
            const eps = getEnergyPerSecond();
            if (offlineSec > 1 && eps > 0) {
                const gained = eps * offlineSec;
                gameState.energy += gained;
                setTimeout(() => {
                    alert('🌌 Пока тебя не было, кристалл накопил ' + formatNumber(gained) + ' энергии!');
                }, 300);
            }
        }
    } catch (e) {
        console.warn('Не удалось загрузить:', e);
    }
}

function resetGame() {
    if (!confirm('Точно сбросить весь прогресс? Это действие нельзя отменить.')) return;
    localStorage.removeItem(SAVE_KEY);
    gameState.energy = 0;
    gameState.totalClicks = 0;
    for (const key in gameState.upgrades) {
        gameState.upgrades[key].owned = 0;
    }
    updateUI();
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
function init() {
    loadGame();
    renderShop();
    updateUI();

    // Клики по кристаллу (mouse + touch)
    crystalEl.addEventListener('click', handleCrystalClick);

    // Сброс
    resetBtnEl.addEventListener('click', resetGame);

    // Игровой цикл: 10 тиков в секунду
    setInterval(gameLoop, 100);

    // Автосохранение каждые 10 секунд
    setInterval(saveGame, 10000);

    // Сохранение при закрытии
    window.addEventListener('beforeunload', saveGame);
    window.addEventListener('visibilitychange', () => {
        if (document.hidden) saveGame();
    });

    // Разблокировка аудио после первого взаимодействия
    const unlockAudio = () => {
        initAudio();
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('touchstart', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
}

init();
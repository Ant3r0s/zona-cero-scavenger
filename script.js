import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';

// --- Módulo para la Interfaz de Usuario ---
const UI = {
    init() {
        this.bootLoader = document.getElementById('boot-loader');
        this.bootText = document.getElementById('boot-text');
        this.permissionPrompt = document.getElementById('permission-prompt');
        this.gameContainer = document.getElementById('game-container');
        this.canvas = document.getElementById('drone-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.objectiveList = document.getElementById('objective-list');
        this.inventoryList = document.getElementById('inventory-list');
        this.scanButton = document.getElementById('scan-button');
        this.resultsList = document.getElementById('results-list');
        this.actionLog = document.getElementById('action-log').querySelector('p');
        this.scanButton.addEventListener('click', () => Game.scanFrame());
    },
    async runBootSequence(permissionCallback, aiCallback) {
        this.bootLoader.classList.remove('hidden');
        const lines = ['R.U.S.T. OS v1.3a', '====================', 'CHECKING DRONE CONNECTION...'];
        for (const line of lines) {
            this.bootText.textContent += line + '\n';
            await new Promise(r => setTimeout(r, 200));
        }
        this.permissionPrompt.classList.remove('hidden');
        await permissionCallback(); // Esperamos a que el usuario de permiso a la cámara
        this.permissionPrompt.classList.add('hidden');
        this.bootText.textContent += 'SIGNAL ACQUIRED. VISUAL FEED ESTABLISHED.\n';
        this.bootText.textContent += 'LOADING AI COGNITIVE MODEL...\n';
        await aiCallback(); // Cargamos la IA
        this.bootText.textContent += 'AI MODEL LOADED. SYSTEM READY.\n';
        await new Promise(r => setTimeout(r, 1000));
        this.bootLoader.classList.add('hidden');
        this.gameContainer.classList.remove('hidden');
    },
    updateHUD(state) {
        this.objectiveList.innerHTML = '';
        state.objectives.forEach(obj => {
            const li = document.createElement('li');
            li.textContent = `> ${obj.name.toUpperCase()}`;
            if (obj.found) li.classList.add('found');
            this.objectiveList.appendChild(li);
        });
        this.inventoryList.innerHTML = '';
        if (state.found_items.length === 0) {
            this.inventoryList.innerHTML = '<li>(Vacío)</li>';
        } else {
            state.found_items.forEach(item => {
                const li = document.createElement('li');
                li.textContent = `> ${item.toUpperCase()}`;
                this.inventoryList.appendChild(li);
            });
        }
    },
    displayScanResults(results) {
        this.resultsList.innerHTML = '';
        if (results.length === 0) {
            this.resultsList.innerHTML = '<li>>> INTERFERENCIAS. NINGÚN OBJETO CLARO.</li>';
            return;
        }
        results.forEach(item => {
            const li = document.createElement('li');
            const confidence = Math.round(item.score * 100);
            li.textContent = `>> ${item.label.toUpperCase()} (Confianza: ${confidence}%)`;
            const objective = Game.state.objectives.find(o => o.name === item.label && !o.found);
            if (objective && confidence > 50) {
                li.style.color = '#39ff14'; // Resaltar si es un objetivo
                li.addEventListener('click', () => Game.salvage(objective));
            }
            this.resultsList.appendChild(li);
        });
    },
    logAction(text) { this.actionLog.textContent = `> ${text}`; }
};

// --- Módulo para la Cámara y el renderizado ---
const Renderer = {
    init(videoElement, canvasContext) {
        this.video = videoElement;
        this.ctx = canvasContext;
    },
    async start() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            this.video.srcObject = stream;
            this.video.onloadedmetadata = () => {
                this.ctx.canvas.width = this.video.videoWidth;
                this.ctx.canvas.height = this.video.videoHeight;
                this.renderLoop();
            };
        } catch (err) {
            console.error("Error accessing camera:", err);
            UI.bootText.textContent += "ERROR: CÁMARA NO DETECTADA O PERMISO DENEGADO.\n";
        }
    },
    renderLoop() {
        this.ctx.drawImage(this.video, 0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
        this.applyFilters();
        requestAnimationFrame(() => this.renderLoop());
    },
    applyFilters() {
        const imageData = this.ctx.getImageData(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            // Filtro Sepia + Ruido
            const r = data[i], g = data[i+1], b = data[i+2];
            const tr = 0.393 * r + 0.769 * g + 0.189 * b;
            const tg = 0.349 * r + 0.686 * g + 0.168 * b;
            const tb = 0.272 * r + 0.534 * g + 0.131 * b;
            const noise = (0.5 - Math.random()) * 20;
            data[i] = tr + noise;
            data[i+1] = tg + noise;
            data[i+2] = tb + noise;
        }
        this.ctx.putImageData(imageData, 0, 0);
    },
    captureFrame() {
        return this.ctx.canvas.toDataURL('image/jpeg');
    }
};

// --- Módulo de la IA ---
const AI = {
    async init() { /* ... (igual que antes, carga desde ./models/...) ... */ },
    async classifyImage(imageDataUrl) { /* ... (igual que antes) ... */ }
};
// Rellenando la IA para que sea completo
AI.init = async function() {
    try {
        this.classifier = await pipeline('image-classification', './models/mobilenet_v2_1.0_224', { quantized: true });
        return true;
    } catch (error) { console.error("Error loading AI model:", error); return false; }
};
AI.classifyImage = async function(imageDataUrl) {
    if (!this.classifier) return [];
    return await this.classifier(imageDataUrl);
};


// --- Módulo Principal del Juego ---
const Game = {
    state: {
        objectives: [
            { name: 'bottle', found: false },
            { name: 'cup', found: false },
            { name: 'book', found: false }
        ],
        found_items: [],
    },
    async init() {
        UI.init();
        await UI.runBootSequence(
            async () => {
                const video = document.getElementById('video-feed');
                Renderer.init(video, UI.ctx);
                await Renderer.start();
            },
            async () => {
                await AI.init();
            }
        );
        UI.updateHUD(this.state);
    },
    async scanFrame() {
        UI.logAction('Capturando y analizando fotograma...');
        UI.scanButton.disabled = true;
        const frame = Renderer.captureFrame();
        const results = (await AI.classifyImage(frame)).slice(0, 5);
        UI.displayScanResults(results);
        UI.logAction('Análisis completado. Si ves un objetivo, haz clic en él para recuperarlo.');
        UI.scanButton.disabled = false;
    },
    salvage(objective) {
        const obj = this.state.objectives.find(o => o.name === objective.name);
        if (obj && !obj.found) {
            obj.found = true;
            this.state.found_items.push(obj.name);
            UI.logAction(`OBJETIVO [${obj.name.toUpperCase()}] RECUPERADO.`);
            UI.updateHUD(this.state);
            this.checkWinCondition();
        }
    },
    checkWinCondition() {
        const allFound = this.state.objectives.every(o => o.found);
        if (allFound) {
            UI.logAction('TODOS LOS OBJETIVOS RECUPERADOS. MISIÓN CUMPLIDA, CARROÑERO.');
            UI.scanButton.disabled = true;
        }
    }
};

Game.init();

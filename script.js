// --- Módulo para la Interfaz de Usuario ---
const UI = {
    init() {
        this.bootLoader = document.getElementById('boot-loader');
        this.bootText = document.getElementById('boot-text');
        this.permissionPrompt = document.getElementById('permission-prompt');
        this.gameContainer = document.getElementById('game-container');
        this.canvas = document.getElementById('drone-canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.objectiveList = document.getElementById('objective-list');
        this.inventoryList = document.getElementById('inventory-list');
        this.scanButton = document.getElementById('scan-button');
        this.resultsList = document.getElementById('results-list');
        this.actionLog = document.getElementById('action-log').querySelector('p');
        this.scanButton.addEventListener('click', () => Game.scanFrame());
    },
    async showBootMessage(message, delay = 200) {
        this.bootText.textContent += message + '\n';
        await new Promise(r => setTimeout(r, delay));
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
        if (!results || results.length === 0) {
            this.resultsList.innerHTML = '<li>>> INTERFERENCIAS. NINGÚN OBJETO CLARO.</li>';
            return;
        }
        results.forEach(item => {
            const li = document.createElement('li');
            const confidence = Math.round(item.probability * 100);
            const label = item.className.split(',')[0];
            li.textContent = `>> ${label.toUpperCase()} (Confianza: ${confidence}%)`;

            const objective = Game.state.objectives.find(o => label.includes(o.name) && !o.found);
            if (objective && confidence > 40) {
                li.style.color = '#39ff14';
                li.style.cursor = 'pointer';
                li.addEventListener('click', () => Game.salvage(objective));
            }
            this.resultsList.appendChild(li);
        });
    },
    logAction(text) { this.actionLog.textContent = `> ${text}`; },
    showGame() {
        this.bootLoader.classList.add('hidden');
        this.gameContainer.classList.remove('hidden');
    }
};

// --- Módulo para la Cámara y el Renderizado ---
const Camera = {
    init(videoElement, canvasContext) {
        this.video = videoElement;
        this.ctx = canvasContext;
    },
    async start() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            this.video.srcObject = stream;
            await new Promise(resolve => {
                this.video.onloadedmetadata = () => {
                    this.ctx.canvas.width = this.video.videoWidth;
                    this.ctx.canvas.height = this.video.videoHeight;
                    resolve();
                };
            });
            this.renderLoop();
            return true;
        } catch (err) {
            console.error("Error accessing camera:", err);
            UI.showBootMessage(`ERROR: ${err.name}. PERMISO DENEGADO O CÁMARA NO DISPONIBLE.`);
            return false;
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
            const r = data[i], g = data[i+1], b = data[i+2];
            const avg = (r + g + b) / 3;
            data[i] = avg + 40;     // Tinte verdoso/ambar
            data[i + 1] = avg + 20;
            data[i + 2] = avg;
            const noise = (0.5 - Math.random()) * 25;
            data[i] += noise; data[i+1] += noise; data[i+2] += noise;
        }
        this.ctx.putImageData(imageData, 0, 0);
    }
};

// --- Módulo de la IA (CON TENSORFLOW.JS) ---
const AI = {
    async init() {
        try {
            this.model = await mobilenet.load();
            return true;
        } catch (error) {
            console.error("Error loading AI model:", error);
            UI.showBootMessage('SYSTEM_FAILURE: AI entity could not be loaded.');
            return false;
        }
    },
    async classifyImage(canvasElement) {
        if (!this.model) return [];
        try {
            const predictions = await this.model.classify(canvasElement);
            return predictions;
        } catch (error) {
            console.error("Error during classification:", error);
            return [];
        }
    }
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
        
        await UI.showBootMessage('R.U.S.T. OS v1.3a');
        await UI.showBootMessage('====================');
        await UI.showBootMessage('CHECKING DRONE CONNECTION...');
        
        UI.permissionPrompt.classList.remove('hidden');
        const cameraOK = await Camera.start();
        UI.permissionPrompt.classList.add('hidden');
        if (!cameraOK) return;
        
        await UI.showBootMessage('SIGNAL ACQUIRED. VISUAL FEED ESTABLISHED.');
        await UI.showBootMessage('LOADING AI COGNITIVE MODEL...');
        
        const aiOK = await AI.init();
        if (!aiOK) {
            await UI.showBootMessage('AI MODEL FAILED TO LOAD. SYSTEM DEGRADED.');
            return;
        }
        
        await UI.showBootMessage('AI MODEL LOADED. SYSTEM READY.');
        await new Promise(r => setTimeout(r, 500));
        
        UI.showGame();
        UI.updateHUD(this.state);
        UI.logAction('Dron operativo. Encuentra los objetos de la lista.');
    },
    async scanFrame() {
        UI.logAction('Analizando fotograma...');
        UI.scanButton.disabled = true;
        const results = await AI.classifyImage(UI.canvas);
        UI.displayScanResults(results);
        UI.logAction('Análisis completado. Si ves un objetivo válido, haz clic para recuperar.');
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

document.addEventListener('DOMContentLoaded', () => {
    // El video oculto lo creamos aquí para más limpieza
    const video = document.createElement('video');
    video.playsInline = true;
    video.autoplay = true;
    video.muted = true;
    video.classList.add('hidden');
    document.body.appendChild(video);

    Camera.init(video, document.getElementById('drone-canvas').getContext('2d', { willReadFrequently: true }));
    Game.init();
});

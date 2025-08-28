// Importamos las herramientas de bajo nivel que SÍ funcionan
import { AutoImageProcessor, AutoModelForImageClassification } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';

// --- Módulo para la Interfaz de Usuario (Sin cambios) ---
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
        if (results.length === 0) {
            this.resultsList.innerHTML = '<li>>> INTERFERENCIAS. NINGÚN OBJETO CLARO.</li>';
            return;
        }
        results.forEach(item => {
            const li = document.createElement('li');
            const confidence = Math.round(item.score * 100);
            li.textContent = `>> ${item.label.toUpperCase()} (Confianza: ${confidence}%)`;
            const objective = Game.state.objectives.find(o => item.label.includes(o.name) && !o.found);
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

// --- Módulo para la Cámara y el Renderizado (Sin cambios) ---
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

// --- Módulo de la IA (RECONSTRUIDO DESDE CERO) ---
const AI = {
    async init() {
        const modelPath = './models/mobilenet_v2_1.0_224';
        try {
            // Cargamos las dos piezas por separado, forzando la ruta local.
            // 1. El preprocesador (prepara la imagen)
            this.processor = await AutoImageProcessor.from_pretrained(modelPath);
            // 2. El modelo (analiza la imagen)
            this.model = await AutoModelForImageClassification.from_pretrained(modelPath);
            return true;
        } catch (error) {
            console.error("Error loading AI model:", error);
            UI.showBootMessage('SYSTEM_FAILURE: AI entity could not be loaded.');
            return false;
        }
    },
    async classifyImage(imageDataUrl) {
        if (!this.model || !this.processor) return [];
        try {
            // Usamos las piezas a mano
            const image = await this.processor(imageDataUrl);
            const output = await this.model(image);
            
            // Procesamos la salida para que sea legible
            const top5 = output.logits.topk(5);
            const results = [];
            for (let i = 0; i < top5.indices.data.length; ++i) {
                const label = this.model.config.id2label[top5.indices.data[i]];
                const score = top5.values.data[i];
                results.push({ label, score });
            }
            return results;
        } catch (error) {
            console.error("Error during classification:", error);
            return [];
        }
    }
};

// --- Módulo Principal del Juego (Sin cambios) ---
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
        UI.logAction('Capturando y analizando fotograma...');
        UI.scanButton.disabled = true;
        
        const frame = Camera.captureFrame();
        const results = await AI.classifyImage(frame);
        
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
    Camera.init(document.getElementById('video-feed'), document.getElementById('drone-canvas').getContext('2d', { willReadFrequently: true }));
    Game.init();
});

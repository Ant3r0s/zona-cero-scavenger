import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';

const UI = {
    init() {
        this.bootLoader = document.getElementById('boot-loader');
        this.bootText = document.getElementById('boot-text');
        this.gameContainer = document.getElementById('game-container');
        this.droneImage = document.getElementById('drone-image');
        this.batteryBar = document.getElementById('battery-bar');
        this.batteryPercent = document.getElementById('battery-percent');
        this.inventoryList = document.getElementById('inventory-list');
        this.scanButton = document.getElementById('scan-button');
        this.resultsList = document.getElementById('results-list');
        this.actionLog = document.getElementById('action-log').querySelector('p');

        this.scanButton.addEventListener('click', () => Game.scanLocation());
    },
    async runBootSequence(callback) {
        this.bootLoader.classList.remove('hidden');
        const lines = [
            'R.U.S.T. OS v1.3a',
            '====================',
            'CHECKING DRONE CONNECTION...',
            'SIGNAL STRENGTH: 12%',
            'WARNING: VISUAL FEED MAY BE UNSTABLE.',
            'LOADING AI COGNITIVE MODEL...',
            ''
        ];
        for (const line of lines) {
            this.bootText.textContent += line + '\n';
            await new Promise(r => setTimeout(r, 200));
        }
        await callback();
        this.bootText.textContent += 'AI MODEL LOADED. SYSTEM READY.\n';
        await new Promise(r => setTimeout(r, 1000));
        this.bootLoader.classList.add('hidden');
        this.gameContainer.classList.remove('hidden');
    },
    updateHUD(state) {
        const percent = Math.max(0, state.battery);
        this.batteryPercent.textContent = `${Math.round(percent)}%`;
        this.batteryBar.style.width = `${percent}%`;
        if (percent < 20) this.batteryBar.style.backgroundColor = '#ff4122';
        else this.batteryBar.style.backgroundColor = 'var(--text-color)';

        this.inventoryList.innerHTML = '';
        if (state.inventory.length === 0) {
            this.inventoryList.innerHTML = '<li>(Vacío)</li>';
        } else {
            state.inventory.forEach(item => {
                const li = document.createElement('li');
                li.textContent = `> ${item}`;
                this.inventoryList.appendChild(li);
            });
        }
    },
    displayScanResults(results) {
        this.resultsList.innerHTML = '';
        if (results.length === 0) {
            this.resultsList.innerHTML = '<li>>> NINGÚN OBJETO DE INTERÉS DETECTADO.</li>';
            return;
        }
        results.forEach(item => {
            const li = document.createElement('li');
            li.textContent = `>> ${item.label.toUpperCase()} (Confianza: ${Math.round(item.score * 100)}%)`;
            li.addEventListener('click', () => Game.salvage(item.label));
            this.resultsList.appendChild(li);
        });
    },
    logAction(text) {
        this.actionLog.textContent = `> ${text}`;
    },
    showLocation(location) {
        this.droneImage.src = location.image;
        this.resultsList.innerHTML = '';
    }
};

const AI = {
    async init() {
        const loaderProgress = document.getElementById('loader-progress');
        // Este es un loader de mentira, porque el modelo local es tan rápido que no da tiempo a verlo.
        // Lo dejamos para la atmósfera.
        if(loaderProgress) loaderProgress.textContent = 'WAKING UP ENTITY...';
        try {
            // ESTA ES LA LÍNEA IMPORTANTE. APUNTA A LA CARPETA LOCAL.
            this.classifier = await pipeline('image-classification', './models/mobilenet_v2_1.0_224', { quantized: true });
            return true;
        } catch (error) {
            console.error("Error loading AI model:", error);
            if(loaderProgress) loaderProgress.textContent = 'SYSTEM_FAILURE: AI entity could not be loaded.';
            return false;
        }
    },
    async classifyImage(imageUrl) {
        if (!this.classifier) return [];
        const results = await this.classifier(imageUrl);
        return results.slice(0, 5);
    }
};

const Game = {
    state: {
        battery: 100,
        inventory: [],
        currentLocation: 0
    },
    locations: [
        {
            image: 'scenes/scene1.jpg',
            items: ['botiquín', 'lata de comida', 'chatarra']
        },
    ],
    async init() {
        UI.init();
        // Usamos un loader de mentira porque el modelo local carga al instante.
        // Así mantenemos la atmósfera del arranque.
        UI.runBootSequence(async () => {
             await AI.init();
        });
        
        UI.showLocation(this.locations[this.state.currentLocation]);
        UI.updateHUD(this.state);
        setInterval(() => this.gameLoop(), 1000); 
    },
    gameLoop() {
        if (this.state.battery > 0) {
            this.state.battery -= 0.5;
            UI.updateHUD(this.state);
        } else if (!UI.scanButton.disabled) {
            UI.logAction('BATERÍA AGOTADA. DRON DESCONECTADO.');
            UI.scanButton.disabled = true;
        }
    },
    async scanLocation() {
        if (this.state.battery <= 10) {
            UI.logAction('Batería demasiado baja para escanear.');
            return;
        }
        UI.logAction('Escaneando... Consumo: 10% de batería.');
        this.state.battery -= 10;
        UI.scanButton.disabled = true;
        
        const imageUrl = this.locations[this.state.currentLocation].image;
        const results = await AI.classifyImage(imageUrl);
        
        UI.displayScanResults(results);
        UI.logAction('Análisis completado. Selecciona un objeto para intentar recuperarlo.');
        UI.updateHUD(this.state);
        UI.scanButton.disabled = false;
    },
    salvage(itemLabel) {
        UI.logAction(`Intentando recuperar ${itemLabel}...`);
        this.state.inventory.push(itemLabel.toUpperCase());
        UI.updateHUD(this.state);
    }
};

Game.init();

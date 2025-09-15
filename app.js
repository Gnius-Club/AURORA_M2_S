// A.U.R.O.R.A. Mission 2: Calibración de Secuencia
// Game State and Logic

class AuroraGame {
    constructor() {
        this.gameData = {
            mission: {
                // CAMBIO: Título de la misión actualizado
                title: "Misión 2: Calibración de Secuencia",
                subtitle: "Especialista en Operaciones de Campo - Nivel Secundaria",
                gridSize: 12,
                startPosition: {x: 0, y: 11},
                objectives: [
                    {type: "hielo", symbol: "H", x: 3, y: 8},
                    {type: "mineral", symbol: "M", x: 8, y: 4},
                    {type: "estacion", symbol: "A", x: 11, y: 0}
                ],
                hiddenTerrain: [
                    {x: 2, y: 9}, {x: 3, y: 9}, {x: 4, y: 9},
                    {x: 5, y: 7}, {x: 6, y: 7}, {x: 7, y: 7},
                    {x: 8, y: 5}, {x: 9, y: 5}, {x: 8, y: 3}
                ]
            },
            commands: [
                {id: "avanzar", name: "avanzar(pasos)", hasParam: true, paramType: "number"},
                {id: "girar", name: "girar(direccion)", hasParam: true, paramType: "text"},
                {id: "mapear", name: "mapearTerreno()", hasParam: false},
                {id: "recoger", name: "recogerMuestra(tipo)", hasParam: true, paramType: "text"},
                {id: "analizar", name: "analizarMuestras()", hasParam: false},
                {id: "enviar", name: "enviarReporte()", hasParam: false}
            ],
            scoring: {
                threeStars: 25,
                twoStars: 35,
                oneStar: 50
            }
        };

        this.gameState = {
            roverPosition: {...this.gameData.mission.startPosition},
            roverDirection: 'norte',
            revealedTerrain: [],
            collectedSamples: [],
            currentSequence: [],
            stepsUsed: 0,
            objectives: {
                mapped: false,
                ice: false,
                mineral: false,
                station: false
            },
            isExecuting: false,
            tutorialStep: 0,
            showingTutorial: true,
            // CAMBIO: Variables para el cronómetro
            elapsedSeconds: 0,
            timerInterval: null
        };

        this.audio = null;
        this.draggedCommand = null;
        this.initializeAudio();
        this.initializeGame();
    }

    // A partir de aquí, el código es el original hasta llegar a las funciones del cronómetro y el tutorial
    
    initializeAudio() {
        try {
            this.audio = {
                context: new (window.AudioContext || window.webkitAudioContext)(),
                playAmbient: () => {
                    if (!this.audio.context) return;
                    const oscillator = this.audio.context.createOscillator();
                    const gainNode = this.audio.context.createGain();
                    oscillator.connect(gainNode);
                    gainNode.connect(this.audio.context.destination);
                    oscillator.frequency.setValueAtTime(80, this.audio.context.currentTime);
                    gainNode.gain.setValueAtTime(0.1, this.audio.context.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audio.context.currentTime + 10);
                    oscillator.start();
                    oscillator.stop(this.audio.context.currentTime + 10);
                }
            };
        } catch (e) {
            console.log('Audio not available');
            this.audio = null;
        }
    }

    initializeGame() {
        this.createGrid();
        this.createCommandBlocks();
        this.setupEventListeners();
        this.updateUI();
        this.startTutorial();
    }

    createGrid() {
        const gridContainer = document.getElementById('tactical-grid');
        gridContainer.innerHTML = '';
        for (let y = 0; y < this.gameData.mission.gridSize; y++) {
            for (let x = 0; x < this.gameData.mission.gridSize; x++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.x = x;
                cell.dataset.y = y;
                const isRover = x === this.gameState.roverPosition.x && y === this.gameState.roverPosition.y;
                const objective = this.gameData.mission.objectives.find(obj => obj.x === x && obj.y === y);
                const isHidden = this.gameData.mission.hiddenTerrain.find(terrain => terrain.x === x && terrain.y === y);
                if (isRover) {
                    cell.classList.add('rover');
                    cell.textContent = 'R';
                } else if (objective) {
                    cell.classList.add('objective');
                    cell.textContent = objective.symbol;
                    if (objective.type === 'hielo') cell.classList.add('ice');
                    else if (objective.type === 'mineral') cell.classList.add('mineral');
                    else if (objective.type === 'estacion') cell.classList.add('station');
                } else if (isHidden && !this.gameState.revealedTerrain.find(pos => pos.x === x && pos.y === y)) {
                    cell.classList.add('hidden');
                    cell.textContent = '?';
                }
                gridContainer.appendChild(cell);
            }
        }
    }

    createCommandBlocks() {
        const container = document.getElementById('command-blocks');
        container.innerHTML = '';
        this.gameData.commands.forEach(command => {
            const block = document.createElement('div');
            block.className = 'command-block';
            block.textContent = command.name;
            block.dataset.commandId = command.id;
            block.dataset.hasParam = command.hasParam;
            block.dataset.paramType = command.paramType || '';
            block.draggable = true;
            container.appendChild(block);
        });
    }

    setupEventListeners() {
        this.setupDragAndDrop();
        document.getElementById('execute-btn').addEventListener('click', () => { if (!this.gameState.isExecuting && this.gameState.currentSequence.length > 0) this.executeSequence(); });
        document.getElementById('clear-sequence').addEventListener('click', () => { if (!this.gameState.isExecuting) this.clearSequence(); });
        document.getElementById('tutorial-next').addEventListener('click', () => this.nextTutorialStep());
        document.getElementById('tutorial-prev').addEventListener('click', () => this.prevTutorialStep());
        document.getElementById('tutorial-skip').addEventListener('click', () => this.endTutorial());
        document.getElementById('final-close').addEventListener('click', () => { document.getElementById('final-modal').classList.add('hidden'); });
    }

    setupDragAndDrop() {
        const commandBlocks = document.getElementById('command-blocks');
        const dropZone = document.getElementById('drop-zone');
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragenter', (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over'); });
        dropZone.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('drag-over'); if (this.draggedCommand) { this.addCommandToSequence(this.draggedCommand); this.draggedCommand = null; } });
        commandBlocks.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('command-block')) {
                e.target.classList.add('dragging');
                this.draggedCommand = { commandId: e.target.dataset.commandId, name: e.target.textContent, hasParam: e.target.dataset.hasParam === 'true', paramType: e.target.dataset.paramType };
                e.dataTransfer.setData('text/plain', JSON.stringify(this.draggedCommand));
                e.dataTransfer.effectAllowed = 'copy';
            }
        });
        commandBlocks.addEventListener('dragend', (e) => { if (e.target.classList.contains('command-block')) e.target.classList.remove('dragging'); });
        commandBlocks.addEventListener('click', (e) => { if (e.target.classList.contains('command-block')) { const commandData = { commandId: e.target.dataset.commandId, name: e.target.textContent, hasParam: e.target.dataset.hasParam === 'true', paramType: e.target.dataset.paramType }; this.addCommandToSequence(commandData); } });
    }

    addCommandToSequence(commandData) {
        const sequenceItem = { id: Date.now(), commandId: commandData.commandId, name: commandData.name, hasParam: commandData.hasParam, paramType: commandData.paramType, paramValue: commandData.hasParam ? '' : null };
        this.gameState.currentSequence.push(sequenceItem);
        this.updateSequenceDisplay();
        this.updateStepsCounter();
    }

    updateSequenceDisplay() {
        const dropZone = document.getElementById('drop-zone');
        const dropMessage = dropZone.querySelector('.drop-message');
        dropMessage.style.display = this.gameState.currentSequence.length > 0 ? 'none' : 'block';
        dropZone.querySelectorAll('.sequence-item').forEach(item => item.remove());
        this.gameState.currentSequence.forEach((item, index) => {
            const element = document.createElement('div');
            element.className = 'sequence-item';
            element.dataset.itemId = item.id;
            let content = `<span class="command-name">${item.name.split('(')[0]}</span>`;
            if (item.hasParam) {
                const paramPlaceholder = item.paramType === 'number' ? '1' : (item.paramType === 'text' ? 'norte' : 'valor');
                content += `(<input type="text" class="param-input" value="${item.paramValue || ''}" placeholder="${paramPlaceholder}">)`;
            } else { content += '()'; }
            content += `<button class="remove-btn">×</button>`;
            element.innerHTML = content;
            dropZone.appendChild(element);
            if (item.hasParam) {
                element.querySelector('.param-input').addEventListener('input', (e) => { const sequenceItem = this.gameState.currentSequence.find(seq => seq.id === item.id); if (sequenceItem) sequenceItem.paramValue = e.target.value; });
            }
            element.querySelector('.remove-btn').addEventListener('click', () => this.removeSequenceItem(item.id));
        });
    }

    removeSequenceItem(itemId) { this.gameState.currentSequence = this.gameState.currentSequence.filter(item => item.id !== itemId); this.updateSequenceDisplay(); this.updateStepsCounter(); }
    clearSequence() { this.gameState.currentSequence = []; this.updateSequenceDisplay(); this.updateStepsCounter(); }
    updateStepsCounter() { document.getElementById('steps-used').textContent = this.gameState.currentSequence.length; }

    async executeSequence() {
        if (this.gameState.currentSequence.length === 0) { this.showFeedback('No hay comandos en la secuencia', 'error'); return; }
        this.gameState.isExecuting = true;
        document.body.classList.add('executing');
        this.hideFeedback();
        this.gameState.roverPosition = {...this.gameData.mission.startPosition};
        this.gameState.roverDirection = 'norte';
        this.gameState.stepsUsed = this.gameState.currentSequence.length;
        let success = true;
        let errorMessage = '';
        for (let i = 0; i < this.gameState.currentSequence.length && success; i++) {
            const command = this.gameState.currentSequence[i];
            try { await this.executeCommand(command); await this.delay(800); } catch (error) { success = false; errorMessage = error.message; }
        }
        this.gameState.isExecuting = false;
        document.body.classList.remove('executing');
        if (success) {
            this.checkObjectives();
            this.calculateScore();
            if (this.allObjectivesComplete()) this.showSuccessMessage();
            else this.showFeedback('Secuencia ejecutada, pero faltan objetivos por completar', 'warning');
        } else {
            this.showFeedback(`Error en la ejecución: ${errorMessage}`, 'error');
            this.resetRoverPosition();
        }
        this.updateUI();
    }

    async executeCommand(command) {
        switch (command.commandId) {
            case 'avanzar': await this.executeAvanzar(command.paramValue); break;
            case 'girar': await this.executeGirar(command.paramValue); break;
            case 'mapear': await this.executeMapear(); break;
            case 'recoger': await this.executeRecoger(command.paramValue); break;
            case 'analizar': await this.executeAnalizar(); break;
            case 'enviar': await this.executeEnviar(); break;
            default: throw new Error(`Comando desconocido: ${command.commandId}`);
        }
    }

    async executeAvanzar(pasos) {
        const steps = parseInt(pasos);
        if (isNaN(steps) || steps <= 0) throw new Error('El número de pasos debe ser un número positivo');
        for (let i = 0; i < steps; i++) {
            const newPos = this.getNextPosition();
            if (newPos.x < 0 || newPos.x >= this.gameData.mission.gridSize || newPos.y < 0 || newPos.y >= this.gameData.mission.gridSize) throw new Error('El rover intentó salir del área de misión');
            const isHidden = this.gameData.mission.hiddenTerrain.find(terrain => terrain.x === newPos.x && terrain.y === newPos.y);
            const isRevealed = this.gameState.revealedTerrain.find(pos => pos.x === newPos.x && pos.y === newPos.y);
            if (isHidden && !isRevealed) throw new Error('El rover intentó entrar en terreno no mapeado');
            this.gameState.roverPosition = newPos;
            this.updateRoverPosition();
            await this.delay(400);
        }
    }

    async executeGirar(direccion) {
        const validDirections = ['norte', 'sur', 'este', 'oeste'];
        if (!validDirections.includes(direccion.toLowerCase())) throw new Error('Dirección inválida. Usa: norte, sur, este, oeste');
        this.gameState.roverDirection = direccion.toLowerCase();
        await this.delay(300);
    }

    async executeMapear() {
        const roverX = this.gameState.roverPosition.x;
        const roverY = this.gameState.roverPosition.y;
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                const x = roverX + dx;
                const y = roverY + dy;
                if (x >= 0 && x < this.gameData.mission.gridSize && y >= 0 && y < this.gameData.mission.gridSize) {
                    const isHidden = this.gameData.mission.hiddenTerrain.find(terrain => terrain.x === x && terrain.y === y);
                    if (isHidden && !this.gameState.revealedTerrain.find(pos => pos.x === x && pos.y === y)) this.gameState.revealedTerrain.push({x, y});
                }
            }
        }
        this.gameState.objectives.mapped = true;
        this.createGrid();
        await this.delay(500);
    }

    async executeRecoger(tipo) {
        const roverPos = this.gameState.roverPosition;
        const objective = this.gameData.mission.objectives.find(obj => obj.x === roverPos.x && obj.y === roverPos.y);
        if (!objective) throw new Error('No hay nada que recoger en esta posición');
        if (tipo.toLowerCase() !== objective.type) throw new Error(`Se esperaba recoger "${objective.type}" pero se intentó recoger "${tipo}"`);
        if (!this.gameState.collectedSamples.includes(tipo.toLowerCase())) {
            this.gameState.collectedSamples.push(tipo.toLowerCase());
            if (tipo.toLowerCase() === 'hielo') this.gameState.objectives.ice = true;
            else if (tipo.toLowerCase() === 'mineral') this.gameState.objectives.mineral = true;
        }
        await this.delay(500);
    }

    async executeAnalizar() { if (this.gameState.collectedSamples.length === 0) throw new Error('No hay muestras para analizar'); await this.delay(500); }
    async executeEnviar() {
        const roverPos = this.gameState.roverPosition;
        const station = this.gameData.mission.objectives.find(obj => obj.type === 'estacion');
        if (roverPos.x === station.x && roverPos.y === station.y) this.gameState.objectives.station = true;
        await this.delay(500);
    }

    getNextPosition() {
        const current = this.gameState.roverPosition;
        switch (this.gameState.roverDirection) {
            case 'norte': return {x: current.x, y: current.y - 1};
            case 'sur': return {x: current.x, y: current.y + 1};
            case 'este': return {x: current.x + 1, y: current.y};
            case 'oeste': return {x: current.x - 1, y: current.y};
            default: return current;
        }
    }

    updateRoverPosition() { this.createGrid(); }
    resetRoverPosition() { this.gameState.roverPosition = {...this.gameData.mission.startPosition}; this.gameState.roverDirection = 'norte'; this.createGrid(); }
    checkObjectives() {
        const objectives = ['obj-map', 'obj-ice', 'obj-mineral', 'obj-station'];
        const states = [this.gameState.objectives.mapped, this.gameState.objectives.ice, this.gameState.objectives.mineral, this.gameState.objectives.station];
        objectives.forEach((id, index) => {
            const element = document.getElementById(id);
            if (states[index]) { element.classList.add('completed'); element.querySelector('.objective-status').textContent = '●'; }
        });
    }
    calculateScore() {
        const steps = this.gameState.stepsUsed;
        const stars = document.querySelectorAll('#efficiency-stars .star');
        stars.forEach(star => star.classList.remove('filled'));
        let starCount = 0;
        if (steps <= this.gameData.scoring.threeStars) starCount = 3;
        else if (steps <= this.gameData.scoring.twoStars) starCount = 2;
        else if (steps <= this.gameData.scoring.oneStar) starCount = 1;
        for (let i = 0; i < starCount; i++) stars[i].classList.add('filled');
    }

    allObjectivesComplete() { return this.gameState.objectives.mapped && this.gameState.objectives.ice && this.gameState.objectives.mineral && this.gameState.objectives.station; }
    
    showSuccessMessage() {
        const steps = this.gameState.stepsUsed;
        const isOptimal = steps <= this.gameData.scoring.threeStars;
        
        // CAMBIO: Detener el cronómetro al completar la misión con éxito.
        this.stopTimer();

        if (isOptimal) this.showFinalMessage();
        else this.showFeedback('¡Misión completada! Intenta optimizar tu solución para obtener 3 estrellas.', 'success');
    }

    showFinalMessage() {
        const modal = document.getElementById('final-modal');
        const messageElement = document.getElementById('final-message-text');
        messageElement.textContent = "Lo has conseguido, Cadete. La secuencia es perfecta. A.U.R.O.R.A. ha ejecutado las órdenes sin fallos, ha recolectado la muestra de hielo y ahora se dirige a la zona segura para transmitir su análisis. Los datos que acaba de enviar cambiarán el futuro de la exploración espacial.\n\nHoy no solo has salvado un rover de mil millones de dólares. Has demostrado tener la mente analítica, la paciencia y la resolución de problemas de un verdadero/a ingeniero/a. Has convertido el caos en orden y el fracaso en un éxito histórico. La Academia y el mundo te dan las gracias. Misión cumplida.";
        modal.classList.remove('hidden');
        if (this.audio) this.audio.playAmbient();
    }

    showFeedback(message, type = 'error') { const feedbackElement = document.getElementById('feedback-message'); feedbackElement.textContent = message; feedbackElement.className = `feedback-message ${type === 'success' ? 'success' : ''}`; feedbackElement.classList.remove('hidden'); }
    hideFeedback() { document.getElementById('feedback-message').classList.add('hidden'); }
    updateUI() { this.updateStepsCounter(); this.checkObjectives(); this.calculateScore(); }
    delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
    
    // CAMBIO: Nuevas funciones para manejar el cronómetro
    startTimer() {
        if (this.timerInterval) return; // Evita iniciar múltiples timers
        this.timerInterval = setInterval(() => {
            this.gameState.elapsedSeconds++;
            this.updateTimerDisplay();
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimerDisplay() {
        const timerElement = document.getElementById('mission-timer');
        if (!timerElement) return;
        const minutes = Math.floor(this.gameState.elapsedSeconds / 60);
        const seconds = this.gameState.elapsedSeconds % 60;
        timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    // Tutorial System
    startTutorial() { this.gameState.tutorialStep = 0; this.showTutorialStep(); }

    showTutorialStep() {
        // CAMBIO: Se ha corregido el texto del primer paso del tutorial para que sea más inmersivo
        const tutorialSteps = [
            {
                title: "Nueva Misión: Calibración de Secuencia",
                description: "Especialista, esta misión es más compleja. Te enfrentarás a terreno desconocido que deberás mapear antes de cruzar. Además, tu eficiencia será clave: el sistema medirá cada paso que des. ¡Planifica con cuidado para obtener la máxima puntuación!",
                highlight: "header"
            },
            {
                title: "Terreno Oculto",
                description: "¡Cuidado! Hay zonas desconocidas (?). Usa el comando mapearTerreno() para revelar el mapa antes de avanzar.",
                highlight: "tactical-map"
            },
            {
                title: "Objetivos Múltiples",
                description: "Debes recolectar el Hielo (H), luego el Mineral (M), y finalmente llevar todo a la Estación de Análisis (A).",
                highlight: "tactical-map"
            },
            {
                title: "Comandos Parametrizados",
                description: "El comando recogerMuestra(tipo) necesita que especifiques qué recoger. Escribe 'hielo' o 'mineral' dentro del paréntesis.",
                highlight: "command-bank"
            },
            {
                title: "Sistema de Eficiencia",
                description: "Tu eficiencia será calificada. Menos pasos equivalen a una mejor puntuación. ¡Busca la ruta óptima de ★★★!",
                highlight: "status-panel"
            },
            {
                title: "Interfaz Responsiva",
                description: "En dispositivos móviles, tu secuenciador y panel de estado estarán en la parte inferior para un control más cómodo.",
                highlight: "main-content"
            },
            {
                title: "¡A Optimizar!",
                description: "¡ENTENDIDO, A OPTIMIZAR! Comienza tu planificación estratégica.",
                highlight: "sequencer"
            }
        ];
        const step = tutorialSteps[this.gameState.tutorialStep];
        document.getElementById('tutorial-title').textContent = this.gameState.tutorialStep === 0 ? step.title : `Tutorial - Paso ${this.gameState.tutorialStep + 1}/${tutorialSteps.length}`;
        document.getElementById('tutorial-description').textContent = step.description;
        document.getElementById('tutorial-prev').disabled = this.gameState.tutorialStep === 0;
        document.getElementById('tutorial-next').textContent = this.gameState.tutorialStep === tutorialSteps.length - 1 ? 'Finalizar' : 'Siguiente →';
        this.clearHighlights();
        if (step.highlight) { const element = document.getElementById(step.highlight) || document.querySelector(`.${step.highlight}`); if (element) element.classList.add('highlight'); }
    }

    nextTutorialStep() {
        if (this.gameState.tutorialStep < 6) {
            this.gameState.tutorialStep++;
            this.showTutorialStep();
        } else {
            this.endTutorial();
        }
    }

    prevTutorialStep() {
        if (this.gameState.tutorialStep > 0) {
            this.gameState.tutorialStep--;
            this.showTutorialStep();
        }
    }

    endTutorial() {
        this.clearHighlights();
        document.getElementById('tutorial-modal').classList.add('hidden');
        this.gameState.showingTutorial = false;
        document.getElementById('connection-status').classList.add('active');
        document.getElementById('mission-status').classList.add('active');
        // CAMBIO: Inicia el cronómetro cuando el tutorial termina.
        this.startTimer();
    }

    clearHighlights() {
        document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.game = new AuroraGame();
});

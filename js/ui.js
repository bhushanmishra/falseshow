// UI management and game controller

class GameController {
    constructor() {
        this.multiplayer = new MultiplayerManager();
        this.gameEngine = new GameEngine();
        this.myPlayerId = this.multiplayer.myId;
        this.isInLobby = true;

        this.initializeFromURL();
        this.setupEventHandlers();
        this.setupMultiplayerCallbacks();
        this.initializeUI();
    }

    initializeFromURL() {
        const params = new URLSearchParams(window.location.search);
        const action = params.get('action');
        const playerName = params.get('name') || 'Player';

        this.multiplayer.playerInfo.name = playerName;

        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
            if (action === 'create') {
                const maxPlayers = parseInt(params.get('maxPlayers')) || 6;
                const scoreLimit = parseInt(params.get('scoreLimit')) || 100;
                const isPublic = params.get('public') === 'true';

                this.createRoom({ maxPlayers, scoreLimit, isPublic });
            } else if (action === 'join') {
                const roomCode = params.get('room');
                if (roomCode) {
                    this.joinRoom(roomCode);
                }
            } else if (action === 'quick') {
                this.quickPlay();
            }
        }, 100);
    }

    async createRoom(settings) {
        // Always generate and show room code immediately
        const roomCode = this.multiplayer.generateRoomCode();
        this.multiplayer.roomCode = roomCode;
        this.updateRoomCode(roomCode);
        this.showLobby();

        try {
            // Try to set up P2P connection
            await this.multiplayer.createRoom(settings);
            this.updateConnectionStatus('connected');
            console.log('P2P room created with code:', roomCode);
        } catch (error) {
            console.warn('P2P setup failed, but room code is:', roomCode);
            // P2P might fail but room code still works for display
            this.updateConnectionStatus('connecting');
        }
    }

    async joinRoom(roomCode) {
        try {
            await this.multiplayer.joinRoom(roomCode);
            this.updateRoomCode(roomCode);
            this.showLobby();
            this.updateConnectionStatus('connected');
        } catch (error) {
            console.error('Failed to join room:', error);
            this.showError('Failed to join room. Check the code and try again.');
        }
    }

    async quickPlay() {
        // For now, create a public room
        this.createRoom({ maxPlayers: 6, scoreLimit: 100, isPublic: true });
    }

    setupEventHandlers() {
        // Lobby events
        document.getElementById('startGameBtn')?.addEventListener('click', () => this.startGame());
        document.getElementById('leaveLobbyBtn')?.addEventListener('click', () => this.leaveGame());
        document.getElementById('copyLobbyCode')?.addEventListener('click', () => this.copyRoomCode());

        // Game events
        document.getElementById('leaveBtn')?.addEventListener('click', () => this.leaveGame());
        document.getElementById('copyCode')?.addEventListener('click', () => this.copyRoomCode());
        document.getElementById('playBtn')?.addEventListener('click', () => this.playSelectedCards());
        document.getElementById('drawBtn')?.addEventListener('click', () => this.drawCard());
        document.getElementById('showBtn')?.addEventListener('click', () => this.showCallDialog());
        document.getElementById('confirmShow')?.addEventListener('click', () => this.callShow());
        document.getElementById('cancelShow')?.addEventListener('click', () => this.hideShowDialog());

        // Chat events
        document.getElementById('chatBtn')?.addEventListener('click', () => this.toggleChat());
        document.getElementById('closeChat')?.addEventListener('click', () => this.toggleChat());
        document.getElementById('sendChat')?.addEventListener('click', () => this.sendMessage());
        document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Emoji buttons
        document.querySelectorAll('.emoji-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.multiplayer.sendEmoji(e.target.textContent);
            });
        });

        // Sound toggle
        document.getElementById('soundBtn')?.addEventListener('click', () => this.toggleSound());

        // Game over events
        document.getElementById('playAgainBtn')?.addEventListener('click', () => this.playAgain());
        document.getElementById('returnHomeBtn')?.addEventListener('click', () => this.returnHome());
    }

    setupMultiplayerCallbacks() {
        // Override multiplayer callbacks
        this.multiplayer.onPeerUpdate = () => this.updatePlayersList();
        this.multiplayer.onSettingsUpdate = () => this.updateRoomSettings();
        this.multiplayer.onGameStart = (state) => this.handleGameStart(state);
        this.multiplayer.onGameStateReceived = (state) => this.syncGameState(state);
        this.multiplayer.onGameActionReceived = (action, peerId) => this.handleGameAction(action, peerId);
        this.multiplayer.onChatReceived = (message) => this.displayChatMessage(message);
    }

    initializeUI() {
        this.updateConnectionStatus('connecting');
    }

    updateRoomCode(code) {
        // Update all room code displays
        const roomCodeEl = document.getElementById('roomCode');
        const lobbyCodeEl = document.getElementById('lobbyCode');

        if (roomCodeEl) roomCodeEl.textContent = code || '------';
        if (lobbyCodeEl) lobbyCodeEl.textContent = code || '------';

        console.log('Room code updated to:', code);
    }

    showLobby() {
        const overlay = document.getElementById('lobbyOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
        this.isInLobby = true;
        this.updatePlayersList();
    }

    hideLobby() {
        const overlay = document.getElementById('lobbyOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
        this.isInLobby = false;
    }

    updatePlayersList() {
        const playersList = document.getElementById('playersList');
        const playerCount = document.getElementById('playerCount');

        if (!playersList) return;

        const allPlayers = this.multiplayer.getAllPlayers();
        playersList.innerHTML = '';

        allPlayers.forEach(player => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${player.avatar} ${player.name}</span>
                ${player.ready ? '<span class="player-ready">✓ Ready</span>' : ''}
            `;
            playersList.appendChild(li);
        });

        if (playerCount) {
            playerCount.textContent = allPlayers.length;
        }

        // Update start button
        const startBtn = document.getElementById('startGameBtn');
        if (startBtn && this.multiplayer.isHost) {
            const canStart = allPlayers.length >= 4;
            startBtn.disabled = !canStart;
            startBtn.textContent = canStart ?
                'Start Game' :
                `Need ${4 - allPlayers.length} more player${4 - allPlayers.length > 1 ? 's' : ''}`;
        }
    }

    updateRoomSettings() {
        if (!this.multiplayer.roomSettings) return;

        const scoreLimitDisplay = document.getElementById('scoreLimitDisplay');
        const roomTypeDisplay = document.getElementById('roomTypeDisplay');

        if (scoreLimitDisplay) {
            scoreLimitDisplay.textContent = this.multiplayer.roomSettings.scoreLimit;
        }
        if (roomTypeDisplay) {
            roomTypeDisplay.textContent = this.multiplayer.roomSettings.isPublic ? 'Public' : 'Private';
        }
    }

    startGame() {
        if (this.multiplayer.startGame()) {
            this.hideLobby();
        }
    }

    handleGameStart(state) {
        this.hideLobby();

        // Initialize game engine with players
        this.gameEngine.initialize(state.players, state.settings);

        // Start first round
        const roundState = this.gameEngine.startNewRound();

        // If we're host, sync the initial state
        if (this.multiplayer.isHost) {
            this.multiplayer.sendGameState(this.gameEngine.serialize());
        }

        this.updateGameUI();
    }

    syncGameState(state) {
        this.gameEngine.deserialize(state);
        this.updateGameUI();
    }

    handleGameAction(action, peerId) {
        switch (action.type) {
            case 'playCards':
                this.handleOpponentPlay(action.data, peerId);
                break;
            case 'drawCard':
                this.handleOpponentDraw(peerId);
                break;
            case 'callShow':
                this.handleOpponentShow(peerId);
                break;
        }
    }

    updateGameUI() {
        this.updateOpponentsDisplay();
        this.updatePlayArea();
        this.updatePlayerHand();
        this.updateActionButtons();
        this.updateTurnIndicator();
    }

    updateOpponentsDisplay() {
        const opponentSlots = document.getElementById('opponentSlots');
        if (!opponentSlots) return;

        opponentSlots.innerHTML = '';

        this.gameEngine.players.forEach(player => {
            if (player.id === this.myPlayerId) return;

            const slot = document.createElement('div');
            slot.className = `opponent-slot ${player.isEliminated ? 'eliminated' : ''} ${
                this.gameEngine.getCurrentPlayer()?.id === player.id ? 'active' : ''
            }`;
            slot.innerHTML = `
                <div class="opponent-avatar">${player.avatar}</div>
                <div class="opponent-name">${player.name}</div>
                <div class="opponent-score">Score: ${player.score}</div>
                <div class="opponent-cards">
                    ${Array(player.hand.size()).fill('<div class="mini-card"></div>').join('')}
                </div>
            `;
            opponentSlots.appendChild(slot);
        });
    }

    updatePlayArea() {
        const playedCards = document.getElementById('playedCards');
        const deckCount = document.querySelector('.deck-count');

        if (this.gameEngine.lastPlay && this.gameEngine.lastPlay.cards.length > 0) {
            const cardsHTML = this.gameEngine.lastPlay.cards.map(card => card.toHTML()).join('');
            playedCards.innerHTML = `<div class="play-zone">${cardsHTML}</div>`;
        }

        if (deckCount) {
            deckCount.textContent = this.gameEngine.deck.cardsRemaining();
        }

        // Show joker indicator
        if (this.gameEngine.jokerCard) {
            // Could add a joker indicator to the UI
        }
    }

    updatePlayerHand() {
        const playerHand = document.getElementById('playerHand');
        const myPlayer = this.gameEngine.players.find(p => p.id === this.myPlayerId);

        if (!playerHand || !myPlayer) return;

        playerHand.innerHTML = '';

        myPlayer.hand.cards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.innerHTML = card.toHTML();
            const cardDiv = cardElement.firstElementChild;

            cardDiv.addEventListener('click', () => {
                myPlayer.hand.toggleCardSelection(card.id);
                cardDiv.classList.toggle('selected');
                this.updateActionButtons();
            });

            if (myPlayer.hand.selectedCards.has(card.id)) {
                cardDiv.classList.add('selected');
            }

            playerHand.appendChild(cardDiv);
        });

        // Update player score
        document.getElementById('playerScore').textContent = myPlayer.score;
    }

    updateActionButtons() {
        const playBtn = document.getElementById('playBtn');
        const drawBtn = document.getElementById('drawBtn');
        const showBtn = document.getElementById('showBtn');

        const myPlayer = this.gameEngine.players.find(p => p.id === this.myPlayerId);
        const isMyTurn = this.gameEngine.getCurrentPlayer()?.id === this.myPlayerId;

        if (playBtn) {
            playBtn.disabled = !isMyTurn || myPlayer.hand.getSelectedCards().length === 0;
        }

        if (drawBtn) {
            drawBtn.disabled = !isMyTurn || this.gameEngine.deck.isEmpty();
        }

        if (showBtn) {
            showBtn.disabled = myPlayer.isEliminated;
        }
    }

    updateTurnIndicator() {
        const turnIndicator = document.getElementById('turnIndicator');
        const gameStatus = document.getElementById('gameStatus');

        const currentPlayer = this.gameEngine.getCurrentPlayer();

        if (turnIndicator && currentPlayer) {
            const isMyTurn = currentPlayer.id === this.myPlayerId;
            turnIndicator.innerHTML = `
                <span class="turn-text">${isMyTurn ? 'Your Turn' : `${currentPlayer.name}'s Turn`}</span>
            `;
        }

        if (gameStatus) {
            if (this.gameEngine.gameState === 'playing') {
                gameStatus.textContent = `Round ${this.gameEngine.roundNumber}`;
            } else if (this.gameEngine.gameState === 'roundEnd') {
                gameStatus.textContent = 'Round Complete';
            } else if (this.gameEngine.gameState === 'gameOver') {
                gameStatus.textContent = 'Game Over';
            }
        }
    }

    playSelectedCards() {
        const myPlayer = this.gameEngine.players.find(p => p.id === this.myPlayerId);
        if (!myPlayer) return;

        const selectedCards = myPlayer.hand.getSelectedCards();
        if (selectedCards.length === 0) return;

        const result = this.gameEngine.playCards(this.myPlayerId, selectedCards);

        if (result.success) {
            // Send action to other players
            this.multiplayer.sendGameAction({
                type: 'playCards',
                data: {
                    cards: selectedCards.map(c => ({ suit: c.suit, rank: c.rank })),
                    result
                }
            });

            // Clear selection
            myPlayer.hand.clearSelection();

            // Update UI
            this.updateGameUI();

            // If host, sync game state
            if (this.multiplayer.isHost) {
                this.multiplayer.sendGameState(this.gameEngine.serialize());
            }
        } else {
            this.showError(result.error);
        }
    }

    drawCard() {
        // Drawing is handled automatically after unsafe plays
        // This button could be for special cases
    }

    showCallDialog() {
        const modal = document.getElementById('showModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    hideShowDialog() {
        const modal = document.getElementById('showModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    callShow() {
        this.hideShowDialog();

        const result = this.gameEngine.callShow(this.myPlayerId);

        if (result.success) {
            // Send to other players
            this.multiplayer.sendGameAction({
                type: 'callShow',
                data: result
            });

            // Show results
            this.showRoundResults(result);

            // If host, sync game state
            if (this.multiplayer.isHost) {
                this.multiplayer.sendGameState(this.gameEngine.serialize());
            }
        }
    }

    showRoundResults(result) {
        // Could show a detailed results modal
        this.updateGameUI();

        if (result.gameOver) {
            this.showGameOver(result.winner);
        }
    }

    showGameOver(winner) {
        const modal = document.getElementById('gameOverModal');
        const winnerName = document.getElementById('winnerName');
        const finalScores = document.getElementById('finalScores');

        if (winnerName) {
            winnerName.textContent = winner.name;
        }

        if (finalScores) {
            const scores = this.gameEngine.players
                .sort((a, b) => a.score - b.score)
                .map(p => `<div>${p.avatar} ${p.name}: ${p.score}</div>`)
                .join('');
            finalScores.innerHTML = scores;
        }

        if (modal) {
            modal.style.display = 'block';
        }
    }

    toggleChat() {
        const chatPanel = document.getElementById('chatPanel');
        if (chatPanel) {
            chatPanel.classList.toggle('open');
        }
    }

    sendMessage() {
        const input = document.getElementById('chatInput');
        if (!input || !input.value.trim()) return;

        this.multiplayer.sendChatMessage(input.value);
        input.value = '';
    }

    displayChatMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';

        if (message.type === 'emoji') {
            messageDiv.innerHTML = `
                <div class="message-author">${message.playerName}</div>
                <div class="message-emoji">${message.text}</div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-author">${message.playerName}</div>
                <div class="message-text">${message.text}</div>
            `;
        }

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Show notification if chat is closed
        if (!document.getElementById('chatPanel').classList.contains('open')) {
            // Could add a notification badge
        }
    }

    toggleSound() {
        // Toggle sound effects
        const btn = document.getElementById('soundBtn');
        if (btn) {
            const isMuted = btn.textContent === '🔇';
            btn.textContent = isMuted ? '🔊' : '🔇';
            // Store preference
            localStorage.setItem('soundMuted', !isMuted);
        }
    }

    copyRoomCode() {
        const code = this.multiplayer.roomCode;
        console.log('Copying room code:', code);
        if (code && code !== '------') {
            navigator.clipboard.writeText(code);
            this.showSuccess(`Room code ${code} copied!`);
        } else {
            this.showError('No room code to copy');
        }
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) return;

        statusElement.className = `connection-status ${status}`;
        const statusText = statusElement.querySelector('.status-text');

        switch (status) {
            case 'connected':
                statusText.textContent = 'Connected';
                break;
            case 'connecting':
                statusText.textContent = 'Connecting...';
                break;
            case 'disconnected':
                statusText.textContent = 'Disconnected';
                break;
        }
    }

    leaveGame() {
        this.multiplayer.leaveRoom();
        window.location.href = '/';
    }

    playAgain() {
        // Reset game and return to lobby
        this.gameEngine = new GameEngine();
        this.showLobby();
        document.getElementById('gameOverModal').style.display = 'none';
    }

    returnHome() {
        this.leaveGame();
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? 'var(--danger)' : 'var(--accent)'};
            color: white;
            padding: 1rem 2rem;
            border-radius: 25px;
            z-index: 3000;
            animation: slideUp 0.3s ease-out;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Export for use
window.GameController = GameController;
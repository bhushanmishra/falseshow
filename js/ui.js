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

        //console.log('Action from URL:', action);

        // Process action immediately since DOM is ready
        if (action === 'create') {
            const maxPlayers = parseInt(params.get('maxPlayers')) || 6;
            const scoreLimit = parseInt(params.get('scoreLimit')) || 100;
            const isPublic = params.get('public') === 'true';
            const aiPlayers = params.get('aiPlayers') === 'true';

            //console.log('Creating room with settings:', { maxPlayers, scoreLimit, isPublic, aiPlayers });
            this.createRoom({ maxPlayers, scoreLimit, isPublic, aiPlayers });
        } else if (action === 'join') {
            const roomCode = params.get('room');
            if (roomCode) {
                //console.log('Joining room:', roomCode);
                this.joinRoom(roomCode);
            }
        } else if (action === 'quick') {
            //console.log('Quick play');
            this.quickPlay();
        }
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
            //console.log('P2P room created with code:', roomCode);
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

        //console.log('Room code updated to:', code);
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

        // Update start button - allow 2+ players
        const startBtn = document.getElementById('startGameBtn');
        if (startBtn && this.multiplayer.isHost) {
            const canStart = allPlayers.length >= 2;  // Changed from 4 to 2
            startBtn.disabled = !canStart;
            startBtn.textContent = canStart ?
                'Start Game' :
                'Need at least 2 players';
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

        // Add AI players if enabled and needed
        let players = [...state.players];
        if (state.settings && state.settings.aiPlayers && this.multiplayer.isHost) {
            const maxPlayers = state.settings.maxPlayers || 4;
            const currentPlayers = players.length;
            const aiCount = Math.min(maxPlayers - currentPlayers, maxPlayers - 1); // At least 1 human

            for (let i = 0; i < aiCount; i++) {
                const aiPlayer = {
                    id: `ai-player-${i + 1}`,
                    name: `Robot ${i + 1}`,
                    avatar: '🤖',
                    score: 0,
                    isAI: true
                };
                players.push(aiPlayer);
            }

            // Initialize AI players
            this.aiPlayers = [];
            for (let i = 0; i < aiCount; i++) {
                this.aiPlayers.push({
                    id: `ai-player-${i + 1}`,
                    controller: new AIPlayer('medium')
                });
            }
        }

        // Initialize game engine with all players (human + AI)
        this.gameEngine.initialize(players, state.settings);

        // Start first round
        const roundState = this.gameEngine.startNewRound();

        // Show game started message
        const gameStatus = document.getElementById('gameStatus');
        if (gameStatus) {
            gameStatus.textContent = `Round 1 Started - ${this.gameEngine.jokerCard ? 'Joker Selected' : 'Setting up...'}`;
        }

        // Save game state to localStorage
        this.saveGameState();

        // If we're host, sync the initial state
        if (this.multiplayer.isHost) {
            this.multiplayer.sendGameState(this.gameEngine.serialize());
        }

        // Force UI update with a small delay to ensure DOM is ready
        this.updateGameUI();
        setTimeout(() => this.updateGameUI(), 100);
    }

    saveGameState() {
        if (this.gameEngine && this.multiplayer.roomCode) {
            const gameData = {
                roomCode: this.multiplayer.roomCode,
                playerId: this.myPlayerId,
                gameState: this.gameEngine.serialize(),
                timestamp: Date.now()
            };
            localStorage.setItem('falseshow_game', JSON.stringify(gameData));
        }
    }

    loadGameState() {
        const savedData = localStorage.getItem('falseshow_game');
        if (savedData) {
            try {
                const gameData = JSON.parse(savedData);
                // Check if saved game is less than 1 hour old
                if (Date.now() - gameData.timestamp < 3600000) {
                    return gameData;
                }
            } catch (e) {
                // Invalid data
            }
        }
        return null;
    }

    syncGameState(state) {
        this.gameEngine.deserialize(state);
        this.updateGameUI();
        // Save synced state
        this.saveGameState();
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

        // Check if it's an AI player's turn
        this.checkAITurn();
    }

    async checkAITurn() {
        if (!this.multiplayer.isHost || !this.aiPlayers || this.gameEngine.gameState !== 'playing') {
            return;
        }

        const currentPlayer = this.gameEngine.getCurrentPlayer();
        if (!currentPlayer) return;

        // Check if current player is AI
        const aiPlayer = this.aiPlayers?.find(ai => ai.id === currentPlayer.id);
        if (!aiPlayer) return;

        // Prevent multiple AI actions
        if (this.aiProcessing) return;
        this.aiProcessing = true;

        try {
            // Get AI player's hand
            const aiHand = currentPlayer.hand;

            // Let AI make decision
            const decision = await aiPlayer.controller.makePlay(
                this.gameEngine.getGameState(),
                aiHand,
                this.gameEngine.jokerCard
            );

            if (decision.action === 'show') {
                // AI calls Show
                const result = this.gameEngine.callShow(currentPlayer.id);

                // Broadcast the action
                this.multiplayer.sendGameAction({
                    type: 'callShow',
                    data: { result }
                });

                if (result.success) {
                    this.showRoundResults(result);
                }
            } else if (decision.action === 'play' && decision.cards) {
                // AI plays cards
                const result = this.gameEngine.playCards(currentPlayer.id, decision.cards);

                if (result.success) {
                    // Check if penalty needed
                    if (result.needsPenalty) {
                        // AI chooses penalty
                        const penaltyChoice = aiPlayer.controller.choosePenalty(
                            this.gameEngine.getGameState(),
                            aiHand
                        );
                        this.gameEngine.handlePenaltyChoice(currentPlayer.id, penaltyChoice);
                    }

                    // Broadcast the action
                    this.multiplayer.sendGameAction({
                        type: 'playCards',
                        data: {
                            cards: decision.cards.map(c => ({ suit: c.suit, rank: c.rank })),
                            result
                        }
                    });
                }
            }

            // Sync game state
            if (this.multiplayer.isHost) {
                this.multiplayer.sendGameState(this.gameEngine.serialize());
            }

            // Update UI
            this.updateGameUI();
        } catch (error) {
            console.error('AI error:', error);
        } finally {
            this.aiProcessing = false;
        }
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

        if (!playedCards) return;

        let displayHTML = '<div class="play-zone" style="display: flex; gap: 2rem; justify-content: center; align-items: center; flex-wrap: wrap;">';

        // Show initial card if available
        if (this.gameEngine && this.gameEngine.initialCard && this.gameEngine.initialCard.toHTML) {
            displayHTML += `
                <div style="text-align: center;">
                    <div style="color: #666; font-size: 0.8rem; margin-bottom: 0.5rem;">INITIAL CARD</div>
                    <div style="opacity: 0.7;">${this.gameEngine.initialCard.toHTML()}</div>
                </div>`;
        }

        // Show arrow between cards if there's both initial and last play
        if (this.gameEngine && this.gameEngine.initialCard && this.gameEngine.lastPlay &&
            this.gameEngine.lastPlay.playerId !== 'dealer') {
            displayHTML += '<div style="font-size: 2rem; color: #888;">→</div>';
        }

        // Show last played cards
        if (this.gameEngine && this.gameEngine.lastPlay && this.gameEngine.lastPlay.cards && this.gameEngine.lastPlay.cards.length > 0) {
            try {
                const cardsHTML = this.gameEngine.lastPlay.cards
                    .filter(card => card && card.toHTML)
                    .map(card => card.toHTML())
                    .join('');

                const playerName = this.gameEngine.lastPlay.playerName || 'Unknown';
                const playType = this.gameEngine.lastPlay.type || 'play';
                const isSafe = this.gameEngine.lastPlay.isSafe;

                // Only show last play if it's not the initial card
                if (this.gameEngine.lastPlay.playerId !== 'dealer') {
                    displayHTML += `
                        <div style="text-align: center;">
                            <div style="color: #888; font-size: 0.9rem; margin-bottom: 0.5rem;">
                                <strong>${playerName}</strong> - ${playType}
                                ${isSafe !== undefined ? (isSafe ? '<span style="color: #10b981;"> ✓</span>' : '<span style="color: #ef4444;"> ✗ +1</span>') : ''}
                            </div>
                            <div>${cardsHTML}</div>
                        </div>`;
                }
            } catch (e) {
                // Silent fail
            }
        }

        displayHTML += '</div>';
        playedCards.innerHTML = displayHTML;

        if (deckCount && this.gameEngine && this.gameEngine.deck) {
            deckCount.textContent = this.gameEngine.deck.cardsRemaining();
        }

        // Show joker indicator - make it more prominent
        if (this.gameEngine && this.gameEngine.jokerCard && this.gameEngine.jokerCard.toHTML) {
            // Remove existing joker display
            const existingJoker = document.querySelector('.joker-indicator');
            if (existingJoker) {
                existingJoker.remove();
            }

            // Create new joker display
            const jokerInfo = document.createElement('div');
            jokerInfo.className = 'joker-indicator';
            jokerInfo.innerHTML = `
                <div style="text-align: center;">
                    <div style="color: #ff3e3e; font-weight: bold; font-size: 1rem; margin-bottom: 0.5rem;">🃏 JOKER (0 pts)</div>
                    ${this.gameEngine.jokerCard.toHTML()}
                </div>`;
            jokerInfo.style.cssText = `
                position: fixed;
                top: 100px;
                right: 20px;
                background: linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.95));
                padding: 15px;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 500;
                border: 2px solid #ff3e3e;
            `;

            document.body.appendChild(jokerInfo);
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

        // Check if player has only joker left
        const hasOnlyJoker = myPlayer &&
            myPlayer.hand.size() === 1 &&
            myPlayer.hand.hasJoker(this.gameEngine.jokerCard);

        if (hasOnlyJoker && isMyTurn) {
            // Force player to either call Show or play the joker (discard and draw)
            if (playBtn) {
                // Can play only if joker is selected
                const selectedCards = myPlayer.hand.getSelectedCards();
                playBtn.disabled = selectedCards.length === 0 ||
                    !selectedCards[0].equals(this.gameEngine.jokerCard);
            }

            if (drawBtn) {
                drawBtn.disabled = true; // Cannot just draw without discarding joker
            }

            if (showBtn) {
                showBtn.disabled = false; // Can always call Show with joker
            }

            // Show warning message
            const gameStatus = document.getElementById('gameStatus');
            if (gameStatus) {
                gameStatus.textContent = 'You have only the Joker! You must call "Show!" or discard it and draw.';
                gameStatus.style.color = '#ff3e3e';
            }
        } else {
            // Normal rules
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
    }

    updateTurnIndicator() {
        const turnIndicator = document.getElementById('turnIndicator');
        const gameStatus = document.getElementById('gameStatus');

        const currentPlayer = this.gameEngine.getCurrentPlayer();

        if (turnIndicator && currentPlayer) {
            const isMyTurn = currentPlayer.id === this.myPlayerId;
            turnIndicator.className = `turn-indicator ${isMyTurn ? 'my-turn' : ''}`;
            turnIndicator.innerHTML = `
                <span class="turn-text">${isMyTurn ? '🎯 YOUR TURN!' : `⏳ ${currentPlayer.name}'s Turn`}</span>
            `;
            turnIndicator.style.display = 'block';
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

        // Check if playing the last joker card
        const wasOnlyJoker = myPlayer.hand.size() === 1 &&
            selectedCards.length === 1 &&
            selectedCards[0].equals(this.gameEngine.jokerCard);

        const result = this.gameEngine.playCards(this.myPlayerId, selectedCards);

        if (result.success) {
            // Clear selection first
            myPlayer.hand.clearSelection();

            // If player discarded their last joker, they must draw
            if (wasOnlyJoker && !this.gameEngine.deck.isEmpty()) {
                const drawnCard = this.gameEngine.deck.draw(1)[0];
                if (drawnCard) {
                    myPlayer.hand.addCard(drawnCard);
                }
            }

            // Check if penalty choice is needed
            if (result.needsPenalty) {
                this.showPenaltyChoice(result.previousCards);
            } else {
                // Send action to other players
                this.multiplayer.sendGameAction({
                    type: 'playCards',
                    data: {
                        cards: selectedCards.map(c => ({ suit: c.suit, rank: c.rank })),
                        result
                    }
                });
            }

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

    showPenaltyChoice(previousCardCount) {
        const modal = document.getElementById('penaltyModal');
        const lastPlayCount = document.getElementById('lastPlayCount');

        if (modal && lastPlayCount) {
            // Update card count for pickup option
            const count = this.gameEngine.previousPlay ? this.gameEngine.previousPlay.cards.length : 0;
            lastPlayCount.textContent = count;

            modal.style.display = 'block';

            // Setup event handlers
            document.getElementById('drawFromDeck').onclick = () => {
                this.handlePenaltyChoice('deck');
                modal.style.display = 'none';
            };

            document.getElementById('pickupLastPlay').onclick = () => {
                this.handlePenaltyChoice('pickup');
                modal.style.display = 'none';
            };
        }
    }

    handlePenaltyChoice(choice) {
        // Apply the penalty choice
        const result = this.gameEngine.handlePenaltyChoice(this.myPlayerId, choice);

        // Send to other players
        this.multiplayer.sendGameAction({
            type: 'penaltyChoice',
            data: { choice }
        });

        // Update UI
        this.updateGameUI();

        // Sync if host
        if (this.multiplayer.isHost) {
            this.multiplayer.sendGameState(this.gameEngine.serialize());
        }
    }

    drawCard() {
        // Drawing is handled through penalty choice
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
        //console.log('Copying room code:', code);
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
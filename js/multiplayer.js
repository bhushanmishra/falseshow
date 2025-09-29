// Multiplayer networking using Trystero
class MultiplayerManager {
    constructor() {
        this.room = null;
        this.roomCode = null;
        this.peers = new Map();
        this.isHost = false;
        this.myId = this.generateId();
        this.playerInfo = {
            id: this.myId,
            name: localStorage.getItem('playerName') || 'Player',
            avatar: this.getRandomAvatar(),
            score: 0,
            ready: false
        };

        // P2P channels
        this.channels = {};
        this.setupChannels();
    }

    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }

    getRandomAvatar() {
        const avatars = ['👤', '🧑', '👨', '👩', '🧔', '👱', '👶', '🧓', '👮', '🧑‍🚀', '🦸', '🧙'];
        return avatars[Math.floor(Math.random() * avatars.length)];
    }

    async createRoom(settings = {}) {
        // Use existing room code if already set, otherwise generate new one
        if (!this.roomCode) {
            this.roomCode = this.generateRoomCode();
        }
        this.isHost = true;

        // Trystero config - appId is the namespace, password is the room separator
        const config = {
            appId: 'false-show-game',
            password: this.roomCode
        };

        // Join room using Trystero
        try {
            // Wait for Trystero to load
            let attempts = 0;
            while (!window.trystero && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (window.trystero && window.trystero.joinRoom) {
                this.room = window.trystero.joinRoom(config, this.roomCode);
                this.setupRoomListeners();
                this.setupChannels();

                // Store room settings
                this.roomSettings = {
                    maxPlayers: settings.maxPlayers || 6,
                    scoreLimit: settings.scoreLimit || 100,
                    isPublic: settings.isPublic || false,
                    aiPlayers: settings.aiPlayers || false,
                    hostId: this.myId
                };

                //console.log('Room created:', this.roomCode);
                return this.roomCode;
            } else {
                // Fallback - still return room code for display
                console.warn('Trystero not fully loaded, using fallback');
                this.roomSettings = {
                    maxPlayers: settings.maxPlayers || 6,
                    scoreLimit: settings.scoreLimit || 100,
                    isPublic: settings.isPublic || false,
                    aiPlayers: settings.aiPlayers || false,
                    hostId: this.myId
                };
                return this.roomCode;
            }
        } catch (error) {
            console.error('Error creating room:', error);
            // Return room code anyway for UI display
            return this.roomCode;
        }
    }

    async joinRoom(roomCode) {
        this.roomCode = roomCode.toUpperCase();
        this.isHost = false;

        // Trystero config - appId is the namespace, password is the room separator
        const config = {
            appId: 'false-show-game',
            password: this.roomCode
        };

        try {
            // Wait for Trystero to load
            let attempts = 0;
            while (!window.trystero && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (window.trystero && window.trystero.joinRoom) {
                this.room = window.trystero.joinRoom(config, this.roomCode);
                this.setupRoomListeners();
                this.setupChannels();

                //console.log('Joining room:', this.roomCode);
                return this.roomCode;
            } else {
                console.warn('Trystero not fully loaded, using fallback');
                return this.roomCode;
            }
        } catch (error) {
            console.error('Error joining room:', error);
            return this.roomCode;
        }
    }

    setupRoomListeners() {
        if (!this.room) return;

        // When a peer joins
        this.room.onPeerJoin(peerId => {
            //console.log('Peer joined:', peerId);

            // Add peer to our list
            this.peers.set(peerId, {
                id: peerId,
                name: 'Connecting...',
                avatar: '👤',
                score: 0,
                ready: false,
                connected: true
            });

            // Send our info to the new peer
            this.sendPlayerInfo(peerId);

            // If we're host, send room settings
            if (this.isHost) {
                this.sendRoomSettings(peerId);
            }

            // Trigger UI update
            this.onPeerUpdate();
        });

        // When a peer leaves
        this.room.onPeerLeave(peerId => {
            //console.log('Peer left:', peerId);

            // Remove peer from our list
            this.peers.delete(peerId);

            // Check if we need a new host
            if (this.roomSettings && peerId === this.roomSettings.hostId) {
                this.electNewHost();
            }

            // Trigger UI update
            this.onPeerUpdate();
        });
    }

    setupChannels() {
        if (!this.room) return;

        // Player info channel
        const [sendInfo, receiveInfo] = this.room.makeAction('playerInfo');
        this.channels.sendPlayerInfo = sendInfo;
        receiveInfo((data, peerId) => {
            //console.log('Received player info:', data, 'from', peerId);
            const peer = this.peers.get(peerId);
            if (peer) {
                Object.assign(peer, data);
                this.onPeerUpdate();
            }
        });

        // Room settings channel
        const [sendSettings, receiveSettings] = this.room.makeAction('roomSettings');
        this.channels.sendRoomSettings = sendSettings;
        receiveSettings((data) => {
            //console.log('Received room settings:', data);
            this.roomSettings = data;
            this.onSettingsUpdate();
        });

        // Game state channel
        const [sendGameState, receiveGameState] = this.room.makeAction('gameState');
        this.channels.sendGameState = sendGameState;
        receiveGameState((data) => {
            //console.log('Received game state:', data);
            this.onGameStateReceived(data);
        });

        // Game action channel (for individual moves)
        const [sendAction, receiveAction] = this.room.makeAction('gameAction');
        this.channels.sendGameAction = sendAction;
        receiveAction((data, peerId) => {
            //console.log('Received game action:', data, 'from', peerId);
            this.onGameActionReceived(data, peerId);
        });

        // Chat channel
        const [sendChat, receiveChat] = this.room.makeAction('chat');
        this.channels.sendChat = sendChat;
        receiveChat((data, peerId) => {
            const peer = this.peers.get(peerId);
            const message = {
                ...data,
                playerId: peerId,
                playerName: peer ? peer.name : 'Unknown',
                timestamp: Date.now()
            };
            this.onChatReceived(message);
        });

        // Ready state channel
        const [sendReady, receiveReady] = this.room.makeAction('ready');
        this.channels.sendReady = sendReady;
        receiveReady((data, peerId) => {
            const peer = this.peers.get(peerId);
            if (peer) {
                peer.ready = data.ready;
                this.onPeerUpdate();
            }
        });

        // Start game channel
        const [sendStart, receiveStart] = this.room.makeAction('startGame');
        this.channels.sendStartGame = sendStart;
        receiveStart((data) => {
            //console.log('Game starting!', data);
            this.onGameStart(data);
        });
    }

    sendPlayerInfo(targetPeerId = null) {
        if (!this.channels.sendPlayerInfo) return;

        const info = {
            id: this.playerInfo.id,
            name: this.playerInfo.name,
            avatar: this.playerInfo.avatar,
            score: this.playerInfo.score,
            ready: this.playerInfo.ready
        };

        if (targetPeerId) {
            this.channels.sendPlayerInfo(info, targetPeerId);
        } else {
            this.channels.sendPlayerInfo(info);
        }
    }

    sendRoomSettings(targetPeerId = null) {
        if (!this.channels.sendRoomSettings || !this.roomSettings) return;

        if (targetPeerId) {
            this.channels.sendRoomSettings(this.roomSettings, targetPeerId);
        } else {
            this.channels.sendRoomSettings(this.roomSettings);
        }
    }

    sendGameState(state) {
        if (!this.channels.sendGameState) return;
        this.channels.sendGameState(state);
    }

    sendGameAction(action) {
        if (!this.channels.sendGameAction) return;
        this.channels.sendGameAction(action);
    }

    sendChatMessage(message) {
        if (!this.channels.sendChat) return;

        const chatData = {
            text: message,
            type: 'text'
        };

        this.channels.sendChat(chatData);

        // Also show our own message
        this.onChatReceived({
            ...chatData,
            playerId: this.myId,
            playerName: this.playerInfo.name,
            timestamp: Date.now(),
            isSelf: true
        });
    }

    sendEmoji(emoji) {
        if (!this.channels.sendChat) return;

        const chatData = {
            text: emoji,
            type: 'emoji'
        };

        this.channels.sendChat(chatData);

        // Also show our own emoji
        this.onChatReceived({
            ...chatData,
            playerId: this.myId,
            playerName: this.playerInfo.name,
            timestamp: Date.now(),
            isSelf: true
        });
    }

    setReady(ready) {
        this.playerInfo.ready = ready;
        if (this.channels.sendReady) {
            this.channels.sendReady({ ready });
        }
    }

    startGame() {
        if (!this.isHost || !this.channels.sendStartGame) return;

        // Check if we have enough players (now 2+ players)
        const playerCount = this.peers.size + 1; // +1 for ourselves
        if (playerCount < 2) {
            //console.log('Not enough players (need at least 2)');
            return false;
        }

        // Create initial game state
        const gameState = {
            players: this.getAllPlayers(),
            startTime: Date.now(),
            settings: this.roomSettings
        };

        this.channels.sendStartGame(gameState);
        this.onGameStart(gameState);
        return true;
    }

    getAllPlayers() {
        const players = [this.playerInfo];
        this.peers.forEach(peer => {
            players.push({
                id: peer.id,
                name: peer.name,
                avatar: peer.avatar,
                score: peer.score
            });
        });
        return players;
    }

    electNewHost() {
        // Simple host election: give host to the peer with the lowest ID
        const allIds = [this.myId, ...Array.from(this.peers.keys())].sort();
        const newHostId = allIds[0];

        if (newHostId === this.myId) {
            this.isHost = true;
            this.roomSettings.hostId = this.myId;
            this.sendRoomSettings();
            //console.log('I am the new host');
        }
    }

    leaveRoom() {
        if (this.room) {
            this.room.leave();
            this.room = null;
            this.peers.clear();
            this.roomCode = null;
            this.isHost = false;
        }
    }

    // Event handlers (to be overridden by game controller)
    onPeerUpdate() {}
    onSettingsUpdate() {}
    onGameStateReceived(state) {}
    onGameActionReceived(action, peerId) {}
    onChatReceived(message) {}
    onGameStart(state) {}
}

// Export for use in other scripts
window.MultiplayerManager = MultiplayerManager;
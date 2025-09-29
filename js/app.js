// Main app initialization and lobby management

class App {
    constructor() {
        this.initializeElements();
        this.attachEventListeners();
        this.loadSavedName();
    }

    initializeElements() {
        // Modal elements
        this.createModal = document.getElementById('createModal');
        this.createForm = document.getElementById('createForm');

        // Input elements
        this.roomCodeInput = document.getElementById('roomCodeInput');
        this.playerNameInput = document.getElementById('playerName');
        this.maxPlayersSelect = document.getElementById('maxPlayers');
        this.scoreLimitSelect = document.getElementById('scoreLimit');
        this.isPublicCheck = document.getElementById('isPublic');

        // Button elements
        this.createRoomBtn = document.getElementById('createRoom');
        this.joinRoomBtn = document.getElementById('joinRoom');
        this.quickPlayBtn = document.getElementById('quickPlay');
        this.joinBtn = document.getElementById('joinBtn');

        // Modal controls
        this.closeModalBtn = document.querySelector('.close');
    }

    attachEventListeners() {
        // Create room flow
        this.createRoomBtn.addEventListener('click', () => this.showCreateModal());
        this.createForm.addEventListener('submit', (e) => this.handleCreateRoom(e));

        // Join room flow
        this.joinBtn.addEventListener('click', () => this.handleJoinRoom());
        this.roomCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });

        // Quick play
        this.quickPlayBtn.addEventListener('click', () => this.handleQuickPlay());

        // Modal controls
        this.closeModalBtn.addEventListener('click', () => this.hideCreateModal());
        window.addEventListener('click', (e) => {
            if (e.target === this.createModal) {
                this.hideCreateModal();
            }
        });

        // Enter key on room code input
        this.roomCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleJoinRoom();
            }
        });
    }

    loadSavedName() {
        const savedName = localStorage.getItem('playerName');
        if (savedName && this.playerNameInput) {
            this.playerNameInput.value = savedName;
        }
    }

    showCreateModal() {
        this.createModal.style.display = 'block';
        this.playerNameInput.focus();
    }

    hideCreateModal() {
        this.createModal.style.display = 'none';
    }

    async handleCreateRoom(e) {
        e.preventDefault();

        const playerName = this.playerNameInput.value.trim();
        const maxPlayers = parseInt(this.maxPlayersSelect.value);
        const scoreLimit = parseInt(this.scoreLimitSelect.value);
        const isPublic = this.isPublicCheck.checked;

        if (!playerName) {
            this.showError('Please enter your name');
            return;
        }

        // Save player name
        localStorage.setItem('playerName', playerName);

        // Hide modal immediately
        this.hideCreateModal();

        // Navigate to game page with create params
        const params = new URLSearchParams({
            action: 'create',
            name: playerName,
            maxPlayers: maxPlayers,
            scoreLimit: scoreLimit,
            public: isPublic
        });

        window.location.href = `/play.html?${params}`;
    }

    handleJoinRoom() {
        const roomCode = this.roomCodeInput.value.trim();

        if (roomCode.length !== 6) {
            this.showError('Room code must be 6 characters');
            return;
        }

        // Ask for name if not saved
        let playerName = localStorage.getItem('playerName');
        if (!playerName) {
            playerName = prompt('Enter your name:');
            if (!playerName) return;
            localStorage.setItem('playerName', playerName.trim());
        }

        // Navigate to game page with join params
        const params = new URLSearchParams({
            action: 'join',
            room: roomCode,
            name: playerName
        });

        window.location.href = `/play.html?${params}`;
    }

    async handleQuickPlay() {
        // Ask for name if not saved
        let playerName = localStorage.getItem('playerName');
        if (!playerName) {
            playerName = prompt('Enter your name:');
            if (!playerName) return;
            localStorage.setItem('playerName', playerName.trim());
        }

        // Navigate to game page with quick play params
        const params = new URLSearchParams({
            action: 'quick',
            name: playerName
        });

        window.location.href = `/play.html?${params}`;
    }

    showError(message) {
        // Simple error display
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-toast';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);

        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// Service Worker registration for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
        .then(reg => //console.log('Service Worker registered'))
        .catch(err => //console.log('Service Worker registration failed'));
}
// Core game engine and rules implementation

class GameEngine {
    constructor() {
        this.deck = new Deck();
        this.players = [];
        this.currentPlayerIndex = 0;
        this.playedCards = [];
        this.lastPlay = null;
        this.jokerCard = null;
        this.scoreLimit = 100;
        this.gameState = 'waiting'; // waiting, playing, roundEnd, gameOver
        this.roundNumber = 0;
    }

    initialize(players, settings = {}) {
        this.players = players.map(p => ({
            ...p,
            hand: new Hand(),
            score: p.score || 0,
            isEliminated: false,
            hasDrawnPenalty: false
        }));

        this.scoreLimit = settings.scoreLimit || 100;
        this.gameState = 'waiting';
    }

    startNewRound() {
        this.roundNumber++;
        this.deck = new Deck();
        this.deck.reset();  // Ensure deck is fully initialized
        this.deck.shuffle();
        this.playedCards = [];
        this.lastPlay = null;
        this.currentPlayerIndex = Math.floor(Math.random() * this.getActivePlayers().length);

        // Clear hands
        this.players.forEach(player => {
            player.hand = new Hand();
            player.hasDrawnPenalty = false;
        });

        // Deal cards based on player count
        this.dealCards();

        // Select joker
        this.selectJoker();

        // Deal one card to start the play area
        const startCard = this.deck.draw(1)[0];
        if (startCard) {
            this.initialCard = startCard;  // Store initial card separately
            this.lastPlay = {
                playerId: 'dealer',
                playerName: 'Initial Card',
                cards: [startCard],
                type: 'single'
            };
            this.playedCards.push(startCard);
        }

        this.gameState = 'playing';

        return {
            joker: this.jokerCard,
            currentPlayer: this.getCurrentPlayer(),
            hands: this.getHandSizes()
        };
    }

    dealCards() {
        const activePlayers = this.getActivePlayers();
        const playerCount = activePlayers.length;
        let cardsPerPlayer;

        // Adjusted for 2+ players
        if (playerCount === 2) cardsPerPlayer = 10;
        else if (playerCount === 3) cardsPerPlayer = 9;
        else if (playerCount === 4) cardsPerPlayer = 8;
        else if (playerCount === 5) cardsPerPlayer = 7;
        else cardsPerPlayer = 6; // 6+ players

        // Deal cards to each player
        activePlayers.forEach(player => {
            const cards = this.deck.draw(cardsPerPlayer);
            player.hand.addCards(cards);
        });
    }

    selectJoker() {
        // Draw bottom 2 cards for joker selection
        const bottomCards = this.deck.drawBottom(2);
        if (bottomCards.length > 0) {
            // Store both cards for display
            this.jokerOptions = bottomCards;
            // Host/dealer picks one (for simplicity, pick the first one)
            // In a full implementation, the host would choose
            this.jokerCard = bottomCards[0];
        }
    }

    getCurrentPlayer() {
        const activePlayers = this.getActivePlayers();
        return activePlayers[this.currentPlayerIndex % activePlayers.length];
    }

    getActivePlayers() {
        return this.players.filter(p => !p.isEliminated);
    }

    getHandSizes() {
        const sizes = {};
        this.players.forEach(player => {
            sizes[player.id] = player.hand.size();
        });
        return sizes;
    }

    playCards(playerId, cards) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || player.isEliminated) {
            return { success: false, error: 'Invalid player' };
        }

        if (this.getCurrentPlayer().id !== playerId) {
            return { success: false, error: 'Not your turn' };
        }

        // Validate the play
        const validation = CardValidator.validatePlay(cards, this.jokerCard);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        // Check if play is safe
        const isSafe = CardValidator.isSafePlay(cards, this.lastPlay?.cards);

        // Remove cards from hand
        player.hand.removeCards(cards);

        // Update game state
        this.lastPlay = {
            playerId,
            cards,
            type: validation.type,
            isSafe,
            timestamp: Date.now()
        };

        this.playedCards.push(...cards);

        // Handle penalty if unsafe
        if (!isSafe && this.lastPlay.cards.length > 0) {
            player.hasDrawnPenalty = true;
            if (!this.deck.isEmpty()) {
                const penaltyCard = this.deck.draw(1)[0];
                if (penaltyCard) {
                    player.hand.addCard(penaltyCard);
                }
            }
        }

        // Check if player has won the round
        if (player.hand.isEmpty()) {
            return this.endRound(playerId);
        }

        // Move to next player
        this.nextTurn();

        return {
            success: true,
            isSafe,
            penalty: !isSafe,
            nextPlayer: this.getCurrentPlayer(),
            handSizes: this.getHandSizes()
        };
    }

    callShow(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || player.isEliminated) {
            return { success: false, error: 'Invalid player' };
        }

        // Calculate all hand values
        const handValues = this.getActivePlayers().map(p => ({
            playerId: p.id,
            value: p.hand.calculateHandValue(),
            cards: p.hand.cards
        }));

        // Find lowest hand value
        const lowestValue = Math.min(...handValues.map(h => h.value));
        const hasLowestHand = player.hand.calculateHandValue() === lowestValue;

        // Apply scores
        const scores = {};
        if (hasLowestHand) {
            // Caller was correct
            this.getActivePlayers().forEach(p => {
                if (p.id === playerId) {
                    scores[p.id] = 0; // Caller scores 0
                } else {
                    scores[p.id] = p.hand.calculateHandValue();
                    p.score += scores[p.id];
                }
            });
        } else {
            // Caller was wrong
            this.getActivePlayers().forEach(p => {
                if (p.id === playerId) {
                    scores[p.id] = 50; // Penalty for wrong call
                    p.score += 50;
                } else if (p.hand.calculateHandValue() === lowestValue) {
                    scores[p.id] = 0; // Actual lowest scores 0
                } else {
                    scores[p.id] = p.hand.calculateHandValue();
                    p.score += scores[p.id];
                }
            });
        }

        // Check for eliminations
        this.checkEliminations();

        // Check if game is over
        if (this.getActivePlayers().length === 1) {
            this.gameState = 'gameOver';
            return {
                success: true,
                correct: hasLowestHand,
                scores,
                handValues,
                gameOver: true,
                winner: this.getActivePlayers()[0]
            };
        }

        this.gameState = 'roundEnd';

        return {
            success: true,
            correct: hasLowestHand,
            scores,
            handValues,
            gameOver: false
        };
    }

    endRound(winnerId) {
        // Calculate scores for round end
        const scores = {};
        this.getActivePlayers().forEach(p => {
            if (p.id === winnerId) {
                scores[p.id] = 0; // Winner scores 0
            } else {
                scores[p.id] = p.hand.calculateHandValue();
                p.score += scores[p.id];
            }
        });

        // Check for eliminations
        this.checkEliminations();

        // Check if game is over
        if (this.getActivePlayers().length === 1) {
            this.gameState = 'gameOver';
            return {
                success: true,
                roundWinner: winnerId,
                scores,
                gameOver: true,
                winner: this.getActivePlayers()[0]
            };
        }

        this.gameState = 'roundEnd';

        return {
            success: true,
            roundWinner: winnerId,
            scores,
            gameOver: false
        };
    }

    checkEliminations() {
        this.players.forEach(player => {
            if (player.score >= this.scoreLimit && !player.isEliminated) {
                player.isEliminated = true;
            }
        });
    }

    nextTurn() {
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length > 0) {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % activePlayers.length;
        }
    }

    getGameState() {
        return {
            state: this.gameState,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                avatar: p.avatar,
                score: p.score,
                handSize: p.hand.size(),
                isEliminated: p.isEliminated
            })),
            currentPlayer: this.getCurrentPlayer()?.id,
            lastPlay: this.lastPlay,
            joker: this.jokerCard,
            deckSize: this.deck.cardsRemaining(),
            roundNumber: this.roundNumber
        };
    }

    // Special rule: Joker as last card
    handleJokerAsLastCard(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return false;

        if (player.hand.size() === 1 && player.hand.hasJoker(this.jokerCard)) {
            // Player must either call Show or discard and draw
            return true;
        }
        return false;
    }

    // Serialize game state for network sync
    serialize() {
        return {
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                avatar: p.avatar,
                score: p.score,
                handSize: p.hand.size(),
                isEliminated: p.isEliminated,
                cards: p.hand.cards.map(c => ({
                    suit: c.suit,
                    rank: c.rank
                }))
            })),
            deck: this.deck.cards.map(c => ({
                suit: c.suit,
                rank: c.rank
            })),
            currentPlayerIndex: this.currentPlayerIndex,
            lastPlay: this.lastPlay,
            jokerCard: this.jokerCard ? {
                suit: this.jokerCard.suit,
                rank: this.jokerCard.rank
            } : null,
            initialCard: this.initialCard ? {
                suit: this.initialCard.suit,
                rank: this.initialCard.rank
            } : null,
            scoreLimit: this.scoreLimit,
            gameState: this.gameState,
            roundNumber: this.roundNumber
        };
    }

    // Deserialize game state from network
    deserialize(data) {
        this.players = data.players.map(p => {
            const player = {
                ...p,
                hand: new Hand()
            };
            if (p.cards) {
                player.hand.addCards(p.cards.map(c => new Card(c.suit, c.rank)));
            }
            return player;
        });

        this.deck = new Deck();
        this.deck.cards = data.deck.map(c => new Card(c.suit, c.rank));

        this.currentPlayerIndex = data.currentPlayerIndex;
        this.lastPlay = data.lastPlay;
        this.jokerCard = data.jokerCard ? new Card(data.jokerCard.suit, data.jokerCard.rank) : null;
        this.initialCard = data.initialCard ? new Card(data.initialCard.suit, data.initialCard.rank) : null;
        this.scoreLimit = data.scoreLimit;
        this.gameState = data.gameState;
        this.roundNumber = data.roundNumber;
    }
}

// Export for use
window.GameEngine = GameEngine;
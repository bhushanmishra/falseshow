// AI Player logic for False Show game

class AIPlayer {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.thinkingTime = 1500; // ms to simulate thinking
    }

    // Main decision function for AI player turn
    async makePlay(gameState, hand, jokerCard) {
        // Simulate thinking time
        await this.delay(this.thinkingTime);

        const validPlays = this.findAllValidPlays(hand, jokerCard);
        if (validPlays.length === 0) {
            return null;
        }

        // Check if should call Show
        const handValue = hand.calculateHandValue(jokerCard);
        const shouldCallShow = this.shouldCallShow(gameState, handValue, hand.size());

        if (shouldCallShow) {
            return { action: 'show' };
        }

        // Check if joker is last card
        if (hand.size() === 1 && hand.hasJoker(jokerCard)) {
            // Must call show or discard and draw
            if (handValue <= 10) {
                return { action: 'show' };
            }
            // Return the joker to discard it
            return { action: 'play', cards: hand.cards };
        }

        // Choose best play based on difficulty
        const chosenPlay = this.chooseBestPlay(validPlays, gameState.lastPlay, jokerCard, hand);
        return { action: 'play', cards: chosenPlay.cards };
    }

    findAllValidPlays(hand, jokerCard) {
        const validPlays = [];
        const cards = hand.cards;

        // Find all singles
        for (const card of cards) {
            validPlays.push({
                type: 'single',
                cards: [card],
                value: card.equals(jokerCard) ? 0 : card.value
            });
        }

        // Find all pairs
        for (let i = 0; i < cards.length - 1; i++) {
            for (let j = i + 1; j < cards.length; j++) {
                if (cards[i].rank === cards[j].rank ||
                    cards[i].equals(jokerCard) ||
                    cards[j].equals(jokerCard)) {
                    validPlays.push({
                        type: 'pair',
                        cards: [cards[i], cards[j]],
                        value: this.calculatePlayValue([cards[i], cards[j]], jokerCard)
                    });
                }
            }
        }

        // Find sequences (simplified - just check consecutive cards of same suit)
        for (let i = 0; i < cards.length - 2; i++) {
            const sequenceCards = [];
            const suit = cards[i].suit;
            let lastValue = cards[i].value;
            sequenceCards.push(cards[i]);

            for (let j = i + 1; j < cards.length; j++) {
                if ((cards[j].suit === suit && cards[j].value === lastValue + 1) ||
                    cards[j].equals(jokerCard)) {
                    sequenceCards.push(cards[j]);
                    lastValue = cards[j].equals(jokerCard) ? lastValue + 1 : cards[j].value;

                    if (sequenceCards.length >= 3) {
                        validPlays.push({
                            type: 'sequence',
                            cards: [...sequenceCards],
                            value: this.calculatePlayValue(sequenceCards, jokerCard)
                        });
                    }
                }
            }
        }

        return validPlays;
    }

    calculatePlayValue(cards, jokerCard) {
        return cards.reduce((sum, card) =>
            sum + (card.equals(jokerCard) ? 0 : card.value), 0);
    }

    chooseBestPlay(validPlays, lastPlay, jokerCard, hand) {
        // Filter for safe plays if possible
        const safePlays = validPlays.filter(play =>
            this.isSafePlay(play.cards, lastPlay?.cards)
        );

        const playsToConsider = safePlays.length > 0 ? safePlays : validPlays;

        // Strategy based on difficulty
        switch (this.difficulty) {
            case 'easy':
                // Random play
                return playsToConsider[Math.floor(Math.random() * playsToConsider.length)];

            case 'medium':
                // Prefer playing higher value cards first, safe plays
                return this.mediumStrategy(playsToConsider, hand, jokerCard);

            case 'hard':
                // Advanced strategy - consider hand reduction, bluffing, etc.
                return this.hardStrategy(playsToConsider, hand, jokerCard, lastPlay);

            default:
                return playsToConsider[0];
        }
    }

    mediumStrategy(plays, hand, jokerCard) {
        // Prefer to play higher value cards when safe
        // Keep low cards and joker for end game
        const sortedPlays = plays.sort((a, b) => {
            // Prefer safe plays
            const aSafe = this.isSafePlay(a.cards, this.lastPlayCards);
            const bSafe = this.isSafePlay(b.cards, this.lastPlayCards);
            if (aSafe && !bSafe) return -1;
            if (!aSafe && bSafe) return 1;

            // Don't play joker early unless in combination
            const aHasJoker = a.cards.some(c => c.equals(jokerCard));
            const bHasJoker = b.cards.some(c => c.equals(jokerCard));
            if (aHasJoker && !bHasJoker && hand.size() > 5) return 1;
            if (!aHasJoker && bHasJoker && hand.size() > 5) return -1;

            // Prefer playing higher value cards
            return b.value - a.value;
        });

        return sortedPlays[0];
    }

    hardStrategy(plays, hand, jokerCard, lastPlay) {
        // More complex decision making
        const handValue = hand.calculateHandValue(jokerCard);
        const cardsLeft = hand.size();

        // End game strategy - keep low cards
        if (cardsLeft <= 3) {
            const sortedPlays = plays.sort((a, b) => b.value - a.value);
            return sortedPlays[0];
        }

        // Mid game - balance between safe plays and hand reduction
        const scoredPlays = plays.map(play => {
            let score = 0;

            // Safe play bonus
            if (this.isSafePlay(play.cards, lastPlay?.cards)) {
                score += 10;
            }

            // Higher value cards get priority
            score += play.value * 0.5;

            // Sequences are good for dumping multiple cards
            if (play.type === 'sequence') {
                score += play.cards.length * 3;
            }

            // Avoid playing joker early
            if (play.cards.some(c => c.equals(jokerCard)) && cardsLeft > 5) {
                score -= 15;
            }

            return { play, score };
        });

        scoredPlays.sort((a, b) => b.score - a.score);
        return scoredPlays[0].play;
    }

    shouldCallShow(gameState, handValue, cardsLeft) {
        // Decision logic for calling Show

        // Never call show in first few rounds with many cards
        if (cardsLeft > 5) return false;

        switch (this.difficulty) {
            case 'easy':
                // Only call show with very low hands
                return handValue <= 5 && cardsLeft <= 2;

            case 'medium':
                // More aggressive with show calls
                if (handValue <= 3) return true;
                if (handValue <= 8 && cardsLeft <= 2) return true;
                return false;

            case 'hard':
                // Calculate risk based on observed plays
                if (handValue === 0) return true; // Always call with 0
                if (handValue <= 5 && cardsLeft <= 3) return true;
                if (handValue <= 10 && cardsLeft === 1) return true;

                // Bluff occasionally when opponents have many cards
                const otherPlayersHighCards = this.estimateOpponentHands(gameState);
                if (otherPlayersHighCards && handValue <= 15 && Math.random() < 0.1) {
                    return true; // 10% bluff chance
                }
                return false;

            default:
                return false;
        }
    }

    estimateOpponentHands(gameState) {
        // Simple estimation - if opponents have many cards, they likely have high hands
        if (!gameState.players) return false;

        const avgCards = gameState.players
            .filter(p => !p.isEliminated && p.id !== 'ai-player')
            .reduce((sum, p) => sum + p.handSize, 0) /
            gameState.players.filter(p => !p.isEliminated && p.id !== 'ai-player').length;

        return avgCards >= 4;
    }

    isSafePlay(cards, previousCards) {
        if (!previousCards || previousCards.length === 0) {
            return true;
        }

        for (const card of cards) {
            for (const prevCard of previousCards) {
                if (card.rank === prevCard.rank) {
                    return true;
                }
            }
        }
        return false;
    }

    // Handle penalty choice
    choosePenalty(gameState, hand) {
        const previousPlay = gameState.previousPlay;
        if (!previousPlay) return 'deck';

        const previousValue = this.calculatePlayValue(previousPlay.cards, gameState.joker);
        const averageCardValue = 7; // Average value of a card

        // If previous play has high value, prefer drawing from deck
        if (previousValue > previousPlay.cards.length * averageCardValue) {
            return 'deck';
        }

        // If hand is already large, prefer deck
        if (hand.size() > 6) {
            return 'deck';
        }

        // Otherwise pick up the cards
        return 'pickup';
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for use
window.AIPlayer = AIPlayer;
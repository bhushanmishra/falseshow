// Card management and deck logic

class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.value = this.calculateValue();
        this.id = `${rank}-${suit}`;
    }

    calculateValue() {
        if (this.rank === 'A') return 1;
        if (this.rank === 'J') return 11;
        if (this.rank === 'Q') return 12;
        if (this.rank === 'K') return 13;
        return parseInt(this.rank);
    }

    getSuitSymbol() {
        const symbols = {
            'spades': '♠',
            'hearts': '♥',
            'diamonds': '♦',
            'clubs': '♣'
        };
        return symbols[this.suit] || '';
    }

    getColor() {
        return (this.suit === 'hearts' || this.suit === 'diamonds') ? 'red' : 'black';
    }

    toHTML() {
        const color = this.getColor();
        const symbol = this.getSuitSymbol();
        return `
            <div class="card ${color}" data-card-id="${this.id}" draggable="true">
                <div class="card-corner top-left">
                    <span class="rank">${this.rank}</span>
                    <span class="suit">${symbol}</span>
                </div>
                <div class="card-center">
                    <span class="suit-large">${symbol}</span>
                </div>
                <div class="card-corner bottom-right">
                    <span class="rank">${this.rank}</span>
                    <span class="suit">${symbol}</span>
                </div>
            </div>
        `;
    }

    equals(otherCard) {
        return this.rank === otherCard.rank && this.suit === otherCard.suit;
    }

    matchesRank(otherCard) {
        return this.rank === otherCard.rank;
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }

    reset() {
        this.cards = [];
        const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

        for (const suit of suits) {
            for (const rank of ranks) {
                this.cards.push(new Card(suit, rank));
            }
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    draw(count = 1) {
        const drawn = [];
        for (let i = 0; i < count; i++) {
            if (this.cards.length > 0) {
                drawn.push(this.cards.pop());
            }
        }
        return drawn;
    }

    drawBottom(count = 2) {
        const drawn = [];
        for (let i = 0; i < count && this.cards.length > 0; i++) {
            drawn.push(this.cards.shift());
        }
        return drawn;
    }

    cardsRemaining() {
        return this.cards.length;
    }

    isEmpty() {
        return this.cards.length === 0;
    }
}

class Hand {
    constructor() {
        this.cards = [];
        this.selectedCards = new Set();
    }

    addCard(card) {
        this.cards.push(card);
        this.sort();
    }

    addCards(cards) {
        this.cards.push(...cards);
        this.sort();
    }

    removeCard(card) {
        const index = this.cards.findIndex(c => c.equals(card));
        if (index !== -1) {
            this.cards.splice(index, 1);
        }
    }

    removeCards(cards) {
        cards.forEach(card => this.removeCard(card));
    }

    sort() {
        this.cards.sort((a, b) => {
            if (a.value !== b.value) {
                return a.value - b.value;
            }
            // If same value, sort by suit
            const suitOrder = ['spades', 'hearts', 'diamonds', 'clubs'];
            return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
        });
    }

    getSelectedCards() {
        return this.cards.filter(card => this.selectedCards.has(card.id));
    }

    toggleCardSelection(cardId) {
        if (this.selectedCards.has(cardId)) {
            this.selectedCards.delete(cardId);
        } else {
            this.selectedCards.add(cardId);
        }
    }

    clearSelection() {
        this.selectedCards.clear();
    }

    calculateHandValue() {
        return this.cards.reduce((sum, card) => sum + card.value, 0);
    }

    hasJoker(jokerCard) {
        return this.cards.some(card => card.equals(jokerCard));
    }

    canPlaySingle() {
        return this.selectedCards.size === 1;
    }

    canPlayPair() {
        if (this.selectedCards.size !== 2) return false;
        const selected = this.getSelectedCards();
        return selected[0].rank === selected[1].rank;
    }

    canPlaySequence() {
        if (this.selectedCards.size < 3) return false;
        const selected = this.getSelectedCards();

        // Check if all same suit
        const suit = selected[0].suit;
        if (!selected.every(card => card.suit === suit)) {
            return false;
        }

        // Check if sequential
        const values = selected.map(card => card.value).sort((a, b) => a - b);
        for (let i = 1; i < values.length; i++) {
            if (values[i] !== values[i - 1] + 1) {
                return false;
            }
        }
        return true;
    }

    getValidPlay() {
        if (this.canPlaySingle()) return { type: 'single', cards: this.getSelectedCards() };
        if (this.canPlayPair()) return { type: 'pair', cards: this.getSelectedCards() };
        if (this.canPlaySequence()) return { type: 'sequence', cards: this.getSelectedCards() };
        return null;
    }

    isEmpty() {
        return this.cards.length === 0;
    }

    size() {
        return this.cards.length;
    }
}

// Card validation utilities
class CardValidator {
    static isSafePlay(playedCards, previousCards) {
        if (!previousCards || previousCards.length === 0) {
            return true; // First play is always safe
        }

        // Check if any card in the played set matches any rank in the previous set
        for (const playedCard of playedCards) {
            for (const prevCard of previousCards) {
                if (playedCard.matchesRank(prevCard)) {
                    return true;
                }
            }
        }
        return false;
    }

    static validatePlay(selectedCards, jokerCard = null) {
        if (!selectedCards || selectedCards.length === 0) {
            return { valid: false, error: 'No cards selected' };
        }

        // Check for joker substitution
        const hasJoker = jokerCard && selectedCards.some(card => card.equals(jokerCard));

        if (selectedCards.length === 1) {
            return { valid: true, type: 'single', hasJoker };
        }

        if (selectedCards.length === 2) {
            // Check for pair (or joker + card making a pair)
            if (selectedCards[0].rank === selectedCards[1].rank || hasJoker) {
                return { valid: true, type: 'pair', hasJoker };
            }
            return { valid: false, error: 'Not a valid pair' };
        }

        if (selectedCards.length >= 3) {
            // Check for sequence
            const sorted = [...selectedCards].sort((a, b) => a.value - b.value);
            const suit = sorted[0].suit;

            // Check same suit (joker can be any suit)
            const sameSuit = sorted.every(card =>
                card.suit === suit || (jokerCard && card.equals(jokerCard))
            );

            if (!sameSuit) {
                return { valid: false, error: 'Sequence must be same suit' };
            }

            // Check sequential values (joker can fill gaps)
            if (hasJoker) {
                // Complex validation with joker substitution
                return { valid: true, type: 'sequence', hasJoker };
            } else {
                // Simple sequential check
                for (let i = 1; i < sorted.length; i++) {
                    if (sorted[i].value !== sorted[i - 1].value + 1) {
                        return { valid: false, error: 'Cards must be sequential' };
                    }
                }
                return { valid: true, type: 'sequence', hasJoker: false };
            }
        }

        return { valid: false, error: 'Invalid play' };
    }
}

// Export for use in other scripts
window.Card = Card;
window.Deck = Deck;
window.Hand = Hand;
window.CardValidator = CardValidator;
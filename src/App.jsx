import React, { useState, useEffect, useRef } from 'react';

// Card suits and ranks constants
const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/**
 * Creates a standard 52-card deck.
 * Each card object includes suit, rank, and its numerical value.
 * Ace is initially valued at 11, and will be adjusted to 1 in calculateHandValue if necessary.
 * @returns {Array<Object>} A freshly created deck of cards.
 */
const createDeck = () => {
  let deck = [];
  for (let suit of suits) {
    for (let rank of ranks) {
      let value;
      if (['J', 'Q', 'K'].includes(rank)) {
        value = 10;
      } else if (rank === 'A') {
        value = 11; // Ace is initially 11, adjusted to 1 later if hand busts
      } else {
        value = parseInt(rank);
      }
      deck.push({ suit, rank, value });
    }
  }
  return deck;
};

/**
 * Shuffles a given deck of cards using the Fisher-Yates (Knuth) shuffle algorithm.
 * @param {Array<Object>} deck The deck to be shuffled.
 * @returns {Array<Object>} The shuffled deck.
 */
const shuffleDeck = (deck) => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]; // Swap elements
  }
  return deck;
};

/**
 * Calculates the total value of a hand, correctly handling Aces (1 or 11).
 * It also determines if the hand is "soft" (contains an Ace counted as 11).
 * @param {Array<Object>} hand The array of card objects in the hand.
 * @returns {{total: number, isSoft: boolean}} An object with the hand's total value and a boolean indicating if it's soft.
 */
const calculateHandValue = (hand) => {
  let total = 0;
  let numAces = 0;

  // First pass: sum values, count Aces
  for (let card of hand) {
    if (card.rank === 'A') {
      numAces++;
      total += 11;
    } else {
      total += card.value;
    }
  }

  // Second pass: adjust Aces from 11 to 1 if the hand busts
  while (total > 21 && numAces > 0) {
    total -= 10; // Change an Ace's value from 11 to 1
    numAces--;
  }

  // A hand is soft if it contains at least one Ace that is currently being counted as 11.
  // This is true if, after all necessary reductions, there is still an Ace that contributes 11.
  // The `numAces` variable tracks aces still contributing 11.
  const isSoft = numAces > 0;

  return { total, isSoft };
};

/**
 * Converts a card suit string to its corresponding Unicode symbol.
 * @param {string} suit The suit of the card (e.g., 'hearts').
 * @returns {string} The Unicode symbol for the suit.
 */
const getSuitSymbol = (suit) => {
  switch (suit) {
    case 'hearts': return '♥️';
    case 'diamonds': return '♦️';
    case 'clubs': return '♣️';
    case 'spades': return '♠️';
    default: return '';
  }
};

/**
 * Determines whether the auto-play strategy dictates hitting or standing.
 * Implements perfect basic strategy with the specific modification for 5-card hands.
 * @param {Array<Object>} playerHand The player's current hand.
 * @param {Object} dealerUpCard The dealer's visible card.
 * @param {number} playerCardCount The number of cards in the player's hand.
 * @returns {boolean} True if the auto-play strategy suggests hitting, false otherwise (standing).
 */
const shouldAutoPlayHit = (playerHand, dealerUpCard, playerCardCount) => {
  const { total: playerTotal, isSoft: playerIsSoft } = calculateHandValue(playerHand);
  // Determine the effective value of the dealer's up-card for strategy. Ace is 11, faces are 10.
  const dealerUpCardValue = dealerUpCard.rank === 'A' ? 11 : (['J', 'Q', 'K'].includes(dealerUpCard.rank) ? 10 : parseInt(dealerUpCard.rank));

  // Specific modification: If the player has 5 cards and cannot bust (21 - total >= 10), always hit to reach 6 cards
  if (playerCardCount === 5 && playerTotal <= 21 && (21 - playerTotal) >= 10) {
    return true;
  }

  // Player has 21 (or would bust on next hit), or already busted
  if (playerTotal >= 21) {
    return false;
  }

  if (playerIsSoft) { // Soft totals (contains an Ace counted as 11)
    if (playerTotal <= 17) {
      return true; // Hit Soft 17 or less
    } else if (playerTotal === 18) {
      // Stand on Soft 18 vs Dealer 2,3,4,5,6,7,8
      // Hit on Soft 18 vs Dealer 9,10,Ace
      return ![2, 3, 4, 5, 6, 7, 8].includes(dealerUpCardValue);
    } else { // Soft 19 or more (Soft 19, Soft 20)
      return false; // Stand
    }
  } else { // Hard totals (no Ace counted as 11, or no Ace at all)
    if (playerTotal <= 11) {
      return true; // Always hit on hard 11 or less
    } else if (playerTotal === 12) {
      // Stand on 12 vs Dealer 4,5,6
      // Hit on 12 vs Dealer 2,3,7,8,9,10,Ace
      return ![4, 5, 6].includes(dealerUpCardValue);
    } else if (playerTotal >= 13 && playerTotal <= 16) {
      // Stand on 13-16 vs Dealer 2,3,4,5,6
      // Hit on 13-16 vs Dealer 7,8,9,10,Ace
      return ![2, 3, 4, 5, 6].includes(dealerUpCardValue);
    } else { // Hard 17 or more (Hard 17, Hard 18, Hard 19, Hard 20, Hard 21)
      return false; // Stand
    }
  }
};

/**
 * Primary React component for the Blackjack Game.
 * Manages all game state, logic, and UI rendering.
 */
const BlackjackGame = () => {
  // --- Game State Variables ---
  const [bankroll, setBankroll] = useState(1000);
  const [throughput, setThroughput] = useState(0);
  const [points, setPoints] = useState(0);
  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [betAmount, setBetAmount] = useState(10); // Default bet is $10
  const [gamePhase, setGamePhase] = useState('betting'); // 'betting', 'playerTurn', 'dealerTurn', 'result'
  const [message, setMessage] = useState('Place your bet and click Deal!');
  const [autoPlayMode, setAutoPlayMode] = useState(false);
  const [lastPlayerTotal, setLastPlayerTotal] = useState(0);
  const [lastDealerTotal, setLastDealerTotal] = useState(0);
  const [lastHandResult, setLastHandResult] = useState('');
  const autoplayTimeoutRef = useRef(null); // Ref to store the autoplay timeout ID

  // --- Helper Functions for Game Logic ---

  /**
   * Resets the game to its initial state (bankroll, throughput, points).
   */
  const resetGame = () => {
    setBankroll(1000);
    setThroughput(0);
    setPoints(0);
    setDeck([]);
    setPlayerHand([]);
    setDealerHand([]);
    setGamePhase('betting');
    setMessage('Game reset! Place your bet and click Deal!');
    setLastPlayerTotal(0);
    setLastDealerTotal(0);
    setLastHandResult('');
    setAutoPlayMode(false);
    clearTimeout(autoplayTimeoutRef.current);
  };

  /**
   * Deals the initial two cards to the player and dealer.
   * Initiates a new hand.
   */
  const dealHand = () => {
    if (gamePhase !== 'betting' && gamePhase !== 'result') return;
    if (bankroll < betAmount) {
      setMessage('Not enough money to place this bet!');
      // If in auto-play and not enough money, turn off auto-play
      if (autoPlayMode) setAutoPlayMode(false);
      return;
    }

    clearTimeout(autoplayTimeoutRef.current); // Clear any pending autoplay timeouts
    // Note: autoPlayMode is not set to false here if manual deal, allowing it to stay on.

    const newDeck = shuffleDeck(createDeck());
    const newPlayerHand = [newDeck.pop(), newDeck.pop()];
    const newDealerHand = [newDeck.pop(), newDeck.pop()];

    setBankroll(prev => prev - betAmount);
    setThroughput(prev => prev + betAmount);
    setDeck(newDeck);
    setPlayerHand(newPlayerHand);
    setDealerHand(newDealerHand);
    setGamePhase('playerTurn');
    setMessage('Your turn: Hit or Stand?');
    setLastPlayerTotal(0); // Clear last hand totals
    setLastDealerTotal(0);
    setLastHandResult('');

    // Check for immediate Blackjacks (before player takes action)
    const playerVal = calculateHandValue(newPlayerHand).total;
    const dealerVal = calculateHandValue(newDealerHand).total;

    if (playerVal === 21 && newPlayerHand.length === 2) {
      if (dealerVal === 21 && newDealerHand.length === 2) {
        // Both have Blackjack
        setMessage('Both have Blackjack! Push.');
        setBankroll(prev => prev + betAmount); // Return bet
        setGamePhase('result');
        setLastHandResult('Push');
        setLastPlayerTotal(playerVal);
        setLastDealerTotal(dealerVal);
      } else {
        // Player Blackjack
        setMessage('Blackjack! You win!');
        setBankroll(prev => prev + betAmount * 2); // Bet + Win (1:1 payout)
        setGamePhase('result');
        setLastHandResult('Win');
        setLastPlayerTotal(playerVal);
        setLastDealerTotal(dealerVal);
      }
    }
    if (dealerVal === 21 && newDealerHand.length === 2) {
      setMessage('Dealer has Blackjack! You lose.');
      setGamePhase('result');
      setLastHandResult('Loss');
      setLastPlayerTotal(playerVal);
      setLastDealerTotal(dealerVal);
    }
  };

  /**
   * Deals one card to the player. Checks for bust or 6-card Charlie win.
   */
  const hitPlayer = () => {
    // Allow hit only during player's turn or when auto-play is active
    if (gamePhase !== 'playerTurn' && gamePhase !== 'autoPlay') return;
    if (deck.length === 0) {
      setMessage('Deck is empty! Please Reset the game.');
      // If in auto-play and deck is empty, stop auto-play
      if (autoPlayMode) setAutoPlayMode(false);
      return;
    }

    const newDeck = [...deck];
    const newPlayerHand = [...playerHand, newDeck.pop()];
    setPlayerHand(newPlayerHand);
    setDeck(newDeck);

    const { total: playerTotal } = calculateHandValue(newPlayerHand);

    // Player wins automatically if reaching 6 cards <= 21
    if (newPlayerHand.length === 6 && playerTotal <= 21) {
      setMessage('6 Card Charlie! You win automatically!');
      setBankroll(prev => prev + betAmount * 2);
      setGamePhase('result');
      setLastHandResult('Win');
      setLastPlayerTotal(playerTotal);
      setLastDealerTotal(calculateHandValue(dealerHand).total);
      return; // End hand
    }

    // Check if player busts
    if (playerTotal > 21) {
      setMessage('You busted! Dealer wins.');
      setGamePhase('result');
      setLastHandResult('Loss');
      setLastPlayerTotal(playerTotal);
      setLastDealerTotal(calculateHandValue(dealerHand).total);
    } else {
      // Only update message if not auto-playing or for manual hit
      if (!autoPlayMode) {
        setMessage('Your turn: Hit or Stand?');
      }
    }
  };

  /**
   * Ends the player's turn and starts the dealer's turn.
   */
  const standPlayer = () => {
    // Allow stand only during player's turn or when auto-play is active
    if (gamePhase !== 'playerTurn' && gamePhase !== 'autoPlay') return;
    setGamePhase('dealerTurn');
    setMessage('Dealer is playing...');
  };

  /**
   * Manages the dealer's drawing phase. Dealer stands on all 17.
   * Dealer loses if drawing 6 cards without reaching at least 17.
   */
  const dealerPlay = async () => {
    let currentDealerHand = [...dealerHand];
    let currentDeck = [...deck];
    let { total: dealerTotal } = calculateHandValue(currentDealerHand);

    // Dealer draws until total is 17 or more, or they bust, or reach 6 cards.
    while (dealerTotal < 17 && currentDealerHand.length < 6) {
      if (currentDeck.length === 0) {
        setMessage('Deck is empty! Dealer cannot draw more.');
        // This scenario should rarely happen if deck is managed well, but handle it
        break;
      }
      // Add a slight delay for visual effect
      await new Promise(resolve => setTimeout(resolve, 100)); // Reduced delay for faster auto-play
      const newCard = currentDeck.pop();
      currentDealerHand.push(newCard);
      setDealerHand([...currentDealerHand]); // Update UI
      setDeck([...currentDeck]); // Update deck state
      ({ total: dealerTotal } = calculateHandValue(currentDealerHand)); // Recalculate total
    }

    // Dealer loses if drawing 6 cards without reaching at least 17
    if (currentDealerHand.length === 6 && dealerTotal < 17) {
      setMessage('Dealer 6 Card Charlie! Dealer loses!');
      setBankroll(prev => prev + betAmount * 2);
      setGamePhase('result');
      setLastHandResult('Win');
    } else {
      // Determine winner after dealer completes hand
      determineWinner(playerHand, currentDealerHand, betAmount);
    }
    setLastDealerTotal(dealerTotal); // Set dealer's final total for message area
    setLastPlayerTotal(calculateHandValue(playerHand).total); // Set player's final total
    await new Promise(resolve => setTimeout(resolve, 100));
  };

  /**
   * Determines the winner of the hand based on final scores and game rules.
   * Updates bankroll and messages.
   * @param {Array<Object>} playerHand The player's final hand.
   * @param {Array<Object>} dealerHand The dealer's final hand.
   * @param {number} bet The amount bet on the hand.
   */
  const determineWinner = (playerHand, dealerHand, bet) => {
    const playerVal = calculateHandValue(playerHand).total;
    const dealerVal = calculateHandValue(dealerHand).total;

    let resultMessage = '';
    let handResult = '';
    let newBankroll = bankroll;

    // Player busts
    if (playerVal > 21) {
      resultMessage = 'You busted! Dealer wins.';
      handResult = 'Loss';
    }
    // Dealer busts
    else if (dealerVal > 21) {
      resultMessage = 'Dealer busted! You win!';
      newBankroll = bankroll + bet * 2;
      handResult = 'Win';
    }
    // Player 6-card Charlie (already handled in hitPlayer, but good to re-check for completeness or edge cases)
    else if (playerHand.length === 6 && playerVal <= 21) {
      resultMessage = '6 Card Charlie! You win automatically!';
      newBankroll = bankroll + bet * 2;
      handResult = 'Win';
    }
    // Dealer 6-card Charlie (already handled in dealerPlay)
    else if (dealerHand.length === 6 && dealerVal < 17) {
      resultMessage = 'Dealer 6 Card Charlie! Dealer loses!';
      newBankroll = bankroll + bet * 2;
      handResult = 'Win';
    }
    // Compare totals (neither busted or hit Charlie)
    else if (playerVal > dealerVal) {
      resultMessage = 'You win!';
      newBankroll = bankroll + bet * 2;
      handResult = 'Win';
    } else if (dealerVal > playerVal) {
      resultMessage = 'Dealer wins.';
      handResult = 'Loss';
    } else { // Push
      resultMessage = 'It\'s a push!';
      newBankroll = bankroll + bet; // Return bet
      handResult = 'Push';
    }

    setMessage(resultMessage);
    setLastHandResult(handResult);
    setGamePhase('result');
    if (newBankroll !== bankroll) {
      setBankroll(newBankroll);
    }
  };

  /**
   * Handles a single auto-play action for the player's turn.
   * Decides whether to hit or stand based on strategy.
   */
  const autoPlayPlayerTurnAction = () => {
    // Ensure we are still in autoPlayMode and playerTurn
    if (!autoPlayMode || gamePhase !== 'playerTurn') return;

    const { total: playerTotal } = calculateHandValue(playerHand);
    const playerCardCount = playerHand.length;

    // Immediately check if player busted or got 6-card Charlie from previous hit
    if (playerTotal > 21) {
      setMessage('Auto-play: Player busted!');
      // `hitPlayer` already transitions to 'result', so just return
      return;
    }
    if (playerCardCount === 6 && playerTotal <= 21) {
      setMessage('Auto-play: 6 Card Charlie! Player wins automatically!');
      // `hitPlayer` already transitions to 'result', so just return
      return;
    }

    const hitDecision = shouldAutoPlayHit(playerHand, dealerHand[0], playerCardCount);

    if (hitDecision) {
      setMessage('Auto-play: Hitting...');
      // Use a timeout to simulate a delay before the hit action
      //autoplayTimeoutRef.current = setTimeout(() => {
      hitPlayer(); // This will trigger a state update and re-run useEffect for next action
      //}, 100); // Reduced delay for faster auto-play
    } else {
      setMessage('Auto-play: Standing...');
      // Use a timeout to simulate a delay before the stand action
      //autoplayTimeoutRef.current = setTimeout(() => {
      standPlayer(); // This will trigger a state update and re-run useEffect for next action
      //}, 100); // Reduced delay for faster auto-play
    }
  };


  // --- useEffect Hooks ---

  // Effect to initialize the game once on component mount
  useEffect(() => {
    resetGame(); // Initialize state
  }, []);

  // Effect to trigger dealer's turn when gamePhase changes to 'dealerTurn'
  useEffect(() => {
    if (gamePhase === 'dealerTurn') {
      dealerPlay();
    }
  }, [gamePhase, dealerHand, playerHand]); // Dependencies: gamePhase to trigger, hands for dealerPlay logic

  // Effect to update points when throughput changes
  useEffect(() => {
    setPoints(Math.floor(throughput / 10));
  }, [throughput]);

  // Main useEffect for managing auto-play flow based on game phase
  useEffect(() => {
    // Always clear any pending timeout when this effect runs to prevent old actions
    if (autoplayTimeoutRef.current) {
      clearTimeout(autoplayTimeoutRef.current);
    }

    if (!autoPlayMode) {
      // If auto-play is off, ensure current timeout is cleared and exit
      return;
    }

    // Auto-play logic for each phase
    if (gamePhase === 'betting') {
      setMessage('Auto-play: Dealing new hand...');
      dealHand();
    } else if (gamePhase === 'playerTurn') {
      setMessage('Auto-play: Player\'s turn...');
      autoPlayPlayerTurnAction();
    } else if (gamePhase === 'dealerTurn') {
      // Dealer's turn is handled by the separate useEffect, which calls dealerPlay.
      // dealerPlay itself has internal delays. This phase is more of a waiting phase for auto-play.
      setMessage('Auto-play: Dealer is playing...');
    } else if (gamePhase === 'result') {
      setMessage(`Auto-play: Hand ended. ${lastHandResult}. Starting next hand...`);
      setGamePhase('betting');
    }

    // Cleanup: Clear timeout if the component unmounts or if dependencies change and the effect re-runs
    return () => {
      if (autoplayTimeoutRef.current) {
        clearTimeout(autoplayTimeoutRef.current);
      }
    };
  }, [autoPlayMode, gamePhase, playerHand, dealerHand, betAmount, throughput, lastHandResult]); // Added dependencies for auto-play logic consistency

  // New useEffect to handle setting gamePhase to 'betting' when autoPlayMode is turned off
  // This ensures the Deal button is re-enabled correctly for manual play.
  useEffect(() => {
    if (!autoPlayMode && gamePhase === 'result') {
      setGamePhase('betting');
      // We could also reset other things like messages here if needed for manual reset clarity
      // For now, the message stays from the previous hand, which is okay.
    }
  }, [autoPlayMode, gamePhase]);


  // --- Render Functions ---

  /**
   * Renders a single card.
   * @param {Object} card The card object to render.
   * @param {boolean} isHidden Whether the card should be displayed as hidden.
   * @returns {JSX.Element} The JSX element for the card.
   */
  const renderCard = (card, isHidden = false) => {
    if (isHidden) {
      return (
        <div className="bg-gray-700 text-white rounded-lg w-16 h-24 sm:w-20 sm:h-28 md:w-24 md:h-32 flex items-center justify-center text-3xl font-bold border-2 border-gray-500 shadow-lg select-none">
          ?
        </div>
      );
    }
    const cardColorClass = (card.suit === 'hearts' || card.suit === 'diamonds') ? 'text-red-600' : 'text-gray-900';
    return (
      <div className={`bg-white rounded-lg w-16 h-24 sm:w-20 sm:h-28 md:w-24 md:h-32 flex flex-col items-center justify-center p-1 sm:p-2 border-2 border-gray-400 shadow-lg transform hover:scale-105 transition-transform duration-200 select-none ${cardColorClass}`}>
        <span className="text-xl sm:text-2xl md:text-3xl font-bold">{card.rank}</span>
        <span className="text-sm sm:text-md md:text-lg">{getSuitSymbol(card.suit)}</span>
      </div>
    );
  };

  /**
   * Renders the player's and dealer's hands.
   * @param {Array<Object>} hand The array of card objects in the hand.
   * @param {boolean} isDealer Whether this is the dealer's hand (to hide second card).
   * @returns {JSX.Element} The JSX element for the hand display.
   */
  const renderHand = (hand, isDealer = false) => {
    return (
      <div className="flex flex-wrap justify-center gap-2 p-2">
        {hand.map((card, index) => (
          <React.Fragment key={index}>
            {isDealer && index === 1 && gamePhase !== 'result' && gamePhase !== 'dealerTurn' && gamePhase !== 'betting' ?
              renderCard(card, true) :
              renderCard(card)}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // --- Main Component Render ---
  return (
    <div className="min-h-screen min-w-screen bg-[#1C2E7A] text-white font-inter p-4 flex flex-col items-center justify-center space-y-6">
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-4 text-white-300 drop-shadow-lg">
        Royal Caribbean Video Blackjack Simulator
      </h1>

      {/* Scoreboard and Stats */}
      <div className="w-full max-w-4xl bg-gray-800 rounded-xl p-4 sm:p-6 shadow-2xl flex flex-wrap justify-around items-center gap-4 text-lg sm:text-xl md:text-2xl font-semibold border-b-4 border-yellow-500">
        <div className="flex flex-col items-center">
          <span>Bankroll:</span>
          <span className="text-yellow-300">${bankroll}</span>
        </div>
        <div className="flex flex-col items-center">
          <span>Throughput:</span>
          <span className="text-yellow-300">${throughput}</span>
        </div>
        <div className="flex flex-col items-center">
          <span>Points:</span>
          <span className="text-yellow-300">{points}</span>
        </div>
        <div className="flex flex-col items-center">
          <span>Bet:</span>
          <select
            className="bg-gray-700 text-white px-3 py-1 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 text-lg sm:text-xl md:text-2xl"
            value={betAmount}
            onChange={(e) => setBetAmount(parseInt(e.target.value))}
            disabled={gamePhase !== 'betting'}
          >
            {[1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map(amount => (
              <option key={amount} value={amount}>${amount}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Game Area */}
      <div className="w-full max-w-4xl bg-gray-800 rounded-xl p-4 sm:p-6 shadow-2xl flex flex-col gap-6 border-4 border-yellow-600">
        {/* Dealer Hand */}
        <div className="bg-gray-700 rounded-lg p-3 sm:p-4 shadow-inner">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-red-300">Dealer's Hand ({gamePhase === 'result' || gamePhase === 'dealerTurn' || gamePhase === 'betting' ? calculateHandValue(dealerHand).total : '?'})</h2>
          {renderHand(dealerHand, true)}
        </div>

        {/* Player Hand */}
        <div className="bg-gray-700 rounded-lg p-3 sm:p-4 shadow-inner">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-blue-300">Player's Hand ({calculateHandValue(playerHand).total})</h2>
          {renderHand(playerHand, false)}
        </div>

        {/* Control Buttons */}
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-6"> {/* Added mb-6 for spacing */}
          <button
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-full shadow-lg hover:shadow-xl transition duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl md:text-2xl"
            onClick={dealHand}
            disabled={(gamePhase !== 'betting' && gamePhase !== 'result') || autoPlayMode}
          >
            Deal
          </button>
          <button
            className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-full shadow-lg hover:shadow-xl transition duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl md:text-2xl"
            onClick={hitPlayer}
            disabled={gamePhase !== 'playerTurn' && gamePhase !== 'autoPlay'}
          >
            Hit
          </button>
          <button
            className="bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-full shadow-lg hover:shadow-xl transition duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl md:text-2xl"
            onClick={standPlayer}
            disabled={gamePhase !== 'playerTurn' && gamePhase !== 'autoPlay'}
          >
            Stand
          </button>
          <button
            className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-full shadow-lg hover:shadow-xl transition duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl md:text-2xl"
            onClick={() => {
              // Just toggle autoPlayMode. The gamePhase transition will be handled by useEffect.
              setAutoPlayMode(prev => {
                if (prev) { // If turning OFF auto-play
                  clearTimeout(autoplayTimeoutRef.current);
                  setMessage('Auto-play stopped.');
                } else { // If turning ON auto-play
                  setMessage('Auto-play started...');
                }
                return !prev;
              });
            }}
          >
            {autoPlayMode ? 'Stop Auto Play' : 'Auto Play'}
          </button>
          <button
            className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-full shadow-lg hover:shadow-xl transition duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl md:text-2xl"
            onClick={resetGame}
            disabled={autoPlayMode}
          >
            Reset Game
          </button>
        </div>

        {/* Game Messages */}
        <div className="bg-gray-900 text-yellow-400 p-3 sm:p-4 rounded-lg text-center text-lg sm:text-xl md:text-2xl font-bold border-2 border-yellow-500 min-h-[140px] flex flex-col justify-center">
          {message}
          {/* Always render the result container but conditionally hide its content to maintain static height */}
          <div className={`mt-2 text-md sm:text-lg text-white ${!lastHandResult ? 'opacity-0' : ''}`}>
            <p>Player Hand: {lastPlayerTotal}</p>
            <p>Dealer Hand: {lastDealerTotal}</p>
            <p>Result: <span className={lastHandResult === 'Win' ? 'text-green-400' : (lastHandResult === 'Loss' ? 'text-red-400' : 'text-gray-400')}>{lastHandResult}</span></p>
          </div>
        </div>
      </div>

      {/* Footer with basic info or credits */}
      <div className="mt-8 text-gray-300 text-sm sm:text-base text-center">
        <p>Dealer stands on all 17. No splits or doubles.</p>
        <p>Blackjack pays 1:1. Player wins automatically if reaching 6 cards &#8804; 21.</p>
        <p>Dealer loses if drawing 6 cards without reaching at least 17.</p>
      </div>
    </div>
  );
};

export default BlackjackGame;

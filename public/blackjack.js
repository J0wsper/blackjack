//Getting the socket
const socket = io();
const playerName = prompt('Choose a name!')

//Emitting the name so the server can register it.
socket.emit('name', `${playerName}`);

//Querying the elements that make up the game.
const hitButton = document.querySelector('#hit');
const stayButton = document.querySelector('#stay');
const resetButton = document.querySelector('#reset');
const playArea = document.querySelector('#playArea');
const bettingForm = document.getElementById('bettingForm');
const statsArea = document.getElementById('statsArea');
const bettingInput = document.getElementById('bettingInput');
const chatForm = document.getElementById('chatForm');
const messages = document.getElementById('chatArea');
const chatInput = document.getElementById('chatInput');
const totals = document.getElementById('totals');

let playerCards = [];
let points = 10;

//The buttons are disabled until players place their bets.
hitButton.disabled = true;
stayButton.disabled = true;

//Adding listeners to the buttons that emit to the server.
hitButton.addEventListener("click", () => {
    socket.emit('hitPressed', `${playerName}`);
});
stayButton.addEventListener("click", () => {
    socket.emit('stayPressed', `${playerName}`);
});
resetButton.addEventListener("click", () => {
    socket.emit('resetPressed', `${playerName}`);
});

//Reacts when a player chats.
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (chatInput.value) {
      socket.emit('chatMessage', chatInput.value);
      chatInput.value = '';
    }
});

//Reacts when a player places a bet.
bettingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (bettingInput.value) {
        socket.emit('betPlaced', ([playerName, bettingInput.value]));
        points -= bettingInput.value;
        bettingInput.value = '';
        bettingInput.disabled = true;
    }
})

//Function that prints out which cards have been drawn. Takes as arguments the card to be printed, which player drew it and the area it should be added to.
function printDrawn(player,card,area) {
    const para = document.createElement('p');
    para.textContent = `${player} drew a ${card}!`;
    area.appendChild(para);
}

//Function that tallies how many points are in a hand.
function countCards(hand) {
    let handTotal = 0;
    for (let card of hand) {
        const cardArray = card.split(' ');
        if (cardArray[0] === 'King' || cardArray[0] === 'Queen' || cardArray[0] === 'Jack') {
            handTotal += 10;
        }
        else if (cardArray[0] === 'Ace') {
            if (handTotal + 11 > 21) {
                handTotal += 1;
            }
            else {
                handTotal += 11;
            }
        }
        else {
            handTotal += Number(cardArray[0]);
        }
    }
    return handTotal;
}

//Prints the players' totals.
function printTotals(player,playerTotal) {
    console.log('totals printing')
    const para = document.createElement('li');
    para.className = 'removable';
    para.textContent = `${player}'s total: ${playerTotal}`;

    //Removes the element that displayed a player's previous total.
    const children = totals.children;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if ((child.classList.contains('removable')) && (child.textContent.includes(`${player}`))) {
            totals.removeChild(child);
        }
    }
    totals.appendChild(para);
    console.log('totals printed')
}

//Handles when the server tells everyone that the game has started.
socket.on('gameStart', ([player, card1, card2]) => {
    
    //If the emitted player is this socket, add the two starting cards to its deck.
    if (player == playerName) {
        playerCards.push(card1);
        playerCards.push(card2);

        //Shows everyone what the player's new totals are..
        const playerTotal = countCards(playerCards);
        socket.emit('newTotal', ([player,playerTotal]));
    }

    //Show to everyone which cards have been drawn.
    printDrawn(player,card1,statsArea);
    printDrawn(player,card2,statsArea);

    //Re-enables all the buttons.
    hitButton.disabled = false;
    stayButton.disabled = false;
})

//Printing whenever someone draws a card.
socket.on('drawnCard', ([player,card]) => {
    printDrawn(player,card,playArea);
});

//Prints a player's new total
socket.on('newTotal',([player,playerTotal]) => {
    printTotals(player,playerTotal);
})

//Checks if the player name is invalid when the server finds a discrepancy.
socket.on('invalidName', () => {
    if (playerName === undefined) {
        const playerName = prompt('Choose a name!')
        socket.emit('name',playerName);
    }
})

//Handles when the server gives the go ahead to hit
socket.on('hit', ([player, card]) => {

    //If this socket is the one that the server told to go ahead.
    if (player === playerName) {
        playerCards.push(card);

        //Emits the signal to tell everyone a card has been drawn.
        socket.emit('drawnCard', ([`${playerName}`,card]));

        //Counts the player's cards.
        const playerTotal = countCards(playerCards);

        //Handles when a player's total is over 21
        if (playerTotal > 21) {
            socket.emit('bust', `${playerName}`);

            //Disables all the buttons.
            hitButton.disabled = true;
            stayButton.disabled = true;
        }

        //Emits the player's current total to display.
        socket.emit('newTotal', ([player,playerTotal]));
    }
});

//Handles when the server says that the dealer has hit.
socket.on('dealerHit', ([card,dealerCards]) => {
    printDrawn('Dealer',card,playArea);
})

socket.on('stay', (player) => {
    if (player === playerName) {

        //Disables the hit and stay buttons.
        hitButton.disabled = true;
        stayButton.disabled = true;

        //Emits a signal containing the player total.
        const finalTotal = countCards(playerCards);
        socket.emit('finalTotal', ([playerName, finalTotal]));
    }

    //Announces that the player stayed to every socket.
    const para = document.createElement('p');
    para.textContent = `${player} stayed.`;
    playArea.appendChild(para);
})

//Deals with printing text when a player goes bust.
socket.on('bust', (playerName) => {
    const para = document.createElement('p');
    para.textContent = `${playerName} went bust! Better luck next time!`;
    playArea.appendChild(para);
})

//Deals with printing when the dealer goes bust.
socket.on('dealerBust', () => {
    const para = document.createElement('p');
    para.textContent = 'The dealer went bust! Congratulations';
}) 

//Handles what happens when the server says that a chat message has been received.
socket.on('chatMessage', (msg) => {
    const item = document.createElement('li');
    item.textContent = msg;
    chatArea.appendChild(item);
    window.scrollTo(0, document.body.scrollHeight);
});

import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import { error } from 'node:console';

const app = express();
const server = createServer(app);
const io = new Server(server);

const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(express.static('public'))

//Sending the blackjack html file 
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'blackjack.html'));
});

//Sending the blackjack js file
app.get('/blackjack.js', function(req, res) {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(__dirname + '/public/blackjack.js');
});

//Sending the CSS stylesheet
app.get('/styles.css',function(req,res) {
  res.setHeader('Content-Type','styles/css')
  res.sendFile(__dirname + '/public/styles.css')
})

//Creating a Deck class
class Deck {
  constructor() {
      this.deck = [];
      
      const suits = ['Hearts','Spades','Clubs','Diamonds'];
      const values = ['2','3','4','5','6','7','8','9','10','Jack','Queen','King','Ace'];

      for (const suit of suits) {
          for (const value of values) {

              this.deck.push(`${value} of ${suit}`);

          }
      }
  }

  //Giving the deck a draw method
  draw() {
      const cardIndex = getRandomInt(this.deck.length-1);
      const card = this.deck[cardIndex];
      this.deck.splice(cardIndex,1);
      return card;
  }
}

//Some essential global variables.
let mainDeck = new Deck();
let dealerCards = [];
let players = [];
let bustPlayers = [];
let stayedPlayers = [];
let playerBets = [];
let currentPlayer = 0;

//Dummy function that is used in the draw function
function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

//Function to check if two arrays are equal in elements.
function equalArrays(arr1, arr2) {

  //If the arrays aren't equal length, they aren't the same.
  if (arr1.length != arr2.length) {
    return false;
  }

  //Creates new arrays so as not to mutate the originals.
  let sortedArr1 = arr1;
  let sortedArr2 = arr2;

  //Sorts the new arrays.
  sortedArr1.sort();
  sortedArr2.sort();

  //Checks each element of the arrays.
  for (let i = 0; i < arr1.length; i++) {
    if (sortedArr1[i] != sortedArr2[i]) {
      return false;
    }
  }

  //If it passes both tests, they are the same array.
  return true;
}

//Function that takes two arrays and returns which elements aren't in both of them.
function dissimilarArrays(arr1,arr2) {
  let returnedArr = [];
  if (arr1.length < arr2.length) {
    for (let e of arr2) {
      if (arr1.includes(e) == false) {
        returnedArr.push(e)
      }
    }
  }
  else {
    for (let e of arr1) {
      if (arr2.includes(e) == false) {
        returnedArr.push(e);
      }
    }
  }
  return returnedArr
}

//Function that controls dealer hits.
function dealerHit() {

  //Creates the inPlayers array that will
  const stayed = playersParser(stayedPlayers,'players');
  const outPlayers = bustPlayers.concat(stayed);
  const inPlayers = dissimilarArrays(outPlayers, players);
  
  //Checks that it is the dealer's turn and his hand isn't over 17.
  if ((currentPlayer >= inPlayers.length) && (countCards(dealerCards) < 17)) {
    const card = mainDeck.draw();
    dealerCards.push(card);
    io.emit('dealerHit', ([card,dealerCards]));
    currentPlayer = 0;
  }

  //For when the dealer goes bust.
  if (countCards(dealerCards) > 21) {
    io.emit('dealerBust');
    for (let player of players) {
      
    }
  }
}

//Simple dummy function to check whose turn it is.
function turnChecker(player) {

  //If the player is bust or out, then it isn't their turn.
  if (bustPlayers.includes(player) || stayedPlayers.includes(player)) {
    currentPlayer += 1;
    return false;
  }

  if (players[currentPlayer] === player) {
    return true;
  }
  else {
    return false;
  }
}

//Deals with when there is an out player in the turn order.
function outHandler() {

  const stayed = playersParser(stayedPlayers,'players');
  const outPlayers = bustPlayers.concat(stayed);
  if (equalArrays(players,outPlayers) || currentPlayer >= players.length) {
    console.log('outHandler quitting')
    return;
  }
  else {
    while (outPlayers.includes(players[currentPlayer])) {
      console.log('outHandler iterating')
      currentPlayer++;
    }
  }
  console.log(equalArrays(players,outPlayers));
  console.log(players.length);
  console.log(outPlayers);
  console.log('outHandler done')
}

//Function that tallies how many points are in a hand.
function countCards(hand) {
  let handTotal = 0;
  for (let card of hand) {
      const cardArray = card.split(' ');

      //Adds 10 for each of the face cards.
      if (cardArray[0] === 'King' || cardArray[0] === 'Queen' || cardArray[0] === 'Jack') {
          handTotal += 10;
      }

      //Adds 1 if the 11 would push the hand over 21, otherwise adds 11.
      else if (cardArray[0] === 'Ace') {
          if (handTotal + 11 > 21) {
              handTotal += 1;
          }
          else {
              handTotal += 11;
          }
      }

      //For numbered cards, adds the numerical value.
      else {
          handTotal += Number(cardArray[0]);
      }
  }
  return handTotal;
}

/*Dummy function that parses the outPlayers array. Also takes a string 'arg' to determine
whether to return which players are out or to return their totals.*/
function playersParser(arr, arg) {

  //Creates the array that will be returned.
  let returnedArr = [];

  //Determines which element will be picked out.
  let a
  if (arg === 'players') {
    a = 0;
  }
  else if (arg === 'count') {
    a = 1;
  }
  else {
    return Error('outPlayersParser used incorrectly.')
  }

  //Iterates through parsedArr and picks out the desired element
  for (let i = 0; i < arr.length; i++) {
    returnedArr.push(arr[i][a]);
  }

  return returnedArr;
}


//Function that starts the game and deals the first 2 cards to every player.
function gameStart() {
  for (let player of players) {
    const card1 = mainDeck.draw();
    const card2 = mainDeck.draw();
    io.emit('gameStart', ([player,card1,card2]));

    //Handles if a player gets a natural.
    if (countCards([card1,card2]) == 21) {
      io.emit('natural',player);
    }
  }
}

//Everything below here is to do with communication between the server and the client.
io.on('connection', (socket) => {
  console.log('a user connected');
  
  //Adding a player name to the list.
  socket.on('name', (playerName) => {
    if (playerName != undefined) {
      players.push(playerName);
    }
    else {
      io.emit('invalidName');
    }
  });

  //Adds a player's bet to the pool.
  socket.on('betPlaced', ([playerName,bet]) => {
    if (playerName != undefined) {
      playerBets.push([playerName, bet]);
    }
    else {
      io.emit('invalidName');
    }

    //Checks to see if the game can start.
    let haveBet = playersParser(playerBets, 'players')
    if (equalArrays(haveBet,players)) {
      gameStart();
    }
  });

  //Bouncing the drawnCard signal to all clients.
  socket.on('drawnCard', ([playerName,drawnCard]) => {
    io.emit('drawnCard',([playerName,drawnCard]));
  });

  //Bouncing the newTotal signal to all clients so they can see what everyone's total is.
  socket.on('newTotal', ([player,newTotal]) => {
    io.emit('newTotal', ([player,newTotal]));
  });

  //Handling when a player presses the hit button
  socket.on('hitPressed', (player) => {

    console.log(currentPlayer);
    outHandler();
    console.log(currentPlayer);

    //Checks if it is the requesting player's turn and if so, returns the appropriate signal.
    if (turnChecker(player)) {
      io.emit('hit', ([player, mainDeck.draw()]));
      currentPlayer += 1;
    }

    //Checks if the dealer will hit.
    dealerHit();

  });

  //Handles what happens when the stay button is pressed.
  socket.on('stayPressed', (player) => {

    console.log(currentPlayer);
    outHandler();
    console.log(currentPlayer);

    //Checks if its the requesting player's turn and if it is, sends back the appropriate signal.
    if (turnChecker(player)) {
      io.emit('stay', (player));
    }

    //Checks to see if the dealer will hit.
    dealerHit();

  });

  //Saves a variable with the player total for when points are tallied later.
  socket.on('finalTotal', ([playerName,finalTotal]) => {
    console.log('final total incoming');
    console.log(currentPlayer);
    stayedPlayers.push(([playerName, finalTotal]));
    const outPlayers = stayedPlayers.concat(bustPlayers);
    const parsedPlayers = playersParser(outPlayers,'players');

    console.log(parsedPlayers);
    console.log(players);

    if (equalArrays(parsedPlayers,players)) {
      console.log('game over')
      const parsedTotals = playersParser(outPlayers,'count');
    }
  });

  //Handles when a player goes bust.
  socket.on('bust', (playerName) => {
    io.emit('bust', (playerName));

    //Adds that player's name to the bustPlayers array.
    const index = players.indexOf(playerName);
    bustPlayers.push(players[index]);
  });


  //Handles chat messages.
  socket.on('chatMessage', (msg) => {
    io.emit('chatMessage', msg);
  });


});

//Just tells me that the server is running.
server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});
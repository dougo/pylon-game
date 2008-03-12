/*
main.js -- ECMAScript code for the Pylon Volity SVG UI module.
Copyright 2008 Doug Orleans.  This program is distributed under the
terms of the GNU Affero General Public License.  See the file COPYING
for details.
*/


// Incoming RPCs

receivingState = false;

volity.game_has_started = function() {
  receivingState = true;
};

volity.state_sent = function() {
  if (receivingState) {
    receivingState = false;
    displayState();
  }
};

volity.suspend_game = function() {
  updateMessage();
};

volity.resume_game = function() {
  displayState();
};

volity.end_game = function() {
  setWinners();
  whoseTurn = null;
  if (!receivingState)
    displayState();
};



game.start = function(seat) {
  initState();
  whoseTurn = seat;
  if (!receivingState)
    displayState();
};

game.placed = function(size, pos) {
  var stack = popStack(whoseTurn, size);
  putStack(pos, stack);
  scores[whoseTurn]++;
  var pyramids = 0;
  for (var seat in stashes)
    for (var size = 0; size < sizes; size++)
      pyramids += getPyramids(seat, size);
  // If all stashes are empty, the current player goes again to start
  // the stacking phase, i.e. only call nextTurn if at least one stash
  // has pyramids remaining.
  if (pyramids > 0)
    nextTurn();
  if (!receivingState)
    displayState();
};

game.stacked = function(from, to) {
  var topStack = getStack(from);
  removeStack(from);
  var bottomStack = getStack(to);
  putStack(to, topStack.concat(bottomStack));
  scores[bottomStack[0].seat] -= bottomStack.length;
  scores[topStack[0].seat] += bottomStack.length;
  nextTurn();
  if (!receivingState)
    displayState();
};


sizes = 3;

rows = 5;
cols = 6;

board = null;
stashes = null;

whoseTurn = null;
scores = null;
winners = null;

function initState() {
  board = {};
  // TO DO: generate these
  stashes = {seat1: [5, 5, 5], seat2: [5, 5, 5]};
  scores = {seat1: 0, seat2: 0};
  whoseTurn = null;
  winners = null;
}


function nextTurn() {
  whoseTurn = (whoseTurn == "seat1" ? "seat2" : "seat1");
}


function makePosition(row, col) { return [row, col]; }
function row(pos) { return pos[0]; }
function col(pos) { return pos[1]; }
function x(pos) { return col(pos); }
function y(pos) { return row(pos); }

// This is for using positions as keys in an associative array, which
// must be strings in Javascript.  For some reason, RPC arrays don't
// print this way (they print as "[row, col]"), so we have to form the
// key string explicitly.
function key(pos) { return row(pos) + "," + col(pos); }


function getStack(pos) {
  var cell = board[key(pos)];
  return cell ? cell.stack : null;
}

function putStack(pos, stack) {
  board[key(pos)] = {pos: pos, stack: stack};
}

function removeStack(pos) {
  delete board[key(pos)];
}

function forEachStack(f) {
  for each (var cell in board)
    f(cell.pos, cell.stack);
}


// Return the number of pyramids of a particular size in a stash.
function getPyramids(seat, size) {
  // Seat might be an object, which needs to be explicitly converted
  // to a string before being used as an associative array key.
  // TO DO: is this a Gamut bug?  it "==" a string, why not print as a string?
  return stashes[seat+""][size];
}

// Remove a pyramid from a stash and return it as a stack.
function popStack(seat, size) {
  stashes[seat+""][size]--;
  return [{seat: seat, size: size}];
}

// The current phase of the game, either "placement" or "stacking".
function getPhase() {
  for (var size = 0; size < sizes; size++)
    if (getPyramids(whoseTurn, size) != 0) return "placement";
  return "stacking";
}

// Assuming "from" is a valid move source, return true iff "to" is a
// valid move target.
function isValidMove(from, to) {
  if (row(to) < 0 || row(to) >= rows || col(to) < 0 || col(to) >= cols)
    return false;
  var bottom = getStack(to);
  if (getPhase() == "placement")
    return !getStack(to);
  if (!getStack(to))
    return false;
  var rowdiff = Math.abs(row(from) - row(to));
  var coldiff = Math.abs(col(from) - col(to));
  if (!(rowdiff == 1 && coldiff == 0 ||
	rowdiff == 0 && coldiff == 1))
    return false;
  var top = getStack(from);
  return top[top.length - 1].size <= bottom[0].size;
}


function setWinners() {
  winners = [];			// should be {}
  var highScore = 0;
  for (seat in scores)
    if (scores[seat] > highScore) {
      highScore = scores[seat];
      winners = [];		// should be {}
      winners[seat] = "win";
    } else if (scores[seat] == highScore)
      winners[seat] = "win";
}


// UI (Views)

function displayState() {
  if (whoseTurn)
    seatmark(whoseTurn);
  else if (winners)
    seatmark(winners);
  else
    seatmark();
  drawBoard();
  drawStashes();
  drawScores();
  updateMessage();
  clearDragObject();
}


svgNS = "http://www.w3.org/2000/svg";
xlinkNS = "http://www.w3.org/1999/xlink";

svg = document.rootElement;

function makeGroup(parent) {
  return parent.appendChild(document.createElementNS(svgNS, "g"));
}

function moveXY(node, x, y) {
  node.setAttribute("transform", "translate(" + x + "," + y + ")");
  return node;
}

function hide(node) {
  if (node && node.parentNode)
    node.parentNode.removeChild(node);
}

function raise(node) {
  node.parentNode.appendChild(node);
  if (node.parentNode != svg) raise(node.parentNode);
}

function makeSquare(size, parent) {
  var square = document.createElementNS(svgNS, "rect");
  square.setAttribute("style", "stroke:black; stroke-width:0.04");
  square.setAttribute("width", size);
  square.setAttribute("height", size);
  return parent.appendChild(square);
}

// Draw the board:

boardView = makeGroup(svg);
for (var c = 0; c < cols; c++) {
  for (var r = 0; r < rows; r++) {
    var square = makeSquare(1, boardView);
    square.setAttribute("fill-opacity", 0);
    moveXY(square, c, r);
  }
}



// TO DO: make this configurable
// Note that these colors are also hardcoded in the SVG metadata.  :(
colors = {seat1: "red", seat2: "deepskyblue"};


function makePyramid(size, parent) {
  var width = 0.3 + (size+1)/6;
  var pyramid = makeSquare(width, parent);
  moveXY(pyramid, (1-width)/2, (1-width)/2); // centered in 1x1 square
  return pyramid;
}

textStyle =
  "font-family: sans-serif; "+
  "font-weight: bold; "+
  "font-size: 0.3; "+
  "pointer-events:none;";

function makeHeightLabel(height, parent) {
  var text = document.createElementNS(svgNS, "text");
  text.setAttribute("style", textStyle);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("y", 0.2);
  text.textContent = height;
  moveXY(text, 0.5, 0.4);
  return parent.appendChild(text);
}

function makeStackView(stack, parent) {
  var group = makeGroup(parent);
  var owner = stack[0].seat;
  var height = stack.length;
  var topSize = stack[0].size;
  makePyramid(topSize, group).setAttribute("fill", colors[owner]);
  if (height > 1) {
    var bottomSize = stack[height-1].size;
    if (bottomSize > topSize)
      makePyramid(bottomSize, group).setAttribute("fill-opacity", 0);
    makeHeightLabel(height, group);
  }
  group.setAttribute("onmousedown", "grabBoardStack(evt)");
  return group;
}


boardStacks = null;

function drawBoard() {
  hide(boardStacks);
  boardStacks = makeGroup(boardView);
  forEachStack(drawStack);
}

function drawStack(pos, stack) {
  var stackView = makeStackView(stack, boardStacks);
  moveXY(stackView, x(pos), y(pos));
}

stashViews = null;

// Stashes are displayed as sets of stacks.
function drawStashes() {
  hide(stashViews);
  stashViews = makeGroup(svg);
  var y = 0;
  for (var seat in stashes) {
    var group = makeGroup(stashViews);
    var x = 0;
    for (var size = 0; size < sizes; size++) {
      var height = getPyramids(seat, size);
      if (height > 0) {
	var stack = makeGroup(group);
	makePyramid(size, stack).setAttribute("fill", colors[seat]);
	if (height > 1)
	  makeHeightLabel(height, stack);
	moveXY(stack, x, 0);
	stack.setAttribute("onmousedown",
			   "grabStashStack(evt, \"" +
			   seat + "\", " + size + ")");
      }
      x++;
    }
    moveXY(group, cols, rows/2 + y*3 - 2);
    y++;
  }
}

scoreViews = null;

function drawScores() {
  hide(scoreViews);
  if (whoseTurn && getPhase() == "placement") return;
  scoreViews = makeGroup(svg);
  var y = 0;
  for (var seat in scores) {
    var group = makeGroup(scoreViews);
    var text = document.createElementNS(svgNS, "text");
    text.setAttribute("style", textStyle);
    text.textContent = seat + ": " + scores[seat];
    group.appendChild(text);
    // TO DO: show color somehow-- background rectangle maybe?
    moveXY(group, cols + 0.2, rows/2 + y*3 - 1.5);
    y++;
  }
}


// Text message below the board:
message = document.createElementNS(svgNS, "text");
message.setAttribute("style", textStyle);
message.textContent = "Pylon";
svg.appendChild(message);
moveXY(message, cols + 0.2, rows/2);

function setMessage(msg) {
  message.textContent = msg;
}

function updateMessage() {
  if (info.state == "setup")
    setMessage("Pylon");
  else if (info.state == "suspended")
    setMessage("Game is suspended.");
  else if (winners)
    setMessage("Game over.");
  else if (whoseTurn != info.seat)
    setMessage("Waiting for " + whoseTurn + "...");
  else if (getPhase() == "placement")
    setMessage("Place a pyramid.");
  else
    setMessage("Move a stack.");
}



// Drag & drop stuff:

dragObject = null;
dragMatrix = null;
dragFrom = null;
dragTo = null;
dragSize = null;
dragOffset = svg.createSVGPoint();

function clearDragObject() {
  hide(dragObject);
  dragFrom = null;
  dragSize = null;
}

// Return the mouse location of the event ev in the viewport
// coordinate space.
function getPoint(ev) {
  var pt = svg.createSVGPoint();
  pt.x = ev.clientX;
  pt.y = ev.clientY;
  return pt;
}

// Return the mouse location of the event ev in the boardView
// coordinate space.
function getDragPoint(ev) {
  return getPoint(ev).matrixTransform(dragMatrix);
}

// Return the mouse location of the event ev in the event target's
// coordinate space.
function getDragOffset(ev) {
  return getPoint(ev).matrixTransform(ev.currentTarget.getCTM().inverse());
}

// Return the board position containing the boardView coordinate pt.
function getPosition(pt) {
  return makePosition(Math.floor(pt.y), Math.floor(pt.x));
}

function grabStack(ev) {
  raise(dragObject);
  // Record the CTM once, assuming that the board can't be zoomed or
  // panned while dragging!
  dragMatrix = boardView.getCTM().inverse();
  // Adjust from the mouse point to the upper left corner of the stack.
  dragOffset = getDragOffset(ev);
  svg.setAttribute("onmousemove", "dragStack(evt)");
  svg.setAttribute("onmouseup", "dropStack(evt)");
}

function grabBoardStack(ev) {
  if (info.seat != whoseTurn || getPhase() != "stacking") return;
  dragObject = ev.currentTarget;
  grabStack(ev);
  var pt = getDragPoint(ev);
  dragFrom = getPosition(pt);
}

function grabStashStack(ev, seat, size) {
  if (seat != info.seat ||
      info.seat != whoseTurn ||
      getPhase() != "placement" ||
      getPyramids(seat, size) == 0)
    return;
  dragObject = makeStackView([{seat: seat, size: size}], boardView);
  grabStack(ev);
  dragStack(ev); // move it to the same location as the stash stack
  dragSize = size;
}

function dragStack(ev) {
  var pt = getDragPoint(ev);
  moveXY(dragObject, pt.x - dragOffset.x, pt.y - dragOffset.y);
}

function dropStack(ev) {
  svg.removeAttribute("onmousemove");
  svg.removeAttribute("onmouseup");
  var pt = getDragPoint(ev);
  var pos = getPosition(pt);
  if (isValidMove(dragFrom, pos)) {
    moveXY(dragObject, x(pos), y(pos));
    dragTo = pos;
    sendMove();
  } else {
    if (dragFrom)
      // Put it back where it started.
      moveXY(dragObject, x(dragFrom), y(dragFrom));
    else
      hide(dragObject);
    dragFrom = null;
  }
}

function sendMove() {
  // This handles a possible race condition if the user grabs a stack
  // before the previous move has been registered:
  // TO DO: can this happen?  better way to prevent this?
  // if (whoseTurn != info.seat) return;
  if (dragFrom)
    rpc("stack", dragFrom, dragTo);
  else
    rpc("place", dragSize, dragTo);
}

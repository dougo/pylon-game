# pylon.py -- Pylon game module for the Python Volity framework.
# Copyright 2008 Doug Orleans.  This program is distributed under the
# terms of the GNU Affero General Public License.  See the file
# COPYING for details.

import volity.game
import itertools
import random

class Game(volity.game.Game):

    gamename = "Pylon"
    gamedescription = "Pylon: an abstract strategy game" \
                      " of placement and stacking"
    ruleseturi = "http://steak.place.org/games/pylon/ruleset.html"
    websiteurl = "http://www.icehousegames.org/wiki/index.php?title=Pylon"

    def __init__(self, ref):
        volity.game.Game.__init__(self, ref)
        self.setopset(self)
        volity.game.Seat(self, "seat1")
        volity.game.Seat(self, "seat2")
        self.validatecalls("place", afoot=True, seated=True, args=[int, list])
        self.validatecalls("stack", afoot=True, seated=True, args=[list, list])

    def begingame(self):
        # TO DO: these could be configurable
        self.rows = 5
        self.cols = 6
        self.pyramidSizes = 3
        self.stashSize = 5
        self.history = []
        self.turnSequence = itertools.cycle(self.getseatlist())
        self.curSeat = self.turnSequence.next()
        self.board = {}
        for seat in self.getseatlist():
            seat.stash = [self.stashSize] * self.pyramidSizes
        self.sendtable("start", self.curSeat)
        # TO DO: only do random placement if configured
        # self.doRandomSetup()

    def rpc_place(self, sender, size, pos):
        seat = self.getplayerseat(sender)
        if seat != self.curSeat:
            raise volity.game.FailureToken("notYourTurn")
        if seat.stash[size] == 0:
            raise volity.game.FailureToken("emptyStash")
        pos = tuple(pos)
        if not self.isLegalPosition(pos):
            raise volity.game.FailureToken("illegalPosition")
        if self.board.has_key(pos):
            raise volity.game.FailureToken("occupiedPosition")
        self.place(size, pos)

    def rpc_stack(self, sender, fromPos, toPos):
        seat = self.getplayerseat(sender)
        if seat != self.curSeat:
            raise volity.game.FailureToken("notYourTurn")
        if any(num > 0 for num in seat.stash):
            raise volity.game.FailureToken("placementPhase")
        fromPos = tuple(fromPos)
        toPos = tuple(toPos)
        if not self.isLegalPosition(fromPos) or not self.isLegalPosition(toPos):
            raise volity.game.FailureToken("illegalPosition")
        if not areAdjacentPositions(fromPos, toPos):
            raise volity.game.FailureToken("notAdjacentPositions")
        if not self.board.has_key(fromPos) or not self.board.has_key(toPos):
            raise volity.game.FailureToken("notOccupiedPosition")
        top = self.board[fromPos]
        bottom = self.board[toPos]
        if not self.canStack(top, bottom):
            raise volity.game.FailureToken("invalidStack")
        self.stack(fromPos, toPos);

    def isLegalPosition(self, pos):
        return 0 <= row(pos) < self.rows and 0 <= col(pos) < self.cols

    def canStack(self, top, bottom):
        return top[-1].size <= bottom[0].size
    
    def place(self, size, pos):
        self.curSeat.stash[size] -= 1
        self.board[pos] = [Pyramid(self.curSeat, size)]
        self.sendtable("placed", size, pos)
        if all(num == 0 for seat in self.getseatlist() for num in seat.stash):
            # If the last pyramid was just placed, i.e. all stashes
            # are empty, the current player goes again.
            pass
        else:
            self.endTurn()

    def stack(self, fromPos, toPos):
        self.board[toPos] = self.board[fromPos] + self.board[toPos]
        del self.board[fromPos]
        self.sendtable("stacked", fromPos, toPos)
        if self.isGameOver():
            self.endGame()
        else:
            self.endTurn()

    def sendtable(self, *args):
        self.history.append(args)
        volity.game.Game.sendtable(self, *args)

    def sendgamestate(self, player, seat):
        for args in self.history:
            self.sendplayer(player, *args)

    def endTurn(self):
        self.curSeat = self.turnSequence.next()

    def isGameOver(self):
        return not any(self.legalStackings())

    def legalStackings(self):
        for fromPos in self.board.keys():
            top = self.board[fromPos]
            for toPos in getAdjacentPositions(fromPos):
                if self.board.has_key(toPos):
                    bottom = self.board[toPos]
                    if self.canStack(top, bottom):
                        yield [fromPos, toPos]

    def endGame(self):
        self.gameover(*self.sortseats(lambda seat: self.score(seat)))
        self.curSeat = None

    def score(self, seat):
        return sum([len(stack) for stack in self.board.values()
                    if stack[0].seat == seat])

    def doRandomSetup(self):
        for i in range(self.rows * self.cols):
            self.placeRandomly()

    def placeRandomly(self):
        sizes = [size for size in range(self.pyramidSizes)
                 for i in range(self.curSeat.stash[size])]
        posns = [(row, col)
                 for row in range(self.rows)
                 for col in range(self.cols)
                 if not self.board.has_key((row, col))]
        self.place(random.choice(sizes), random.choice(posns))

    def stackRandomly(self):
        self.stack(*random.choice(list(self.legalStackings())))


class Pyramid:
    def __init__(self, seat, size):
        self.seat = seat
        self.size = size

# Position-related utility functions:

def row(pos):
    return pos[0]

def col(pos):
    return pos[1]

def areAdjacentPositions(pos1, pos2):
    rowdiff = abs(row(pos1) - row(pos2))
    coldiff = abs(col(pos1) - col(pos2))
    return (rowdiff == 1 and coldiff == 0 or
            rowdiff == 0 and coldiff == 1)

def getAdjacentPositions(pos):
    return [(row(pos)-1, col(pos)), (row(pos), col(pos)+1),
            (row(pos)+1, col(pos)), (row(pos), col(pos)-1)]

class RandomBot(volity.bot.Bot):
    gameclass = Game
    boturi = "http://steak.place.org/games/pylon/random.html"
    ruleseturi = Game.ruleseturi
    rulesetversion = Game.rulesetversion

    def __init__(self, actor):
        volity.bot.Bot.__init__(self, actor)
        self.setopset(self)
        self.game = actor.referee.game

    def rpc_start(self, sender, seat):
        self.maybeMove()

    def rpc_placed(self, sender, size, pos):
        self.maybeMove()

    def rpc_stacked(self, sender, fromPos, toPos):
        self.maybeMove()

    def maybeMove(self):
        myseat = self.game.getownseat()
        curSeat = self.game.curSeat
        if myseat and curseat and myseat.id == curSeat.id:
            self.move()

    def move(self):
        if any(num > 0 for num in self.game.curSeat.stash):
            self.game.placeRandomly()
        else:
            self.game.stackRandomly()

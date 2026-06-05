# E2E Test Infra: Snakes & Ladders Game Mode

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise + Workload Testing.
- Run programmatically using Node/ts-node. The runner connects to the game server via `socket.io-client` for multiplayer sync testing, and runs offline logic/simulations for solo play.

## Feature Inventory
| # | Feature | Description | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|-------------|:------:|:------:|:------:|:------:|
| 1 | F1. Dice rolling & Extra Turn on 6 | Rolling 1-6; extra turn when rolling 6 | 5 | 5 | ✓ | ✓ |
| 2 | F2. Forward board movement | Moving player from cell 1 to 100 | 5 | 5 | ✓ | ✓ |
| 3 | F3. Overflow bounce | Bouncing backwards when roll exceeds cell 100 | 5 | 5 | ✓ | ✓ |
| 4 | F4. Snake head slide | Sliding down from head to tail immediately | 5 | 5 | ✓ | ✓ |
| 5 | F5. Ladder climb | Climbing up from base to top immediately | 5 | 5 | ✓ | ✓ |
| 6 | F6. Bot AI automatic turns | Automatic dice rolling and extra turns for AI | 5 | 5 | ✓ | ✓ |
| 7 | F7. Online sync & Offline solo | Rooms, bot adding, host transfer, reconnect, and offline solo | 5 | 5 | ✓ | ✓ |

---

## Test Cases

### Tier 1: Feature Coverage (35 Tests)

#### F1: Dice rolling & Extra Turn on 6
- **TC-F1-01**: Rolling dice returns a value between 1 and 6.
- **TC-F1-02**: Rolling a 6 grants the active player an extra turn.
- **TC-F1-03**: Rolling a 6, then rolling a 3, correctly advances turn after the second roll.
- **TC-F1-04**: Rolling a 6 does not allow other players to roll out of turn.
- **TC-F1-05**: Normal rolls (1-5) advance the turn to the next player immediately.

#### F2: Forward board movement (1-100)
- **TC-F2-01**: Player starting at position 1 rolls 3 and moves to position 4.
- **TC-F2-02**: Player position updates on normal (non-snake, non-ladder) cells.
- **TC-F2-03**: Consecutive turns accumulate positions correctly (e.g. pos 4 + roll 5 = pos 9).
- **TC-F2-04**: Player position is correctly synchronized across all clients in the room.
- **TC-F2-05**: Landing exactly on cell 100 triggers a game-over/victory state.

#### F3: Overflow bounce from cell 100
- **TC-F3-01**: Player on cell 98 rolls 4 -> moves to 100, then bounces back 2 to cell 98.
- **TC-F3-02**: Player on cell 99 rolls 3 -> moves to 100, then bounces back 2 to cell 98.
- **TC-F3-03**: Player on cell 97 rolls 6 -> moves to 100, then bounces back 3 to cell 97.
- **TC-F3-04**: Player on cell 96 rolls 5 -> moves to 100, then bounces back 1 to cell 99.
- **TC-F3-05**: Player on cell 95 rolls 6 -> moves to 100, then bounces back 1 to cell 99.

#### F4: Snake head slide downwards
- **TC-F4-01**: Landing on a snake head slides the player down to the tail.
- **TC-F4-02**: Snake slide occurs immediately within the same turn.
- **TC-F4-03**: Final position after sliding down a snake is correctly broadcast to all clients.
- **TC-F4-04**: Turn transitions to the next player after a snake slide is completed.
- **TC-F4-05**: Landing on a snake tail does not trigger any slide or movement.

#### F5: Ladder climb upwards
- **TC-F5-01**: Landing on a ladder base climbs the player up to the ladder top.
- **TC-F5-02**: Ladder climb occurs immediately within the same turn.
- **TC-F5-03**: Final position after climbing a ladder is correctly broadcast to all clients.
- **TC-F5-04**: Turn transitions to the next player after a ladder climb is completed (unless extra turn).
- **TC-F5-05**: Landing on the top of a ladder does not trigger any slide or movement.

#### F6: Bot AI automatic turns
- **TC-F6-01**: Bot automatically rolls the dice when it is the bot's turn.
- **TC-F6-02**: Bot successfully completes its turn and passes action to the next player.
- **TC-F6-03**: Bot automatically rolls again if it rolls a 6.
- **TC-F6-04**: Bot position updates correctly when it lands on a snake or ladder.
- **TC-F6-05**: Room state transitions correctly when multiple bots take turns consecutively.

#### F7: Online socket sync & Offline solo play
- **TC-F7-01**: Host creates room with gameType `snakes-ladders` and receives room code.
- **TC-F7-02**: Second player joins the room successfully.
- **TC-F7-03**: Host adds a bot to the lobby.
- **TC-F7-04**: Host starts the game when all players are ready.
- **TC-F7-05**: Solo offline play runs without active socket connections (local game state).

---

### Tier 2: Boundary & Corner Cases (35 Tests)

#### F1: Dice rolling & Extra Turn on 6
- **TC-F1-06**: Roll command ignored if sent during another player's turn.
- **TC-F1-07**: Roll command ignored if game state is not `playing` (e.g. in lobby).
- **TC-F1-08**: Rolling multiple consecutive 6s (e.g. three times) behaves correctly (either rolls again or turn ends).
- **TC-F1-09**: Player rolls exactly 6 on an extra turn, gets another extra turn.
- **TC-F1-10**: Player rolls a 6 from the initial starting position (cell 1).

#### F2: Forward board movement (1-100)
- **TC-F2-06**: Player on cell 1 rolls a 1 (minimum step).
- **TC-F2-07**: Player on cell 94 rolls a 6 (reaches 100 exactly without bounce).
- **TC-F2-08**: Movement logic handles multiple players occupying the same cell.
- **TC-F2-09**: Movement logic handles player starting from cell 0 (if 0 is lobby/start).
- **TC-F2-10**: Rolling a 0 or negative value (invalid input) is rejected or ignored.

#### F3: Overflow bounce from cell 100
- **TC-F3-06**: Bouncing back from 100 onto a snake head triggers the slide downwards.
- **TC-F3-07**: Bouncing back from 100 onto a ladder base triggers the climb upwards.
- **TC-F3-08**: Bouncing back from 100 onto a cell occupied by another player works correctly.
- **TC-F3-09**: Bouncing back from 100 after rolling a 6 grants an extra turn from the bounced cell.
- **TC-F3-10**: Player on cell 99 rolls a 6 -> moves to 100, bounces 5 to cell 95.

#### F4: Snake head slide downwards
- **TC-F4-06**: Landing on the highest snake head on the board (e.g. at cell 98).
- **TC-F4-07**: Bouncing back from cell 100 lands exactly on a snake head.
- **TC-F4-08**: Snake slide where tail is cell 1 (or starting cell).
- **TC-F4-09**: Multiple players land on the same snake head in different turns (all slide down).
- **TC-F4-10**: Client sends custom position update attempting to bypass snake (rejected by server validation).

#### F5: Ladder climb upwards
- **TC-F5-06**: Landing on the lowest ladder base on the board.
- **TC-F5-07**: Ladder climb that leads to cell 99.
- **TC-F5-08**: Bouncing back from cell 100 lands exactly on a ladder base.
- **TC-F5-09**: Multiple players land on the same ladder base (all climb up).
- **TC-F5-10**: Client sends custom position update attempting to bypass ladder or teleport (rejected by server validation).

#### F6: Bot AI automatic turns
- **TC-F6-06**: Bot AI handles bouncing back from cell 100 and continuing turn if rolled 6.
- **TC-F6-07**: Bot AI takes over a player seat immediately when that player disconnects during their turn.
- **TC-F6-08**: Bot is removed from room in lobby without breaking player turn index.
- **TC-F6-09**: Bot AI takes turn when host is disconnected.
- **TC-F6-10**: Bot rolls consecutively fast without locking the game event loop.

#### F7: Online socket sync & Offline solo play
- **TC-F7-06**: Client disconnects during their turn, gets replaced by bot, then reconnects using sessionId and reclaims seat.
- **TC-F7-07**: Host disconnects, room transfers host status to the next active player.
- **TC-F7-08**: Joining with an invalid room code returns "Room not found".
- **TC-F7-09**: Joining a room that has already started returns "Game already in progress".
- **TC-F7-10**: Room cleanup deletes the room after reconnect timeout if no humans are left.

---

### Tier 3: Cross-Feature Combinations (7 Tests)
- **TC-F8-01**: Rolling a 6 lands on a ladder (climbs, gets extra turn, rolls again).
- **TC-F8-02**: Rolling a 6 lands on a snake (slides down, gets extra turn, rolls again).
- **TC-F8-03**: Bouncing from 100 lands on a snake head which slides player down to a ladder base (does player climb the ladder? Standard rule: usually yes, or no. We test that it resolves sequentially).
- **TC-F8-04**: Player rolls 6, bounces from 100 onto a ladder base (climbs, gets extra turn, rolls again).
- **TC-F8-05**: Player rolls 6, bounces from 100 onto a snake head (slides down, gets extra turn, rolls again).
- **TC-F8-06**: Bot lands on cell 100 via a bounce and wins the game (verifies AI wins correctly).
- **TC-F8-07**: Host transfers to a player during their extra turn (extra turn is preserved for the player).

---

### Tier 4: Real-World Application Scenarios (5 Tests)
- **TC-F9-01**: Full game simulation with 4 human players from start to finish.
- **TC-F9-02**: Full game simulation with 1 human player and 3 AI bots from start to finish.
- **TC-F9-03**: Full game simulation with 4 AI bots from start to finish.
- **TC-F9-04**: Game simulation with 2 players, where one player disconnects and reconnects multiple times.
- **TC-F9-05**: Game simulation with 3 players, where the host leaves mid-game, a new host is assigned, and a bot takes over the old host's seat.

---

## Test Architecture
- **Test Runner**: Programmatic test script `test-snakes-ladders.ts` using `ts-node`.
- **Mock Clients**: Simulates socket.io clients using `socket.io-client`.
- **Server Spawning**: The runner dynamically starts the Express/Socket.io server on a test port (e.g. 3005) or connects to an already running server, runs the tests, and shuts down the server.
- **Exit Code**: Exits with `0` if all tests pass, and non-zero if any test fails.

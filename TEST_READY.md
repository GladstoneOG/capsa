# TEST_READY: Snakes & Ladders E2E Test Suite Ready

The End-to-End (E2E) test suite for the Snakes & Ladders game mode integration is complete and ready to run.

## Test Script Details
- **Test File**: `test-snakes-ladders.ts` at the project root.
- **Runner**: Executes programmatically using Node/tsx.
- **Number of Test Cases**: 82 test cases across 4 Tiers.
- **Port Utilized by Mock Server**: `3005` (runs dynamically in verification mode).

## How to Run the Test Suite

### 1. Verification Mode (Pass)
Run the entire 82-test case suite against a mock Socket.io server to verify that the E2E test client's assertion, event listener, and protocol integration works correctly:
```bash
npx tsx test-snakes-ladders.ts --verify-runner
```
**Expected Exit Code**: `0` (Success, all tests pass).

### 2. Verification Mode (Fail)
Verify that the test runner correctly detects failures and exits with a non-zero code when a test fails:
```bash
npx tsx test-snakes-ladders.ts --verify-runner --force-fail
```
**Expected Exit Code**: `1` (Failure, TC-F1-01 fails).

---

## Coverage Checklist

### Tier 1: Feature Coverage (35 Tests)
- [x] TC-F1-01 to TC-F1-05: Dice rolling & Extra Turn on 6
- [x] TC-F2-01 to TC-F2-05: Forward board movement (1-100)
- [x] TC-F3-01 to TC-F3-05: Overflow bounce from cell 100
- [x] TC-F4-01 to TC-F4-05: Snake head slide downwards
- [x] TC-F5-01 to TC-F5-05: Ladder climb upwards
- [x] TC-F6-01 to TC-F6-05: Bot AI automatic turns
- [x] TC-F7-01 to TC-F7-05: Online socket sync & Offline solo play

### Tier 2: Boundary & Corner Cases (35 Tests)
- [x] TC-F1-06 to TC-F1-10: Dice rolling boundary conditions & Cap at 3 consecutive 6s
- [x] TC-F2-06 to TC-F2-10: Forward board movement boundaries (step size 1, 6 exactly to 100, occupied cell logic, etc.)
- [x] TC-F3-06 to TC-F3-10: Overflow bounce corner cases (bounce onto snake, bounce onto ladder, etc.)
- [x] TC-F4-06 to TC-F4-10: Snake head slide boundaries (slide to cell 1, multiple players on same head, custom position validation)
- [x] TC-F5-06 to TC-F5-10: Ladder climb boundaries (climb to cell 99, multiple players on same base, custom position validation)
- [x] TC-F6-06 to TC-F6-10: Bot AI corner cases (taking over disconnected seats, bot lobby removal, fast consecutive rolls)
- [x] TC-F7-06 to TC-F7-10: Socket synchronization boundaries (session reconnection, host transfer on host disconnect, invalid room code rejection)

### Tier 3: Cross-Feature Combinations (7 Tests)
- [x] TC-F8-01: Rolling a 6 lands on a ladder
- [x] TC-F8-02: Rolling a 6 lands on a snake
- [x] TC-F8-03: Bouncing from 100 lands on a snake head which slides player down to a ladder base (sequential slide-and-climb)
- [x] TC-F8-04: Player rolls 6, bounces from 100 onto a ladder base
- [x] TC-F8-05: Player rolls 6, bounces from 100 onto a snake head
- [x] TC-F8-06: Bot lands on cell 100 via a bounce and wins the game
- [x] TC-F8-07: Host transfers to a player during their extra turn (extra turn is preserved)

### Tier 4: Real-World Application Scenarios (5 Tests)
- [x] TC-F9-01: Full game simulation with 4 human players
- [x] TC-F9-02: Full game simulation with 1 human player and 3 AI bots
- [x] TC-F9-03: Full game simulation with 4 AI bots
- [x] TC-F9-04: Game simulation with 2 players, reconnecting multiple times
- [x] TC-F9-05: Game simulation with 3 players, host transfers, bots taking over seats mid-game

# Monopoly Get Rich Gamemode Ruleset

This document outlines the ruleset for the **Get Rich** gamemode in Monopoly.

## 1. Building Restrictions
- Players can **instantly build** houses on properties when landing on them (even if they do not own the full color group monopoly).
- A player can build up to **4 houses** on a single landing.
- To upgrade to a **Hotel** (5th house), the player must land on that property tile **one more time** (it must already have 4 houses).
- Hotels cannot be force-acquired, but they can be traded.

## 2. Forced Acquisitions
- If a player lands on another player's property, after paying rent, if they have enough cash, they can **force purchase** the property.
- The force purchase price is equal to the **total worth** of the property:
  $$\text{Total Worth} = \text{Land Price} + (\text{Number of Houses} \times \text{House Cost})$$
- **Exceptions & Protections**:
  - Hotels cannot be force-acquired.
  - **Railway** (Railroad) and **Tourism** (Utility - e.g., Water Works, Electric Company) spots are fully protected and **cannot be force-acquired**. They can only be acquired by landing on them when unowned, or through voluntary trade negotiations.

## 3. Dice Roll Strength (Power Bar)
- The Roll Dice button features a fluctuating power bar (0% to 100%).
- Releasing the button at different percentages influences the range of the dice roll sum:
  - **1% - 33% (Low)**: Results in a roll sum of **1 - 4** (actual minimum is 2).
  - **34% - 66% (Mid)**: Results in a roll sum of **5 - 8**.
  - **67% - 100% (High)**: Results in a roll sum of **9 - 12**.

## 4. Special Cards
Consumable cards can be obtained from Chance and Community Chest decks:
- **Odd/Even Card**:
  - Consumable.
  - Can be used before rolling to force the dice roll sum to be either **Odd** or **Even**.
  - Maximum of 1 held card per player at a time.
- **Angel Card**:
  - Consumable.
  - Can be used to either **be exempted from paying rent** when landing on an opponent's property, OR **protect your own property** from being force-acquired by an opponent.
  - The game prompts the player if they hold the card when the event occurs.
  - Maximum of 1 held card per player at a time.

These cards are displayed next to the player's info (like Get Out of Jail Free cards).

## 5. Airport (replaces Free Parking)
- The **Free Parking** tile becomes the **Airport**.
- Landing on the Airport allows the player to pay a fee of **$100** to **fly to any tile** on the board immediately (triggering its landed action).

## 6. Festival (replaces Go to Jail)
- The **Go to Jail** tile becomes the **Festival**.
- Landing on the Festival allows the player to select one of their owned properties and **double its rent** for the next **3 turns**.
- Rent doublings are represented by a crown indicator on the board.

## 7. Casino Tiles (replaces Taxes)
- The **Luxury Tax** and **Income Tax** tiles are replaced by **Casinos**.
- When a player lands on a Casino tile, they are presented with a premium 3D coin flip window visible to all players.
- The player flips a coin for a chance to win or lose cash:
  - **Round 1**: Win **+$200** or lose **-$200**.
  - If they win, they can choose to **Collect** and end the turn, or **Push Your Luck** to flip again.
  - **Round 2**: Win **+$400** or lose **-$400**.
  - If they win again, they can choose to **Collect** or **Push Your Luck** one final time.
  - **Round 3**: Win **+$800** or lose **-$800**.
- **Important Rules**:
  - If the player loses a flip at any round, they receive **nothing**, lose the corresponding amount from their balance, and the turn ends.
  - Standard tax actions and tax-paying events are disabled in Get Rich mode.
  - Losses are integrated with the debt/bankruptcy flow: if a player does not have enough cash to cover the loss, they must liquidate assets or go bankrupt.

## 8. Exact GO Landing Benefit
- If a player lands **exactly** on the **GO** tile (whether by a regular dice roll or by using the Airport to fly there), they are allowed to **build once on any property they own** immediately.
- This action opens the build management menu and bypasses normal monopoly color group constraints, allowing the player to pay the standard house cost to add a house/hotel to any owned property.
- This benefit is strictly exclusive to the **Get Rich** gamemode.

## 9. New Instant Win Conditions
The game ends instantly in **Get Rich** mode if a player achieves one of the following special victory objectives:
- **Tourism Win**: A player successfully acquires all **6 Tourism and Railway spots** on the board (4 Railroads and 2 Utilities).
- **Line Win**: A player successfully acquires **all ownable properties in a single line** (one of the four sides of the board).
- Upon triggering a win condition or if the game ends via standard bankruptcy/elimination, all active players are ranked based on their **Net Worth** (Cash + Property Assets + House Costs).


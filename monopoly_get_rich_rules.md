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
- Note: Hotels cannot be force-acquired.

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
- Landing on the Airport allows the player to pay a fee of **$100** (equivalent to $100k) to **fly to any tile** on the board immediately (triggering its landed action).

## 6. Festival (replaces Go to Jail)
- The **Go to Jail** tile becomes the **Festival**.
- Landing on the Festival allows the player to select one of their owned properties and **double its rent** for the next **3 turns**.
- Rent doublings are represented by a crown indicator on the board.

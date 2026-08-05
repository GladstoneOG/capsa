import React from 'react';
import type { Card, Suit } from '../utils/gameLogic';

export interface PlayingCardProps {
  card: Card;
  isSelected?: boolean;
  isMyTurn?: boolean;
  canPlaySelected?: boolean;
  isCardDragging?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
}

export const suitSymbols: Record<Suit, string> = { D: '♦', C: '♣', H: '♥', S: '♠' };
export const suitNames: Record<Suit, string> = { D: 'red-suit', C: 'black-suit', H: 'red-suit', S: 'black-suit' };

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  isSelected = false,
  isMyTurn = true,
  canPlaySelected = true,
  isCardDragging = false,
  className = '',
  style,
  onClick,
  onPointerDown,
}) => {
  const { rank, suit } = card;
  const suitSymbol = suitSymbols[suit];
  const suitClass = suitNames[suit];

  const selectedClasses = isSelected
    ? `selected ${isMyTurn ? (canPlaySelected ? 'playable' : 'unplayable') : 'not-turn'}`
    : '';

  const unselectableClass = !isMyTurn ? 'unselectable' : '';
  const draggingClass = isCardDragging ? 'dragging' : '';

  return (
    <div
      className={`playing-card ${suitClass} ${selectedClasses} ${unselectableClass} ${draggingClass} ${className}`}
      style={style}
      onClick={onClick}
      onPointerDown={onPointerDown}
    >
      <div className="card-top-left">
        <span className="card-value">{rank}</span>
        <span className="card-suit-small">{suitSymbol}</span>
      </div>
      <div className="card-suit-large">{suitSymbol}</div>
    </div>
  );
};

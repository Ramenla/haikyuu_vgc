import { CardInstance } from "./card";

export type Phase = "Serve Phase" | "Receive Phase" | "Toss Phase" | "Attack Phase" | "Block Phase" | "End Phase";
export type Turn = "Player 1" | "Player 2";
export type Screen = "menu" | "deck-selection" | "deck-builder" | "game-board" | "online-lobby" | "online-room";

export type PendingEffectCard = {
  card: CardInstance;
  playerType: Turn;
  zoneId: string;
};

export type PendingCardSelection = {
  title: string;
  cards: CardInstance[];
  onSelect: (selected: CardInstance) => void;
};

export type PendingChoice = {
  title: string;
  options: { label: string; action: () => void; disabled?: boolean }[];
  onCancel: () => void;
};

export type CalculatedPoints = {
  incomingAttack: number;
  incomingAttackType: "Serve" | "Attack" | "BlockReturn" | null;
  totalDefense: number;
  defenseType: "block" | "receive";
  outgoingAttack: number;
};

export interface CustomDeck {
  id: string;
  name: string;
  cards: string[]; // List of card IDs
  isValid: boolean;
};

export interface ChatMessage {
  id: string;
  sender: "Player 1" | "Player 2" | "System";
  text: string;
  timestamp: number;
}

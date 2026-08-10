export type CardStats = {
  serve: number;
  receive: number;
  toss: number;
  attack: number;
  block: number;
};

export type CardData = {
  id: string;
  name: string;
  type?: string;
  school?: string;
  year?: string;
  position?: string;
  stats: CardStats;
  effect: string;
  image: string;
  effectTrigger?: string;
  effectType?: string;
  effectValue?: number;
  effectCostType?: string;
  effectCostValue?: number;
  phaseRestriction?: string;
};

export type CardInstance = CardData & {
  instanceId: string;
  location: string;
  isGuts?: boolean;
  isEffectActive?: boolean;
  hasUsedEffect?: boolean;
};

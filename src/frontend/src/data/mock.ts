export interface Account {
  id: string;
  name: string;
  kind: "card" | "account" | "savings";
  detail?: string;
  balanceEur?: number;
}

export interface BonusLevel {
  percent: number;
  thresholdEur: number;
}

export interface HomeData {
  bonus: {
    nowEur: number;
    toNextLevelEur: number;
    nextLevel: BonusLevel;
    currentLevel: BonusLevel;
  };
  accounts: Account[];
}

export const homeData: HomeData = {
  bonus: {
    nowEur: 12.4,
    toNextLevelEur: 18.6,
    nextLevel: { percent: 0.5, thresholdEur: 1500 },
    currentLevel: { percent: 0.25, thresholdEur: 1000 },
  },
  accounts: [
    {
      id: "acc-1",
      name: "S-Bank account",
      kind: "account",
      detail: "FI00 1234 5600 0000 00",
      balanceEur: 30279.12,
    },
    {
      id: "acc-2",
      name: "S-Etukortti Visa",
      kind: "card",
      detail: "Debit · S-Bank account",
    },
  ],
};

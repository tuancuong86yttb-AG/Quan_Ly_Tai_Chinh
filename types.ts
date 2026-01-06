
export enum FundType {
  UNION = 'CONG_DOAN',
  PARTY = 'DANG_PHI',
  OFFICE = 'VAN_PHONG'
}

export enum TransactionType {
  INCOME = 'THU',
  EXPENSE = 'CHI'
}

export interface Transaction {
  id: string;
  fundType: FundType;
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  person: string;
}

export interface FundBalance {
  fundType: FundType;
  balance: number;
  totalIncome: number;
  totalExpense: number;
}

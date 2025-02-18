import { Asset, AssetType } from '../assets/types';

export interface BalanceResponse {
  balance: number;
  status: 'Liquid' | 'Frozen' | 'Blocked';
  reason: 'Consumer' | 'Sufficient' | 'DepositHeld' | 'DepositFrom' | 'DepositRefunded';
  extra: any | null;
}

export interface BalanceRequest {
  address: string;
  assetId: string | number;
}

export interface RawBalanceResponse {
  balance: bigint;
  status: { Liquid?: undefined; Frozen?: undefined; Blocked?: undefined };
  reason: {
    Consumer?: undefined;
    Sufficient?: undefined;
    DepositHeld?: bigint;
    DepositFrom?: [string, bigint];
    DepositRefunded?: undefined;
  };
} 
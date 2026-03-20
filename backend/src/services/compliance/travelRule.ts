import { v4 as uuidv4 } from 'uuid';

export const TRAVEL_RULE_THRESHOLD_USDC = 1000;

export interface TravelRuleData {
  originatorName: string;
  originatorWallet: string;
  originatorVaspId: string; // mock: "STABLEHACKS-VASP-001"
  originatorCountry: string;
  beneficiaryName: string;
  beneficiaryWallet: string;
  beneficiaryVaspId: string;
  beneficiaryCountry: string;
  transferAmount: number;
  transferCurrency: string; // "USDC"
  transferTimestamp: string;
  travelRuleId: string; // UUID
}

export function checkTravelRuleRequired(amountUsdc: number): boolean {
  return amountUsdc >= TRAVEL_RULE_THRESHOLD_USDC;
}

export function buildTravelRuleData(params: {
  originatorName: string;
  originatorWallet: string;
  originatorCountry: string;
  beneficiaryName: string;
  beneficiaryWallet: string;
  beneficiaryVaspId: string;
  beneficiaryCountry: string;
  transferAmount: number;
}): TravelRuleData {
  return {
    originatorName: params.originatorName,
    originatorWallet: params.originatorWallet,
    originatorVaspId: 'STABLEHACKS-VASP-001',
    originatorCountry: params.originatorCountry,
    beneficiaryName: params.beneficiaryName,
    beneficiaryWallet: params.beneficiaryWallet,
    beneficiaryVaspId: params.beneficiaryVaspId,
    beneficiaryCountry: params.beneficiaryCountry,
    transferAmount: params.transferAmount,
    transferCurrency: 'USDC',
    transferTimestamp: new Date().toISOString(),
    travelRuleId: uuidv4(),
  };
}

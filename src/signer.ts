import { parseEther, type TransactionRequest } from "ethers";
import type { UserRecord } from "./types.js";
import { loadBurnerWallet } from "./wallet.js";

export type AutoSignDecision = {
  allowed: boolean;
  reason: string;
};

export function canAutoSign(user: UserRecord, transaction: TransactionRequest): AutoSignDecision {
  if (!user.autoSignEnabled) {
    return {
      allowed: false,
      reason: "Auto-sign is turned off. Use /autosign_on to enable burner-wallet signing for approved tasks."
    };
  }

  const value = BigInt(transaction.value?.toString() ?? "0");
  const maxValue = BigInt(user.maxAutoSignValueWei ?? "0");

  if (value > maxValue) {
    return {
      allowed: false,
      reason: "Transaction value is above your current auto-sign limit."
    };
  }

  return {
    allowed: true,
    reason: "Allowed by burner-wallet auto-sign policy."
  };
}

export async function signStatusMessage(user: UserRecord) {
  const wallet = await loadBurnerWallet(user.encryptedPrivateKey);
  const message = `AirdropTasker burner wallet check: ${new Date().toISOString()}`;

  return {
    address: wallet.address,
    message,
    signature: await wallet.signMessage(message)
  };
}

export async function signApprovedTransaction(user: UserRecord, transaction: TransactionRequest) {
  const decision = canAutoSign(user, transaction);
  if (!decision.allowed) {
    throw new Error(decision.reason);
  }

  const wallet = await loadBurnerWallet(user.encryptedPrivateKey);
  return wallet.signTransaction(transaction);
}

export const defaultAutoSignValueLimitWei = parseEther("0").toString();

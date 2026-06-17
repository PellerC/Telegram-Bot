import { Wallet } from "ethers";
import { config } from "./config.js";

export type CreatedWallet = {
  address: string;
  encryptedPrivateKey: string;
  mnemonic: string;
};

export function getWalletPassword() {
  if (config.walletEncryptionKey) {
    return config.walletEncryptionKey;
  }

  return config.telegramBotToken;
}

export async function createBurnerWallet(): Promise<CreatedWallet> {
  const wallet = Wallet.createRandom();

  if (!wallet.mnemonic?.phrase) {
    throw new Error("Failed to create wallet mnemonic");
  }

  return {
    address: wallet.address,
    encryptedPrivateKey: await wallet.encrypt(getWalletPassword()),
    mnemonic: wallet.mnemonic.phrase
  };
}

export async function loadBurnerWallet(encryptedPrivateKey: string) {
  return Wallet.fromEncryptedJson(encryptedPrivateKey, getWalletPassword());
}

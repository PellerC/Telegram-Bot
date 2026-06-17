import { Wallet } from "ethers";

export type CreatedWallet = {
  address: string;
  encryptedPrivateKey: string;
  mnemonic: string;
};

export async function createBurnerWallet(password: string): Promise<CreatedWallet> {
  const wallet = Wallet.createRandom();

  if (!wallet.mnemonic?.phrase) {
    throw new Error("Failed to create wallet mnemonic");
  }

  return {
    address: wallet.address,
    encryptedPrivateKey: await wallet.encrypt(password),
    mnemonic: wallet.mnemonic.phrase
  };
}

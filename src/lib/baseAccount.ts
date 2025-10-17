import { createBaseAccountSDK, getCryptoKeyAccount } from "@base-org/account";
import { base } from "viem/chains";

export const sdk = createBaseAccountSDK({
  appName: "Policast",
  appLogoUrl: process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/icon.jpg`
    : "https://buster-mkt.vercel.app/banner2.avif",
  appChainIds: [base.id],
  subAccounts: {
    creation: "on-connect", // Auto-create sub account on wallet connect
    defaultAccount: "sub", // Use sub account as default for transactions
  },
  // Optional: Enable gas sponsorship if you have a paymaster
  paymasterUrls: process.env.NEXT_PUBLIC_PAYMASTER_URL
    ? {
        [base.id]: process.env.NEXT_PUBLIC_PAYMASTER_URL,
      }
    : undefined,
});

export const provider = sdk.getProvider();

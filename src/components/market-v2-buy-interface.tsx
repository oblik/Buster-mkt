"use client";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSendCalls,
  useWaitForCallsStatus,
  useConnectorClient,
} from "wagmi";
import {
  V2contractAddress,
  V2contractAbi,
  tokenAddress,
  tokenAbi,
} from "@/constants/contract";
import { encodeFunctionData } from "viem";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { MarketV2 } from "@/types/types";

interface MarketV2BuyInterfaceProps {
  marketId: number;
  market: MarketV2;
}

type BuyingStep =
  | "initial"
  | "amount"
  | "allowance"
  | "confirm"
  | "batchPartialSuccess"
  | "purchaseSuccess";

// Convert amount to token units (handles custom decimals)
function toUnits(amount: string, decimals: number): bigint {
  const [integer = "0", fraction = ""] = amount.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return (
    BigInt(integer + paddedFraction) *
    BigInt(10) ** BigInt(decimals - paddedFraction.length)
  );
}

export function MarketV2BuyInterface({
  marketId,
  market,
}: MarketV2BuyInterfaceProps) {
  const { address: accountAddress, isConnected, connector } = useAccount();
  const { data: connectorClient } = useConnectorClient();
  const { data: hash, writeContractAsync } = useWriteContract();
  const { isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({
    hash,
  });
  const { toast } = useToast();

  // Check if we're using Farcaster connector
  const isFarcasterConnector =
    connector?.id === "miniAppConnector" ||
    connector?.name?.includes("Farcaster");

  const [isBuying, setIsBuying] = useState(false);
  const [isVisible] = useState(true);
  const [containerHeight, setContainerHeight] = useState("auto");
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [buyingStep, setBuyingStep] = useState<BuyingStep>("initial");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastProcessedHash, setLastProcessedHash] = useState<string | null>(
    null
  );

  // EIP-5792 batch calls
  const { sendCalls, data: callsData } = useSendCalls({
    mutation: {
      onSuccess: (data) => {
        console.log("=== V2 BATCH TRANSACTION CALLBACK ===");
        console.log("Batch transaction submitted with id:", data.id);
        toast({
          title: "Batch Transaction Submitted",
          description:
            "Processing your Approve + Buy transaction. Waiting for completion...",
        });
      },
      onError: (err) => {
        console.error("=== V2 BATCH TRANSACTION SUBMISSION FAILED ===");
        console.error("Error:", err);
        toast({
          title: "Batch Transaction Failed",
          description: "Using fallback method.",
          variant: "destructive",
        });
        setIsProcessing(false);
      },
    },
  });

  // Monitor the status of batch calls
  const { data: callsStatusData, isSuccess: callsStatusSuccess } =
    useWaitForCallsStatus({
      id: callsData?.id,
      query: {
        enabled: !!callsData?.id,
        refetchInterval: 1000,
      },
    });

  // Token information
  const { data: tokenSymbol } = useReadContract({
    address: tokenAddress,
    abi: tokenAbi,
    functionName: "symbol",
  });

  const { data: tokenDecimals } = useReadContract({
    address: tokenAddress,
    abi: tokenAbi,
    functionName: "decimals",
  });

  // User balance and allowance
  const { data: balanceData } = useReadContract({
    address: tokenAddress,
    abi: tokenAbi,
    functionName: "balanceOf",
    args: [accountAddress || "0x0000000000000000000000000000000000000000"],
    query: {
      enabled: isConnected && !!accountAddress,
    },
  });

  const { data: allowanceData } = useReadContract({
    address: tokenAddress,
    abi: tokenAbi,
    functionName: "allowance",
    args: [
      accountAddress || "0x0000000000000000000000000000000000000000",
      V2contractAddress,
    ],
    query: {
      enabled: isConnected && !!accountAddress,
    },
  });

  // User shares for each option
  const { data: userSharesData } = useReadContract({
    address: V2contractAddress,
    abi: V2contractAbi,
    functionName: "getUserShares",
    args: [
      BigInt(marketId),
      BigInt(selectedOptionId || 0),
      accountAddress || "0x0000000000000000000000000000000000000000",
    ],
    query: {
      enabled: isConnected && !!accountAddress && selectedOptionId !== null,
    },
  });

  const balance = (balanceData as bigint | undefined) ?? 0n;
  const userAllowance = (allowanceData as bigint | undefined) ?? 0n;
  const userShares = (userSharesData as bigint | undefined) ?? 0n;
  const tokenSymbolString = (tokenSymbol as string) || "TOKEN";
  const tokenDecimalsNumber = (tokenDecimals as number) || 18;

  const handleBuy = (optionId: number) => {
    setIsBuying(true);
    setSelectedOptionId(optionId);
    setBuyingStep("amount");
  };

  const handleCancel = useCallback(() => {
    setIsBuying(false);
    setBuyingStep("initial");
    setSelectedOptionId(null);
    setAmount("");
    setError(null);
    setLastProcessedHash(null);
  }, []);

  const checkApproval = async () => {
    const numAmount = Number(amount);
    if (!amount || numAmount <= 0) {
      setError("Amount must be greater than 0");
      return;
    }

    try {
      if (!isConnected || !accountAddress) {
        toast({
          title: "Wallet Connection Required",
          description: "Please connect your wallet to continue",
          variant: "destructive",
        });
        return;
      }

      const amountInUnits = toUnits(amount, tokenDecimalsNumber);
      if (amountInUnits > balance) {
        toast({
          title: "Insufficient Balance",
          description: `You need ${amount} ${tokenSymbolString}`,
          variant: "destructive",
        });
        return;
      }

      setBuyingStep("confirm");
      setError(null);
    } catch (e) {
      console.error("Amount validation error:", e);
      toast({
        title: "Error",
        description: "Failed to validate transaction",
        variant: "destructive",
      });
    }
  };

  const handleConfirm = async () => {
    if (selectedOptionId === null || !amount || Number(amount) <= 0) {
      setError("Must select an option and enter an amount greater than 0");
      return;
    }

    if (!isConnected || !accountAddress) {
      toast({
        title: "Wallet Connection Required",
        description: "Please connect your wallet to continue",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const amountInUnits = toUnits(amount, tokenDecimalsNumber);

      // Prepare batch calls
      const batchCalls = [
        {
          to: tokenAddress,
          data: encodeFunctionData({
            abi: tokenAbi,
            functionName: "approve",
            args: [V2contractAddress, amountInUnits],
          }),
        },
        {
          to: V2contractAddress,
          data: encodeFunctionData({
            abi: V2contractAbi,
            functionName: "buyOptionShares",
            args: [BigInt(marketId), BigInt(selectedOptionId), amountInUnits],
          }),
        },
      ];

      // Try the batch transaction
      sendCalls({
        calls: batchCalls,
      });
    } catch (error: unknown) {
      console.error("Purchase error:", error);
      toast({
        title: "Purchase Failed",
        description: "Failed to process purchase. Check your wallet.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  // Monitor batch calls status
  useEffect(() => {
    if (callsStatusSuccess && callsStatusData) {
      if (callsStatusData.status === "success") {
        setBuyingStep("purchaseSuccess");
        toast({
          title: "Purchase Successful!",
          description: `You successfully bought shares in option ${
            market.options[selectedOptionId || 0]?.name || selectedOptionId
          }.`,
        });
        setAmount("");
        setSelectedOptionId(null);
        setIsBuying(false);
      } else if (callsStatusData.status === "failure") {
        toast({
          title: "Transaction Failed",
          description: "Purchase failed. Please try again.",
          variant: "destructive",
        });
        setError("Transaction failed");
        setBuyingStep("initial");
      }
      setIsProcessing(false);
    }
  }, [
    callsStatusSuccess,
    callsStatusData,
    market.options,
    selectedOptionId,
    toast,
  ]);

  // Effect to handle transaction confirmation
  useEffect(() => {
    if (isTxConfirmed && hash && hash !== lastProcessedHash) {
      setLastProcessedHash(hash);

      if (buyingStep === "confirm") {
        toast({
          title: "Purchase Confirmed!",
          description: "Your shares have been purchased successfully.",
        });
        setBuyingStep("purchaseSuccess");
        setIsProcessing(false);
      }
    }
  }, [isTxConfirmed, hash, lastProcessedHash, buyingStep, toast]);

  // Update container height
  useEffect(() => {
    if (contentRef.current) {
      setContainerHeight(`${contentRef.current.offsetHeight}px`);
    }
  }, [isBuying, buyingStep, isVisible, error]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (inputValue === "") {
      setAmount("");
      setError(null);
      return;
    }
    if (!/^\d*\.?\d*$/.test(inputValue)) return;
    setAmount(inputValue);
    setError(null);
  };

  return (
    <div
      className="relative transition-all duration-200 ease-in-out overflow-hidden"
      style={{ maxHeight: containerHeight }}
    >
      <div
        ref={contentRef}
        className={cn(
          "w-full transition-all duration-200 ease-in-out",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        {!isBuying ? (
          <div className="flex flex-col gap-4 mb-4">
            <div className="grid grid-cols-1 gap-2">
              {market.options.map((option, index) => (
                <Button
                  key={index}
                  className="min-w-[120px]"
                  onClick={() => handleBuy(index)}
                  disabled={!isConnected}
                >
                  {option.name}
                </Button>
              ))}
            </div>
            {accountAddress && (
              <div className="text-xs text-gray-500 text-center">
                <p>
                  Available:{" "}
                  {(
                    Number(balance) / Math.pow(10, tokenDecimalsNumber)
                  ).toFixed(2)}{" "}
                  {tokenSymbolString}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col mb-4">
            <p className="text-sm text-gray-500 mb-4">
              Selected: {market.options[selectedOptionId || 0]?.name}
            </p>
            {buyingStep === "amount" ? (
              <div className="flex flex-col">
                <div className="flex flex-col gap-1 mb-4">
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={handleAmountChange}
                    className={cn(
                      "w-full",
                      error && "border-red-500 focus-visible:ring-red-500"
                    )}
                  />
                  {error && (
                    <span className="text-sm text-red-500">{error}</span>
                  )}
                </div>
                <div className="flex justify-between gap-4">
                  <Button
                    onClick={checkApproval}
                    className="flex-1"
                    disabled={!amount}
                  >
                    Next
                  </Button>
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : buyingStep === "confirm" ? (
              <div className="flex flex-col border-2 border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-bold mb-2">Confirm Purchase</h3>
                <p className="mb-4 text-sm">
                  Buy {amount} shares in{" "}
                  {market.options[selectedOptionId || 0]?.name}
                </p>
                <div className="flex justify-end gap-2">
                  <Button onClick={handleConfirm} disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Confirm Purchase"
                    )}
                  </Button>
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : buyingStep === "purchaseSuccess" ? (
              <div className="flex flex-col items-center gap-4 p-4 border-2 border-green-500 rounded-lg bg-green-50">
                <h3 className="text-lg font-bold text-green-700">
                  Purchase Successful!
                </h3>
                <p className="text-sm text-center text-gray-600">
                  You successfully bought {amount} shares.
                </p>
                <Button onClick={handleCancel} variant="outline">
                  Done
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

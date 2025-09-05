import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface MarketTimeProps {
  endTime: bigint;
  className?: string;
  earlyResolutionAllowed?: boolean;
}

const calculateTimeLeft = (endTime: bigint) => {
  const difference = Number(endTime) * 1000 - Date.now();

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
};

export default function MarketTime({
  endTime,
  className,
  earlyResolutionAllowed = false,
}: MarketTimeProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isClient, setIsClient] = useState(false);
  const isEnded = new Date(Number(endTime) * 1000) < new Date();

  useEffect(() => {
    setIsClient(true);
    setTimeLeft(calculateTimeLeft(endTime));
  }, [endTime]);

  useEffect(() => {
    if (!isClient || isEnded) return;

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(endTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime, isEnded, isClient]);

  if (isEnded) {
    return (
      <div
        className={cn(
          "text-xs px-2 py-1 rounded-md bg-gradient-to-r from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700 flex items-center shadow-sm w-fit",
          className
        )}
      >
        <span className="h-1.5 w-1.5 bg-red-500 dark:bg-red-400 animate-pulse rounded-full mr-1.5"></span>
        <span className="font-medium">Ended</span>
      </div>
    );
  }

  if (!isClient) {
    return (
      <div
        className={cn(
          "text-xs px-2 py-1 rounded-md bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-700 flex items-center shadow-sm w-fit",
          className
        )}
      >
        <span className="text-green-500 dark:text-green-400 font-medium mr-1.5">
          ⏱
        </span>
        <span className="text-green-600 dark:text-green-300 font-medium mr-1.5">
          {earlyResolutionAllowed ? "Event ends:" : "Ends:"}
        </span>
        <TimeUnit value={0} unit="h" />
        <TimeUnit value={0} unit="m" />
        <TimeUnit value={0} unit="s" isLast={true} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "text-xs px-2 py-1 rounded-md bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-700 flex items-center shadow-sm w-fit",
        className
      )}
    >
      <span className="text-green-500 dark:text-green-400 font-medium mr-1.5">
        ⏱
      </span>
      <span className="text-green-600 dark:text-green-300 font-medium mr-1.5">
        {earlyResolutionAllowed ? "Event ends:" : "Ends:"}
      </span>
      {timeLeft.days > 0 && <TimeUnit value={timeLeft.days} unit="d" />}
      <TimeUnit value={timeLeft.hours} unit="h" />
      <TimeUnit value={timeLeft.minutes} unit="m" />
      <TimeUnit value={timeLeft.seconds} unit="s" isLast={true} />
    </div>
  );
}

const TimeUnit = ({
  value,
  unit,
  isLast = false,
}: {
  value: number;
  unit: string;
  isLast?: boolean;
}) => (
  <span className={cn("flex items-center", !isLast && "mr-1")}>
    <span className="font-bold text-gray-800 dark:text-gray-200">
      {String(value).padStart(2, "0")}
    </span>
    <span className="text-gray-500 dark:text-gray-400">{unit}</span>
  </span>
);

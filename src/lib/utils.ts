import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Combine classes with tailwind-merge
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format number to fixed decimals
export function toFixed(value: number, decimals: number) {
  return value.toFixed(decimals);
}

// Format date to readable string
export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Add any other utility functions here...

// Format price with proper decimals
export function formatPrice(price: bigint, decimals: number = 18): string {
  const formatted = Number(price) / Math.pow(10, decimals);
  if (formatted < 0.01) return formatted.toFixed(4);
  if (formatted < 1) return formatted.toFixed(3);
  return formatted.toFixed(2);
}

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines conditional class names and resolves Tailwind CSS conflicts.
 * @param  {...any} inputs - Class values, objects, or arrays
 * @returns {string} - Merged class string
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Computes a human-readable remaining time string until document expiration.
 * @param {string|Date|null} expiresAt
 * @param {string|Date|null} [createdAt]
 * @returns {{ label: string, isExpired: boolean, isExpiringSoon: boolean }}
 */
export function formatExpirationCountdown(expiresAt, createdAt) {
  let targetTime = null;
  if (expiresAt) {
    targetTime = new Date(expiresAt).getTime();
  } else if (createdAt) {
    targetTime = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000;
  }

  if (!targetTime || isNaN(targetTime)) {
    return { label: "24-hr retention", isExpired: false, isExpiringSoon: false };
  }

  const diffMs = targetTime - Date.now();

  if (diffMs <= 0) {
    return { label: "Expired", isExpired: true, isExpiringSoon: true };
  }

  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (diffMinutes < 5) {
    return { label: "Expiring soon", isExpired: false, isExpiringSoon: true };
  }

  if (hours > 0) {
    return {
      label: `Expires in ${hours}h ${minutes}m`,
      isExpired: false,
      isExpiringSoon: false,
    };
  }

  return {
    label: `Expires in ${minutes}m`,
    isExpired: false,
    isExpiringSoon: minutes < 15,
  };
}

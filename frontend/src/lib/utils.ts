import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validate and clean a photo URL.
 * Specifically checks for valid data URIs to prevent ERR_INVALID_URL.
 * Returns undefined if valid URL cannot be formed (to trigger fallback).
 */
export const getValidPhotoUrl = (url?: string | null) => {
  if (!url) return undefined;
  if (url.startsWith('data:')) {
    // Remove whitespace/newlines including those from copy-paste
    const cleanUrl = url.replace(/\s/g, '');
    
    // Validate structure: data:image/[type];base64,[data]
    // This strict regex prevents passing malformed base64 to the browser
    // which would cause "net::ERR_INVALID_URL"
    const dataUriRegex = /^data:image\/[a-zA-Z0-9+.-]+;base64,[a-zA-Z0-9+/]+={0,2}$/;
    
    if (dataUriRegex.test(cleanUrl)) {
      return cleanUrl;
    }
    
    // If invalid, log warning (in dev) and return undefined to trigger AvatarFallback
    console.warn('Invalid data URI detected for user avatar');
    return undefined;
  }
  return url;
};

/**
 * Token Utilities
 *
 * Helper functions to decode and inspect Firebase ID tokens
 */

/**
 * Decode a JWT token (without verification)
 * This is for debugging purposes only - never use for auth decisions
 */
export const decodeJWT = (token: string): any => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    // Decode the payload (middle part)
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
};

/**
 * Get token expiration time
 */
export const getTokenExpiration = (token: string): Date | null => {
  const decoded = decodeJWT(token);
  if (decoded && decoded.exp) {
    return new Date(decoded.exp * 1000);
  }
  return null;
};

/**
 * Check if token is expired
 */
export const isTokenExpired = (token: string): boolean => {
  const expiration = getTokenExpiration(token);
  if (!expiration) return true;
  return expiration < new Date();
};

/**
 * Get time until token expires (in minutes)
 */
export const getTimeUntilExpiration = (token: string): number | null => {
  const expiration = getTokenExpiration(token);
  if (!expiration) return null;

  const now = new Date();
  const diff = expiration.getTime() - now.getTime();
  return Math.floor(diff / 1000 / 60); // Convert to minutes
};

/**
 * Log detailed token information
 */
export const logTokenDetails = (token: string): void => {
  console.log('🎫 Token Analysis:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const decoded = decodeJWT(token);
  if (decoded) {
    console.log('📋 Token Claims:');
    console.log('   User ID:', decoded.user_id || decoded.uid);
    console.log('   Email:', decoded.email);
    console.log('   Email Verified:', decoded.email_verified);
    console.log('   Auth Time:', new Date(decoded.auth_time * 1000).toLocaleString());
    console.log('   Issued At:', new Date(decoded.iat * 1000).toLocaleString());
    console.log('   Expires At:', new Date(decoded.exp * 1000).toLocaleString());

    const minutesUntilExpiry = getTimeUntilExpiration(token);
    console.log('   ⏱️  Time Until Expiry:', minutesUntilExpiry, 'minutes');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Full decoded token:', decoded);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
};

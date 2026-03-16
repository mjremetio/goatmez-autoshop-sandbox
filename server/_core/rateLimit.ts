/**
 * In-memory rate limiter and account lockout for login security.
 * Tracks failed attempts by IP and username to prevent brute-force attacks.
 */

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minute lockout
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // cleanup every 10 min

const ipAttempts = new Map<string, AttemptRecord>();
const usernameAttempts = new Map<string, AttemptRecord>();

function getOrCreate(map: Map<string, AttemptRecord>, key: string): AttemptRecord {
  let record = map.get(key);
  const now = Date.now();
  if (!record || now - record.firstAttempt > WINDOW_MS) {
    record = { count: 0, firstAttempt: now, lockedUntil: null };
    map.set(key, record);
  }
  return record;
}

export function checkRateLimit(ip: string, username: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();

  // Check IP lockout
  const ipRecord = getOrCreate(ipAttempts, ip);
  if (ipRecord.lockedUntil && now < ipRecord.lockedUntil) {
    return { allowed: false, retryAfterMs: ipRecord.lockedUntil - now };
  } else if (ipRecord.lockedUntil && now >= ipRecord.lockedUntil) {
    ipAttempts.delete(ip);
  }

  // Check username lockout
  const normalizedUsername = username.toLowerCase().trim();
  const userRecord = getOrCreate(usernameAttempts, normalizedUsername);
  if (userRecord.lockedUntil && now < userRecord.lockedUntil) {
    return { allowed: false, retryAfterMs: userRecord.lockedUntil - now };
  } else if (userRecord.lockedUntil && now >= userRecord.lockedUntil) {
    usernameAttempts.delete(normalizedUsername);
  }

  return { allowed: true };
}

export function recordFailedAttempt(ip: string, username: string): { locked: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const normalizedUsername = username.toLowerCase().trim();

  const ipRecord = getOrCreate(ipAttempts, ip);
  ipRecord.count++;
  if (ipRecord.count >= MAX_ATTEMPTS) {
    ipRecord.lockedUntil = now + LOCKOUT_MS;
    console.warn(`[Security] IP ${ip} locked out after ${ipRecord.count} failed attempts`);
    return { locked: true, retryAfterMs: LOCKOUT_MS };
  }

  const userRecord = getOrCreate(usernameAttempts, normalizedUsername);
  userRecord.count++;
  if (userRecord.count >= MAX_ATTEMPTS) {
    userRecord.lockedUntil = now + LOCKOUT_MS;
    console.warn(`[Security] Account "${username}" locked out after ${userRecord.count} failed attempts`);
    return { locked: true, retryAfterMs: LOCKOUT_MS };
  }

  return { locked: false };
}

export function clearAttempts(ip: string, username: string): void {
  ipAttempts.delete(ip);
  usernameAttempts.delete(username.toLowerCase().trim());
}

// Periodic cleanup of expired records
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of ipAttempts) {
    if (now - record.firstAttempt > WINDOW_MS && (!record.lockedUntil || now > record.lockedUntil)) {
      ipAttempts.delete(key);
    }
  }
  for (const [key, record] of usernameAttempts) {
    if (now - record.firstAttempt > WINDOW_MS && (!record.lockedUntil || now > record.lockedUntil)) {
      usernameAttempts.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

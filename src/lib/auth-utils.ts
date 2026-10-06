export function getOrCreateUserId(): string {
  const key = 'remi_anonymous_user_id';
  let userId = localStorage.getItem(key);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(key, userId);
  }
  return userId;
}

/** Legacy alias or session-specific identifier */
export function getOrCreateSessionId(): string {
  return getOrCreateUserId();
}

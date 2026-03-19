export const BCRYPT_SALT_ROUNDS = 12;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

export const TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh',
} as const;

export const RFID = {
  DEBOUNCE_MINUTES: 5,
  GRACE_PERIOD_MINUTES: 15,
};

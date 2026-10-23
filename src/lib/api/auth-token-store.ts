export const ADMIN_ACCESS_TOKEN_STORAGE_KEY = "portfolio.admin.accessToken";
export const ADMIN_ACCESS_TOKEN_CHANGED_EVENT =
  "portfolio-admin-token-changed";

type AdminAccessTokenChangedDetail = {
  hasToken: boolean;
};

function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function emitTokenChanged(hasToken: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AdminAccessTokenChangedDetail>(
      ADMIN_ACCESS_TOKEN_CHANGED_EVENT,
      {
        detail: { hasToken },
      }
    )
  );
}

export function getAdminAccessToken(): string | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  return window.localStorage.getItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY);
}

export function setAdminAccessToken(token: string): void {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY, token);
  emitTokenChanged(true);
}

export function clearAdminAccessToken(): void {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY);
  emitTokenChanged(false);
}

export function hasAdminAccessToken(): boolean {
  return getAdminAccessToken() !== null;
}

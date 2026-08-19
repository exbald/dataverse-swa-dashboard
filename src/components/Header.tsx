type HeaderProps = {
  authStatus: "authenticated" | "anonymous" | "loading";
  onSignIn?: () => void;
  onSignOut?: () => void;
};

export function Header({ authStatus, onSignIn, onSignOut }: HeaderProps) {
  return (
    <header className="header" role="banner">
      <div className="header__brand" aria-label="Dataverse Dashboard">
        <span className="header__brand-mark" aria-hidden="true">
          D
        </span>
        <span>Dataverse Dashboard</span>
      </div>
      <div className="header__actions">
        {authStatus === "loading" ? (
          <span className="header__auth" aria-live="polite">
            Checking session…
          </span>
        ) : authStatus === "authenticated" ? (
          <>
            <span className="header__auth">
              <span className="header__auth-dot" aria-hidden="true" />
              Signed in
            </span>
            {onSignOut && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={onSignOut}>
                Sign out
              </button>
            )}
          </>
        ) : (
          <>
            <span className="header__auth">
              <span className="header__auth-dot header__auth-dot--anon" aria-hidden="true" />
              Not signed in
            </span>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={onSignIn ?? (() => (window.location.href = "/.auth/login/aad"))}
            >
              Sign in
            </button>
          </>
        )}
      </div>
    </header>
  );
}

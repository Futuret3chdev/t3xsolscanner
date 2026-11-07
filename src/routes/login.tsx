import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search.next === "string" ? search.next : "/claim",
  }),
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in · T3X" }] }),
});

function LoginPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const dest = next.startsWith("/") ? next : "/claim";
    try {
      const result =
        mode === "up"
          ? await authClient.signUp.email({ email, password, name: name || email.split("@")[0] || "T3X", callbackURL: dest })
          : await authClient.signIn.email({ email, password, callbackURL: dest });
      if (result.error) {
        setError(result.error.message || "Could not sign in.");
        return;
      }
      await navigate({ to: dest });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8">
      <div>
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">Account</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Sign in to claim T3X</h1>
        <p className="mt-2 text-sm text-pretty text-muted">
          Every full $20 you swap or bridge is logged on your account. Register once, then link the wallet you trade with.
        </p>
      </div>
      {authEnabled ? (
        <>
          <div className="flex h-11 gap-2">
            {(["up", "in"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`h-11 flex-1 rounded-lg text-sm font-semibold ${mode === item ? "bg-accent text-bg" : "border border-line text-muted"}`}
              >
                {item === "up" ? "Register" : "Sign in"}
              </button>
            ))}
          </div>
          <form className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4" onSubmit={(event) => void onSubmit(event)}>
            {mode === "up" ? (
              <label className="text-xs font-medium tracking-wide text-muted uppercase">
                Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-line bg-bg px-3 text-base text-fg outline-none focus-visible:border-accent"
                />
              </label>
            ) : null}
            <label className="text-xs font-medium tracking-wide text-muted uppercase">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="mt-2 h-11 w-full rounded-lg border border-line bg-bg px-3 text-base text-fg outline-none focus-visible:border-accent"
              />
            </label>
            <label className="text-xs font-medium tracking-wide text-muted uppercase">
              Password
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                className="mt-2 h-11 w-full rounded-lg border border-line bg-bg px-3 text-base text-fg outline-none focus-visible:border-accent"
              />
            </label>
            <button type="submit" disabled={busy} className="h-11 rounded-lg bg-accent text-sm font-semibold text-bg disabled:opacity-60">
              {busy ? "Working…" : mode === "up" ? "Create account" : "Sign in"}
            </button>
            {error ? <p className="text-sm text-pretty text-down">{error}</p> : null}
          </form>
          <div className="flex flex-col gap-2">
            {GROK_PROVIDERS.map((provider) => (
              <button
                key={provider.providerId}
                type="button"
                onClick={() => signIn(provider.providerId, { callbackURL: next.startsWith("/") ? next : "/claim" })}
                className="h-11 rounded-lg border border-line text-sm font-semibold"
              >
                Continue with {provider.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">Sign-in is off.</p>
      )}
    </div>
  );
}

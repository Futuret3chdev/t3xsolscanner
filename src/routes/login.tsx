import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

const PORTAL = "https://t3x.futuret3ch.com.au/login";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in · T3X" }] }),
});

function LoginPage() {
  useEffect(() => {
    window.location.replace(PORTAL);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in on the portal</h1>
      <p className="text-sm text-muted">Register and sign in use the T3x portal account.</p>
      <a href={PORTAL} className="inline-flex h-11 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-bg">
        Continue to portal sign in
      </a>
    </div>
  );
}

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";

type AccessState = "loading" | "signed-out" | "authorized" | "forbidden" | "unavailable";

export default function LiveAccess({ staffOnly, children }: { staffOnly: boolean; children: ReactNode }) {
  const [state, setState] = useState<AccessState>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const client = supabase;
    if (!client) { setState("unavailable"); return; }
    let active = true;
    const check = async () => {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (!active) return;
      if (sessionError) { setState("unavailable"); return; }
      const user = sessionData.session?.user;
      if (!user) { setState("signed-out"); return; }
      const { data, error } = await client.from("event_memberships").select("role")
        .eq("event_id", 17135).eq("user_id", user.id).maybeSingle();
      if (!active) return;
      if (error) { setState("unavailable"); return; }
      setState(data && (!staffOnly || data.role === "staff" || data.role === "admin") ? "authorized" : "forbidden");
    };
    void check();
    const { data: listener } = client.auth.onAuthStateChange(() => { window.setTimeout(() => { void check(); }, 0); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [staffOnly]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setMessage("");
    setState("loading");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPassword("");
    if (error) { setMessage("Sign-in failed. Check your credentials and try again."); setState("signed-out"); }
  }

  if (state === "authorized") return <>{children}</>;
  return (
    <main className="access-shell">
      <section className="access-panel" aria-live="polite">
        <h1>New Horizons 2026</h1>
        {state === "loading" && <p>Checking access…</p>}
        {state === "unavailable" && <p role="alert">Live access is unavailable. Check the Supabase configuration and connection.</p>}
        {state === "forbidden" && <>
          <p role="alert">This account is not authorized for this event view.</p>
          <button type="button" onClick={() => { void supabase?.auth.signOut(); }}>Sign out</button>
        </>}
        {state === "signed-out" && <form onSubmit={(event) => { void signIn(event); }}>
          <p>Sign in to view {staffOnly ? "the staff controller" : "the event dashboard"}.</p>
          <label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button type="submit">Sign in</button>
          {message && <p role="alert">{message}</p>}
        </form>}
      </section>
    </main>
  );
}

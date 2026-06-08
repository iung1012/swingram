import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { computeAge } from "@/lib/age";
import { BrasaLogo, BrasaWordmark } from "@/components/brasa-logo";
import { Mail, Lock, Calendar, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entrar — Brasa Swing" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "login") {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return toast.error(error.message);
      nav({ to: "/home" });
      return;
    }
    if (!birthDate) return toast.error("Informe sua data de nascimento.");
    if (computeAge(birthDate) < 18) return toast.error("Você precisa ter 18 anos ou mais.");
    if (password.length < 8) return toast.error("Senha precisa ter pelo menos 8 caracteres.");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { birth_date: birthDate } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Continue o onboarding.");
    nav({ to: "/onboarding", search: { bd: birthDate } as never });
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) return toast.error("Falha no login com Google");
    if (r.redirected) return;
    nav({ to: "/home" });
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{ background: "var(--gradient-brasa)" }} />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-primary/20 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col px-6 pt-16 pb-10">
        {/* Brand */}
        <div className="mb-12 flex flex-col items-center">
          <BrasaLogo glow className="h-24 w-24" />
          <h1 className="mt-5 text-3xl font-bold tracking-tight">
            <BrasaWordmark />
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Encontros casuais, swing e exibicionismo. Acesso restrito a +18.
          </p>
        </div>

        {/* Segmented control */}
        <div className="mb-6 flex rounded-full border border-border bg-card/50 p-1 backdrop-blur">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                mode === m
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "login" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field icon={Mail}>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-14 border-0 bg-transparent pl-12 text-base placeholder:text-muted-foreground/60 focus-visible:ring-0"
            />
          </Field>
          <Field icon={Lock}>
            <Input
              type="password"
              placeholder={mode === "signup" ? "Senha (mín. 8)" : "Senha"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "signup" ? 8 : undefined}
              className="h-14 border-0 bg-transparent pl-12 text-base placeholder:text-muted-foreground/60 focus-visible:ring-0"
            />
          </Field>
          {mode === "signup" && (
            <Field icon={Calendar}>
              <Input
                type="date"
                placeholder="Data de nascimento"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
                className="h-14 border-0 bg-transparent pl-12 text-base placeholder:text-muted-foreground/60 focus-visible:ring-0"
              />
            </Field>
          )}

          {mode === "signup" && (
            <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
              Ao criar conta você declara ter 18 anos ou mais e aceita os Termos.
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="group relative h-14 w-full overflow-hidden rounded-full text-base font-semibold text-primary-foreground shadow-[var(--shadow-brasa)] transition active:scale-[0.98]"
            style={{ background: "var(--gradient-brasa-h)" }}
          >
            <span className="relative z-10 inline-flex items-center justify-center gap-2">
              {loading ? "Carregando..." : mode === "login" ? "Entrar" : "Criar conta +18"}
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" />
            </span>
          </Button>
        </form>

        <div className="my-7 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">ou</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={google}
          className="flex h-14 w-full items-center justify-center gap-3 rounded-full border border-border bg-card/60 text-base font-medium backdrop-blur transition hover:bg-card active:scale-[0.98]"
        >
          <GoogleIcon />
          Continuar com Google
        </button>

        <p className="mt-auto pt-10 text-center text-[11px] text-muted-foreground">
          Brasa Swing · Comunidade adulta verificada
        </p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl border border-border bg-card/60 backdrop-blur transition focus-within:border-primary/60 focus-within:shadow-[0_0_0_4px_oklch(0.64_0.24_28/0.12)]">
      <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      {children}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.4 12 2.4 6.8 2.4 2.6 6.6 2.6 11.9S6.8 21.4 12 21.4c6.9 0 9.5-4.8 9.5-9.5 0-.6-.1-1.1-.2-1.7H12z"/>
    </svg>
  );
}

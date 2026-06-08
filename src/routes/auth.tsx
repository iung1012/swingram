import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { computeAge } from "@/lib/age";
import { BrasaLogo } from "@/components/brasa-logo";
import { SpiralLoader } from "@/components/spiral-loader";

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
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#050505] px-6 py-12 font-body text-[#f5f5f5] selection:bg-primary/30">
      {/* Brasa ambient glow — pulsa devagar atrás do wordmark */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
          style={{
            background: "radial-gradient(circle, oklch(0.55 0.22 35 / 0.18), transparent 70%)",
            animation: "brasa-pulse 6s ease-in-out infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes brasa-pulse {
          0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.85; transform: translate(-50%, -50%) scale(1.05); }
        }
        @keyframes brasa-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <main
        className="relative z-10 flex w-full max-w-[400px] flex-col"
        style={{ animation: "brasa-fade-up 420ms ease-out both" }}
      >
        {/* Wordmark */}
        <header className="mb-12 flex flex-col items-center">
          <BrasaLogo className="mb-4 h-10 w-10" />
          <h1
            className="font-display text-2xl font-bold tracking-tight"
            style={{
              backgroundImage: "linear-gradient(135deg, #fff 0%, #fff 55%, oklch(0.78 0.18 55) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Brasa Swing
          </h1>
          <p className="mt-2 text-center text-sm text-white/40">
            Encontros casuais, swing e exibicionismo
          </p>
        </header>

        {/* Tabs underline */}
        <div className="mb-8 flex border-b border-white/10">
          {(["login", "signup"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 cursor-pointer border-b-2 pb-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary text-white"
                    : "border-transparent text-white/40 hover:text-white/60"
                }`}
              >
                {m === "login" ? "Entrar" : "Criar conta"}
              </button>
            );
          })}
        </div>

        {/* Form */}
        <form onSubmit={submit} className="space-y-4">
          <FieldGroup label="Email">
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-white placeholder:text-white/20 transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </FieldGroup>

          <FieldGroup label="Senha">
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "signup" ? 8 : undefined}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-white placeholder:text-white/20 transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </FieldGroup>

          {mode === "signup" && (
            <>
              <FieldGroup label="Data de nascimento">
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-white placeholder:text-white/20 transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 [color-scheme:dark]"
                />
              </FieldGroup>
              <p className="px-1 text-[11px] leading-relaxed text-white/40">
                Ao criar conta você declara ter 18 anos ou mais e aceita os Termos.
              </p>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-[0_0_24px_oklch(0.64_0.24_28/0.28)] transition-all hover:bg-primary/90 hover:shadow-[0_0_32px_oklch(0.64_0.24_28/0.42)] active:scale-[0.98] disabled:opacity-70"
          >
            {loading ? (
              <SpiralLoader size={18} />
            ) : (
              <>
                {mode === "login" ? "Entrar" : "Criar conta"}
                <ArrowGlyph />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="my-8 flex items-center">
          <div className="h-px flex-1 bg-white/10" />
          <span className="px-4 text-[10px] font-bold uppercase tracking-widest text-white/30">
            ou
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={google}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 py-3.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/[0.03]"
        >
          <GoogleIcon />
          Continuar com Google
        </button>

        {/* Footnote */}
        <p className="mt-12 text-center text-[10px] font-medium uppercase tracking-widest text-white/25">
          Comunidade adulta verificada · +18
        </p>
      </main>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="ml-1 text-[11px] font-semibold uppercase tracking-widest text-white/40">
        {label}
      </label>
      {children}
    </div>
  );
}

function ArrowGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

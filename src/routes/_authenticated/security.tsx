import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff } from "lucide-react";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

export const Route = createFileRoute("/_authenticated/security")({
  ssr: false,
  head: () => ({ meta: [{ title: "Segurança — Brasa Swing" }] }),
  component: SecurityPage,
});

function randomBase32(len = 20) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let out = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % 32];
  return out;
}

function genBackupCodes(n = 8) {
  return Array.from({ length: n }, () => {
    const a = new Uint32Array(2);
    crypto.getRandomValues(a);
    return `${a[0].toString(36).slice(0, 5)}-${a[1].toString(36).slice(0, 5)}`.toUpperCase();
  });
}

function SecurityPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [setup, setSetup] = useState<{ secret: string; qr: string; codes: string[] } | null>(null);
  const [code, setCode] = useState("");

  const { data: state } = useQuery({
    queryKey: ["2fa", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_2fa").select("enabled").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  async function startSetup() {
    if (!user) return;
    const secret = randomBase32();
    const totp = new OTPAuth.TOTP({
      issuer: "Brasa Swing",
      label: user.email ?? "user",
      algorithm: "SHA1", digits: 6, period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const qr = await QRCode.toDataURL(totp.toString());
    setSetup({ secret, qr, codes: genBackupCodes() });
  }

  async function enable() {
    if (!setup || !user) return;
    const totp = new OTPAuth.TOTP({
      issuer: "Brasa Swing", label: user.email ?? "user",
      algorithm: "SHA1", digits: 6, period: 30,
      secret: OTPAuth.Secret.fromBase32(setup.secret),
    });
    const delta = totp.validate({ token: code.replace(/\s/g, ""), window: 1 });
    if (delta === null) return toast.error("Código inválido");
    const { error } = await supabase.from("user_2fa").upsert({
      user_id: user.id, totp_secret: setup.secret, enabled: true, backup_codes: setup.codes,
    });
    if (error) return toast.error(error.message);
    toast.success("2FA ativado! Guarde os códigos de backup.");
    setSetup(null); setCode("");
    qc.invalidateQueries({ queryKey: ["2fa", user.id] });
  }

  async function disable() {
    if (!user) return;
    if (!confirm("Desativar 2FA?")) return;
    await supabase.from("user_2fa").update({ enabled: false }).eq("user_id", user.id);
    qc.invalidateQueries({ queryKey: ["2fa", user.id] });
    toast.success("2FA desativado");
  }

  return (
    <div className="mx-auto max-w-md space-y-3 px-4 py-6">
      <h1 className="text-xl font-bold">Segurança</h1>

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          {state?.enabled ? <ShieldCheck className="h-5 w-5 text-primary" /> : <ShieldOff className="h-5 w-5 text-muted-foreground" />}
          <h2 className="font-semibold">Autenticação em 2 fatores (TOTP)</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Use Google Authenticator, Authy, 1Password ou similar.
        </p>

        {state?.enabled && !setup && (
          <Button variant="destructive" className="w-full" onClick={disable}>Desativar 2FA</Button>
        )}

        {!state?.enabled && !setup && (
          <Button className="w-full" onClick={startSetup}>Ativar 2FA</Button>
        )}

        {setup && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-background p-3">
              <p className="mb-2 text-xs text-muted-foreground">1. Escaneie o QR code:</p>
              <img src={setup.qr} alt="QR code 2FA" className="mx-auto h-44 w-44" />
              <p className="mt-2 break-all text-center font-mono text-[10px] text-muted-foreground">{setup.secret}</p>
            </div>
            <div>
              <Label className="text-xs">2. Códigos de backup (guarde agora — não aparecerão de novo):</Label>
              <div className="mt-1 grid grid-cols-2 gap-1 rounded border border-border bg-background p-2 font-mono text-xs">
                {setup.codes.map((c) => <span key={c}>{c}</span>)}
              </div>
            </div>
            <div>
              <Label>3. Digite o código de 6 dígitos do app:</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" maxLength={6} inputMode="numeric" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setSetup(null); setCode(""); }}>Cancelar</Button>
              <Button className="flex-1" onClick={enable}>Confirmar</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

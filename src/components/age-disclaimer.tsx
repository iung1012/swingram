import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const KEY = "age-disclaimer-v1";

export function AgeDisclaimer() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(KEY)) setOpen(true);
  }, []);
  function accept() {
    localStorage.setItem(KEY, new Date().toISOString());
    setOpen(false);
  }
  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conteúdo adulto +18</DialogTitle>
          <DialogDescription>
            Este aplicativo é destinado <strong>exclusivamente a maiores de 18 anos</strong>. Pode conter nudez e
            conteúdo sexualmente explícito. Ao continuar, você declara ter idade legal e aceita os termos.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { window.location.href = "https://www.google.com"; }}>Sair</Button>
          <Button onClick={accept}>Sou maior de 18 — entrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

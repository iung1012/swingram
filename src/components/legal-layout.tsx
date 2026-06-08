import { Link } from "@tanstack/react-router";
import { ArrowLeft, Flame } from "lucide-react";
import type { ReactNode } from "react";

interface LegalLayoutProps {
  children: ReactNode;
  title: string;
  lastUpdated: string;
}

export function LegalLayout({ children, title, lastUpdated }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold tracking-tight">Brasa Swing</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-10 pb-24">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{lastUpdated}</p>
        </div>

        <article className="prose prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-10 prose-h2:text-xl prose-h2:text-foreground prose-h3:mt-8 prose-h3:text-lg prose-h3:text-foreground/90 prose-p:text-muted-foreground prose-strong:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-li:text-muted-foreground prose-ul:space-y-1">
          {children}
        </article>

        {/* Footer */}
        <footer className="mt-16 border-t border-border/40 pt-8 text-center text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} Brasa Swing. Todos os direitos reservados.
          </p>
          <div className="mt-3 flex justify-center gap-4">
            <Link to="/terms" className="text-primary hover:underline">
              Termos de Uso
            </Link>
            <span className="text-border">|</span>
            <Link to="/privacy" className="text-primary hover:underline">
              Política de Privacidade
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

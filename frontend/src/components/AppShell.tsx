import type { ReactNode } from "react";
import { Building2, ClipboardList, FilePlus2, Files, LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Me } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  applicant: "Applicant",
  reviewer: "Reviewer",
  program_admin: "Program admin",
};

function NavLink({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof FilePlus2;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}

export function AppShell({
  me,
  route,
  navigate,
  onSignOut,
  children,
}: {
  me: Me;
  route: string;
  navigate: (to: string) => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const isStaff = me.role === "reviewer" || me.role === "program_admin";
  return (
    <div className="bg-background min-h-screen">
      <header className="border-border bg-card/50 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <button
            onClick={() => navigate(isStaff ? "#/queue" : "#/mine")}
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <Building2 className="text-primary size-5" />
            Permit Review
          </button>
          <nav className="flex items-center gap-1">
            {isStaff ? (
              <NavLink
                active={route.startsWith("#/queue")}
                onClick={() => navigate("#/queue")}
                icon={ClipboardList}
              >
                Review queue
              </NavLink>
            ) : (
              <>
                <NavLink
                  active={route.startsWith("#/apply")}
                  onClick={() => navigate("#/apply")}
                  icon={FilePlus2}
                >
                  Apply
                </NavLink>
                <NavLink
                  active={route.startsWith("#/mine")}
                  onClick={() => navigate("#/mine")}
                  icon={Files}
                >
                  My applications
                </NavLink>
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-medium">{me.name}</div>
              <div className="text-muted-foreground text-xs">{me.email}</div>
            </div>
            <Badge variant="secondary">{ROLE_LABELS[me.role] ?? me.role}</Badge>
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}

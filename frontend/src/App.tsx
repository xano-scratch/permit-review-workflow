import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Login } from "@/screens/Login";
import { Apply } from "@/screens/Apply";
import { MyApplications } from "@/screens/MyApplications";
import { Queue } from "@/screens/Queue";
import { Detail } from "@/screens/Detail";
import { api, getToken, setToken, type Me } from "@/lib/api";

function useHashRoute(): string {
  const [route, setRoute] = useState(() => window.location.hash || "#/");
  useEffect(() => {
    const on = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

function navigate(to: string) {
  if (window.location.hash === to) {
    // Force a re-read even when navigating to the current hash.
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = to;
  }
}

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [booting, setBooting] = useState(true);
  const route = useHashRoute();

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!getToken()) {
        setBooting(false);
        return;
      }
      try {
        const m = await api.me();
        if (!cancelled) setMe(m);
      } catch {
        setToken(null);
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  function onSignOut() {
    setToken(null);
    setMe(null);
    navigate("#/");
  }

  if (booting) {
    return (
      <div className="bg-background text-muted-foreground flex min-h-screen items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading...
      </div>
    );
  }

  if (!me) {
    return (
      <Login
        onAuthed={(m) => {
          setMe(m);
          navigate(m.role === "applicant" ? "#/mine" : "#/queue");
        }}
      />
    );
  }

  const isStaff = me.role === "reviewer" || me.role === "program_admin";
  let screen;
  const detailMatch = route.match(/^#\/app\/(\d+)/);
  if (detailMatch) {
    screen = <Detail id={Number(detailMatch[1])} me={me} navigate={navigate} />;
  } else if (route.startsWith("#/apply")) {
    screen = <Apply navigate={navigate} />;
  } else if (route.startsWith("#/queue")) {
    screen = <Queue navigate={navigate} />;
  } else if (route.startsWith("#/mine")) {
    screen = <MyApplications navigate={navigate} />;
  } else {
    screen = isStaff ? <Queue navigate={navigate} /> : <MyApplications navigate={navigate} />;
  }

  return (
    <AppShell me={me} route={route} navigate={navigate} onSignOut={onSignOut}>
      {screen}
    </AppShell>
  );
}

import { useEffect, useState } from "react";
import { useConvexAuth, useAuthActions } from "@convex-dev/auth/react";
import Landing from "./pages/Landing";
import Board from "./pages/Board";
import SignIn from "./pages/SignIn";
import { initTheme } from "./lib/data";

export default function App() {
  const [route, setRoute] = useState(window.location.hash === "#/board" ? "board" : "home");
  const { isAuthenticated, isLoading } = useConvexAuth();
  const authActions = useAuthActions();

  useEffect(() => {
    initTheme();
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash === "#/board" ? "board" : "home");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (r: "home" | "board") => {
    window.location.hash = r === "board" ? "#/board" : "";
    setRoute(r);
  };

  const signOut = async () => {
    await authActions.signOut();
    go("home");
  };

  if (route === "board" && !isAuthenticated) {
    if (isLoading) {
      return <div className="board"><p className="meta mono">[checking session…]</p></div>;
    }
    return <SignIn onHome={() => go("home")} />;
  }

  return route === "board" && isAuthenticated ? (
    <Board onHome={() => go("home")} onSignOut={signOut} />
  ) : (
    <Landing onBoard={() => go("board")} />
  );
}

import React from "react";
import { Outlet } from "@tanstack/react-router";
import { T } from "../../tokens";
import { G } from "../../typography";

/**
 * Shell da área do Consultor (A0.1 — stub). Layout próprio, independente do
 * shell do app do cliente. Sidebar + Topbar completos chegam em A0.3; por ora,
 * apenas o contêiner full-screen + `<Outlet/>` das sub-rotas do consultor.
 */
export function ConsultantShell() {
  return (
    <div style={{ ...G, minHeight: "100vh", background: T.bg, overflowY: "auto" }}>
      <Outlet />
    </div>
  );
}

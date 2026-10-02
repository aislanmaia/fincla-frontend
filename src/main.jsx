import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./ui/app-shell.css";

const isAdminHost = window.location.hostname === "admin.fincla.com" || import.meta.env.VITE_ADMIN_MODE === "true";
const root = createRoot(document.getElementById("root"));

if (isAdminHost) {
  import("./admin/AdminApp.jsx").then(({ AdminApp }) => {
    root.render(<StrictMode><AdminApp /></StrictMode>);
  });
} else {
  Promise.all([
    import("@tanstack/react-router"),
    import("./ui/routing/finclaRouter.jsx"),
  ]).then(([{ RouterProvider }, { finclaRouter }]) => {
    root.render(<StrictMode><RouterProvider router={finclaRouter} /></StrictMode>);
  });
}

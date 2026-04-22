import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { finclaRouter } from "./ui/routing/finclaRouter.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={finclaRouter} />
  </StrictMode>
);

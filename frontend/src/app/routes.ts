import { createBrowserRouter } from "react-router";
import { TotemPage } from "./pages/TotemPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: TotemPage,
  },
]);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import Home from "./components/Home";
import HowToUse from "./components/HowToUse";
import Leaderboard from "./components/Leaderboard";
import Utils from "./components/Utils";
import UserPage from "./pages/UserPage";
import TotwPage from "./pages/TotwPage";
import WrPage from "./pages/WrPage";
import ComparePage from "./pages/ComparePage";
import "./index.css";

const router = createHashRouter([
  { path: "/", Component: Home },
  { path: "/user/:userId?", Component: UserPage },
  { path: "/totw", Component: TotwPage },
  { path: "/wr", Component: WrPage },
  { path: "/compare", Component: ComparePage },
  { path: "/how-to-use", Component: HowToUse },
  { path: "/leaderboard", Component: Leaderboard },
  { path: "/utils", Component: Utils },
]);

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
}

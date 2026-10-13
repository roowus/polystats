import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Home from "./components/Home";
import HowToUse from "./components/HowToUse";
import Leaderboard from "./components/Leaderboard";
import Utils from "./components/Utils";
import UserPage from "./pages/UserPage";
import TotwPage from "./pages/TotwPage";
import WrPage from "./pages/WrPage";
import ComparePage from "./pages/ComparePage";
import HistoryPage from "./pages/HistoryPage";
import Analytics from "./components/Analytics";
import "./index.css";

const router = createBrowserRouter([
  { path: "/", Component: Home },
  { path: "/user/:userId?", Component: UserPage },
  { path: "/totw", Component: TotwPage },
  { path: "/wr", Component: WrPage },
  { path: "/compare", Component: ComparePage },
  { path: "/history", Component: HistoryPage },
  { path: "/how-to-use", Component: HowToUse },
  { path: "/leaderboard", Component: Leaderboard },
  { path: "/utils", Component: Utils },
  // Mounted on every route so SPA navigations report a page_view to GA.
  { path: "*", Component: Analytics },
]);

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
}

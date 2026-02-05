import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SocketProvider } from "./context/SocketContext.jsx";

import Join from "./player/Join.jsx";
import Waiting from "./player/Waiting.jsx";
import PlayerLayout from "./player/PlayerLayout.jsx";

import DMLogin from "./dm/DMLogin.jsx";
import DMSetup from "./dm/DMSetup.jsx";
import DMLayout from "./dm/DMLayout.jsx";

const Players = lazy(() => import("./player/Players.jsx"));
const Inventory = lazy(() => import("./player/Inventory.jsx"));
const Notes = lazy(() => import("./player/Notes.jsx"));
const Bestiary = lazy(() => import("./player/Bestiary.jsx"));
const Profile = lazy(() => import("./player/Profile.jsx"));
const Arcade = lazy(() => import("./player/Arcade.jsx"));
const ShopJoe = lazy(() => import("./player/ShopJoe.jsx"));

const DMDashboard = lazy(() => import("./dm/DMDashboard.jsx"));
const DMLobby = lazy(() => import("./dm/DMLobby.jsx"));
const DMPlayers = lazy(() => import("./dm/DMPlayers.jsx"));
const DMInventory = lazy(() => import("./dm/DMInventory.jsx"));
const DMBestiary = lazy(() => import("./dm/DMBestiary.jsx"));
const DMEvents = lazy(() => import("./dm/DMEvents.jsx"));
const DMInfoBlocks = lazy(() => import("./dm/DMInfoBlocks.jsx"));
const DMSettings = lazy(() => import("./dm/DMSettings.jsx"));
const DMPlayerProfile = lazy(() => import("./dm/DMPlayerProfile.jsx"));

const withSuspense = (element) => (
  <Suspense fallback={<PageFallback />}>
    {element}
  </Suspense>
);

function PageFallback() {
  return (
    <div className="card taped" style={{ padding: 16 }}>
      <div className="small">Loading…</div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Player */}
      <Route path="/" element={<Join />} />
      <Route path="/waiting" element={<SocketProvider role="waiting"><Waiting /></SocketProvider>} />
      <Route path="/app" element={<SocketProvider role="player"><PlayerLayout /></SocketProvider>}>
        <Route index element={<Navigate to="players" replace />} />
        <Route path="players" element={withSuspense(<Players />)} />
        <Route path="inventory" element={withSuspense(<Inventory />)} />
        <Route path="notes" element={withSuspense(<Notes />)} />
        <Route path="profile" element={withSuspense(<Profile />)} />
        <Route path="arcade" element={withSuspense(<Arcade />)} />
        <Route path="shop" element={withSuspense(<ShopJoe />)} />
        <Route path="bestiary" element={withSuspense(<Bestiary />)} />
      </Route>

      {/* DM */}
      <Route path="/dm" element={<DMLogin />} />
      <Route path="/dm/setup" element={<DMSetup />} />
      <Route path="/dm/app" element={<SocketProvider role="dm"><DMLayout /></SocketProvider>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={withSuspense(<DMDashboard />)} />
        <Route path="lobby" element={withSuspense(<DMLobby />)} />
        <Route path="players" element={withSuspense(<DMPlayers />)} />
        <Route path="players/:id/profile" element={withSuspense(<DMPlayerProfile />)} />
        <Route path="inventory" element={withSuspense(<DMInventory />)} />
        <Route path="bestiary" element={withSuspense(<DMBestiary />)} />
        <Route path="events" element={withSuspense(<DMEvents />)} />
        <Route path="info" element={withSuspense(<DMInfoBlocks />)} />
        <Route path="settings" element={withSuspense(<DMSettings />)} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SocketProvider } from "./context/SocketContext.jsx";

import Join from "./player/Join.jsx";
import Waiting from "./player/Waiting.jsx";
import PlayerLayout from "./player/PlayerLayout.jsx";
import Players from "./player/Players.jsx";
import Inventory from "./player/Inventory.jsx";
import Notes from "./player/Notes.jsx";
import Bestiary from "./player/Bestiary.jsx";
import Profile from "./player/Profile.jsx";
import Arcade from "./player/Arcade.jsx";
import ShopJoe from "./player/ShopJoe.jsx";

import DMLogin from "./dm/DMLogin.jsx";
import DMSetup from "./dm/DMSetup.jsx";
import DMLayout from "./dm/DMLayout.jsx";
import DMDashboard from "./dm/DMDashboard.jsx";
import DMLobby from "./dm/DMLobby.jsx";
import DMPlayers from "./dm/DMPlayers.jsx";
import DMInventory from "./dm/DMInventory.jsx";
import DMBestiary from "./dm/DMBestiary.jsx";
import DMEvents from "./dm/DMEvents.jsx";
import DMInfoBlocks from "./dm/DMInfoBlocks.jsx";
import DMSettings from "./dm/DMSettings.jsx";
import DMPlayerProfile from "./dm/DMPlayerProfile.jsx";

export default function App() {
  return (
    <Routes>
      {/* Player */}
      <Route path="/" element={<Join />} />
      <Route path="/waiting" element={<SocketProvider role="waiting"><Waiting /></SocketProvider>} />
      <Route path="/app" element={<SocketProvider role="player"><PlayerLayout /></SocketProvider>}>
        <Route index element={<Navigate to="players" replace />} />
        <Route path="players" element={<Players />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="notes" element={<Notes />} />
        <Route path="profile" element={<Profile />} />
        <Route path="arcade" element={<Arcade />} />
        <Route path="shop" element={<ShopJoe />} />
        <Route path="bestiary" element={<Bestiary />} />
      </Route>

      {/* DM */}
      <Route path="/dm" element={<DMLogin />} />
      <Route path="/dm/setup" element={<DMSetup />} />
      <Route path="/dm/app" element={<SocketProvider role="dm"><DMLayout /></SocketProvider>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DMDashboard />} />
        <Route path="lobby" element={<DMLobby />} />
        <Route path="players" element={<DMPlayers />} />
        <Route path="players/:id/profile" element={<DMPlayerProfile />} />
        <Route path="inventory" element={<DMInventory />} />
        <Route path="bestiary" element={<DMBestiary />} />
        <Route path="events" element={<DMEvents />} />
        <Route path="info" element={<DMInfoBlocks />} />
        <Route path="settings" element={<DMSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

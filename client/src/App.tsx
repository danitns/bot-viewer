import React from "react";
import "./App.css";
import MapViewer from "./components/map-viewer";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import SubmenuAndContent from "./components/layout/submenu-and-content";
import HomePage from "./pages/home";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/maps"
          element={
            <SubmenuAndContent>
              <MapViewer />
            </SubmenuAndContent>
          }
        />
        <Route
          path="/settings"
          element={
            <SubmenuAndContent>
              <div>settings</div>
            </SubmenuAndContent>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Footer from "./components/footer";

import Home from "./pages/Home";
import Login from "./pages/Login";
import AdminGate from "./pages/AdminGate";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin/login" element={<Login />} />

            <Route
              path="/admin"
              element={
                <AdminGate>
                  <Admin />
                </AdminGate>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </BrowserRouter>
  );
}
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Footer from "./components/footer";

import Home from "./pages/Home";
import Login from "./pages/Login";
import AdminGate from "./pages/AdminGate";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <BrowserRouter>
      <main className="min-h-[80vh]">
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
    </BrowserRouter>
  );
}

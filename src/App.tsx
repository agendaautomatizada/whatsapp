import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Inbox from "./pages/Inbox";
import Broadcasts from "./pages/Broadcasts";
import Templates from "./pages/Templates";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import MainLayout from "./components/layout/MainLayout";
import { SessionContextProvider } from "./components/auth/SessionContextProvider";
import Users from "./pages/Users"; // Importar la página de gestión de usuarios

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<MainLayout />}>
              {/* Redirige la ruta principal al Inbox */}
              <Route index element={<Navigate to="/inbox" replace />} />
              <Route path="inbox" element={<Inbox />} />
              <Route path="broadcasts" element={<Broadcasts />} />
              <Route path="templates" element={<Templates />} />
              <Route path="settings" element={<Settings />} />
              <Route path="users" element={<Users />} /> {/* Solo visible para admin en Sidebar */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
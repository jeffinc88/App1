import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import AuthCallback from "./AuthCallback";
import LoginScreen from "./screens/LoginScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import AppLayout from "./AppLayout";
import HomeScreen from "./screens/HomeScreen";
import MateriasScreen from "./screens/MateriasScreen";
import MateriaDetailScreen from "./screens/MateriaDetailScreen";
import QuizScreen from "./screens/QuizScreen";
import FlashcardScreen from "./screens/FlashcardScreen";
import SocialScreen from "./screens/SocialScreen";
import PerfilScreen from "./screens/PerfilScreen";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/" replace />;
  if (!user.onboarding_done) return <Navigate to="/onboarding" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to={user.onboarding_done ? "/app" : "/onboarding"} replace />;
  return children;
}

function Splash() {
  return (
    <div className="app-shell flex items-center justify-center">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F5A623] to-[#FF7B00] flame-glow" />
    </div>
  );
}

function AppRouter() {
  const location = useLocation();
  // CRITICAL: handle Emergent OAuth session_id in URL fragment synchronously
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><LoginScreen /></PublicRoute>} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/onboarding" element={
        <ProtectedOnboardingRoute><OnboardingScreen /></ProtectedOnboardingRoute>
      } />
      <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<HomeScreen />} />
        <Route path="materias" element={<MateriasScreen />} />
        <Route path="materia/:id" element={<MateriaDetailScreen />} />
        <Route path="quiz/:mode/:id?" element={<QuizScreen />} />
        <Route path="quiz/:mode" element={<QuizScreen />} />
        <Route path="flashcards/:id" element={<FlashcardScreen />} />
        <Route path="social" element={<SocialScreen />} />
        <Route path="perfil" element={<PerfilScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ProtectedOnboardingRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/" replace />;
  if (user.onboarding_done) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  );
}

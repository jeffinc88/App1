import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import { PaywallProvider } from "./PaywallContext";
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
import AdminScreen from "./screens/AdminScreen";

// Synchronous check for the onboarding flag in localStorage. This runs BEFORE
// any API call so it works even if the backend is slow, offline, or returns
// stale data (onboarding_done=false) due to a failed POST.
function isOnboardingCompletedLocally() {
  try {
    return localStorage.getItem("onboarding_completed") === "true";
  } catch (_e) {
    return false;
  }
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/" replace />;
  // Local flag wins over (potentially stale) server flag — prevents the
  // post-onboarding loop where backend hasn't persisted the update yet.
  if (!user.onboarding_done && !isOnboardingCompletedLocally()) {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) {
    const onboarded = user.onboarding_done || isOnboardingCompletedLocally();
    return <Navigate to={onboarded ? "/app" : "/onboarding"} replace />;
  }
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
      <Route path="/admin" element={<ProtectedRoute><AdminScreen /></ProtectedRoute>} />
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
  // Honor the local flag too — if onboarding was already completed in a
  // previous session, do not show it again.
  if (user.onboarding_done || isOnboardingCompletedLocally()) {
    return <Navigate to="/app" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <PaywallProvider>
          <AppRouter />
        </PaywallProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

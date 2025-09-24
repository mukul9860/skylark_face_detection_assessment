import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProtectedRoute from './components/ProtectedRoute';
import NotFoundPage from './pages/NotFoundPage';

const LoginPageWrapper = () => {
  const token = localStorage.getItem('authToken');
  return token ? <Navigate to="/dashboard" replace /> : <LoginPage />;
};

function App() {
  console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPageWrapper />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export default App;
import { Navigate } from 'react-router-dom';

const NotFoundPage = () => {
  const token = localStorage.getItem('authToken');
  return token ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
};

export default NotFoundPage;
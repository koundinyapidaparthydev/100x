import { Navigate } from 'react-router-dom';

/** Legacy dashboard entry — project overview lives at `/projects/:projectId`. */
export default function Dashboard() {
  return <Navigate to="/projects" replace />;
}

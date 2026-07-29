import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Boards from './pages/Boards';
import TaskDetail from './pages/TaskDetail';
import Policies from './pages/Policies';
import Models from './pages/Models';
import Cloud from './pages/Cloud';
import PiiRules from './pages/PiiRules';
import AuditLog from './pages/AuditLog';
import Admin from './pages/Admin';
import Approvals from './pages/Approvals';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="boards" element={<Boards />} />
          <Route path="boards/task/:id" element={<TaskDetail />} />
          <Route path="policies" element={<Policies />} />
          <Route path="models" element={<Models />} />
          <Route path="cloud" element={<Cloud />} />
          <Route path="pii-rules" element={<PiiRules />} />
          <Route path="audit-log" element={<AuditLog />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </Router>
  );
}

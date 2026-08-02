import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import RequireOnboarding from './components/RequireOnboarding';
import Login from './pages/Login';
import Projects from './pages/Projects';
import ProjectOverview from './pages/ProjectOverview';
import ProjectWork from './pages/ProjectWork';
import TaskDetail from './pages/TaskDetail';
import Policies from './pages/Policies';
import Models from './pages/Models';
import Cloud from './pages/Cloud';
import PiiRules from './pages/PiiRules';
import AuditLog from './pages/AuditLog';
import Admin from './pages/Admin';
import Approvals from './pages/Approvals';
import LegacyWorkItemRedirect from './components/LegacyWorkItemRedirect';
import Home from './pages/Home';
import HowItWorksPage from './pages/HowItWorksPage';
import Features from './pages/Features';
import Platforms from './pages/Platforms';
import Pricing from './pages/Pricing';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import Connections from './pages/Connections';
import AuthCallback from './pages/AuthCallback';
function RuntimeRoute() {
  return useLocation().hash === '#cloud' ? <Cloud /> : <Models />;
}

function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  const [pathname, targetHash] = to.split('#');
  return <Navigate replace to={`${pathname}${location.search}${targetHash ? `#${targetHash}` : location.hash}`} />;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/features" element={<Features />} />
        <Route path="/platforms" element={<Platforms />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <Onboarding />
            </RequireAuth>
          }
        />
        <Route
          element={
            <RequireAuth>
              <RequireOnboarding>
                <Layout />
              </RequireOnboarding>
            </RequireAuth>
          }
        >
          <Route path="projects" element={<Projects />} />
          <Route path="connections" element={<Connections />} />
          <Route path="projects/:projectId" element={<ProjectOverview />} />
          <Route path="projects/:projectId/work" element={<ProjectWork />} />
          <Route path="projects/:projectId/work/:workItemId" element={<TaskDetail />} />
          <Route path="projects/:projectId/approvals" element={<Approvals />} />
          <Route path="projects/:projectId/activity" element={<AuditLog />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="governance/defaults" element={<Policies />} />
          <Route path="governance/pii" element={<PiiRules />} />
          <Route path="governance/runtime" element={<RuntimeRoute />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="admin" element={<Admin />} />

          <Route path="dashboard" element={<LegacyRedirect to="/projects" />} />
          <Route path="boards" element={<LegacyRedirect to="/projects" />} />
          <Route path="boards/task/:id" element={<LegacyWorkItemRedirect />} />
          <Route path="policies" element={<LegacyRedirect to="/governance/defaults" />} />
          <Route path="pii-rules" element={<LegacyRedirect to="/governance/pii" />} />
          <Route path="models" element={<LegacyRedirect to="/governance/runtime#models" />} />
          <Route path="cloud" element={<LegacyRedirect to="/governance/runtime#cloud" />} />
          <Route path="audit-log" element={<LegacyRedirect to="/audit" />} />
        </Route>
      </Routes>
    </Router>
  );
}

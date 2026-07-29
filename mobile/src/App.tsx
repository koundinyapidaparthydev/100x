import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Splash } from './screens/Splash';
import { Login } from './screens/Login';
import { Layout } from './components/Layout';
import { Triage } from './screens/Triage';
import { TicketDetail } from './screens/TicketDetail';
import { Jobs } from './screens/Jobs';
import { Approvals } from './screens/Approvals';
import { Notifications } from './screens/Notifications';
import { PiiBlocked } from './screens/PiiBlocked';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/login" element={<Login />} />

        {/* Protected App Routes */}
        <Route path="/app" element={<Layout />}>
          <Route index element={<Navigate to="/app/triage" replace />} />
          <Route path="triage" element={<Triage />} />
          <Route path="ticket/:id" element={<TicketDetail />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="pii" element={<PiiBlocked />} />
        </Route>
      </Routes>
    </Router>
  );
}

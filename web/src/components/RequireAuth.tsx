import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { readDemoSession } from '../lib/session';

/** Client-side demo auth gate — redirects unauthenticated users to /login. */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const session = readDemoSession();
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

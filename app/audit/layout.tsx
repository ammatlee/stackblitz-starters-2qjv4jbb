import type { ReactNode } from 'react';
import RequireAuth from '../../components/RequireAuth';

export default function AuditLayout({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}

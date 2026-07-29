import { Users, Shield, Key } from 'lucide-react';

export default function Admin() {
  return (
    <div className="max-w-container-max mx-auto p-margin flex flex-col gap-xl">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-semibold text-on-surface">System Administration</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-sm max-w-2xl">Manage users, access controls, and platform-wide configurations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
        <div className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md hover:border-tertiary/50 transition-colors cursor-pointer group">
           <div className="w-12 h-12 rounded bg-surface-variant flex items-center justify-center border border-outline-variant group-hover:bg-tertiary/10 group-hover:border-tertiary/30 transition-colors">
              <Users className="text-on-surface group-hover:text-tertiary transition-colors" size={24} />
           </div>
           <h3 className="font-headline-sm text-headline-sm text-on-surface">User Management</h3>
           <p className="font-body-sm text-body-sm text-on-surface-variant">Manage team members, roles, and SSO mappings.</p>
        </div>
        
        <div className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md hover:border-tertiary/50 transition-colors cursor-pointer group">
           <div className="w-12 h-12 rounded bg-surface-variant flex items-center justify-center border border-outline-variant group-hover:bg-tertiary/10 group-hover:border-tertiary/30 transition-colors">
              <Shield className="text-on-surface group-hover:text-tertiary transition-colors" size={24} />
           </div>
           <h3 className="font-headline-sm text-headline-sm text-on-surface">Access Controls (RBAC)</h3>
           <p className="font-body-sm text-body-sm text-on-surface-variant">Define granular permissions for projects and policies.</p>
        </div>
        
        <div className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md hover:border-tertiary/50 transition-colors cursor-pointer group">
           <div className="w-12 h-12 rounded bg-surface-variant flex items-center justify-center border border-outline-variant group-hover:bg-tertiary/10 group-hover:border-tertiary/30 transition-colors">
              <Key className="text-on-surface group-hover:text-tertiary transition-colors" size={24} />
           </div>
           <h3 className="font-headline-sm text-headline-sm text-on-surface">Integration Secrets</h3>
           <p className="font-body-sm text-body-sm text-on-surface-variant">Manage credentials for Jira, Azure, and external APIs.</p>
        </div>
      </div>
    </div>
  );
}

import { Filter, Search, Download, Clock } from 'lucide-react';

export default function AuditLog() {
  const logs = [
    { id: 'AL-901', time: '10:14:22 AM', user: 'System (AI)', action: 'Delegation Executed', target: 'TSK-8492', status: 'Success' },
    { id: 'AL-900', time: '10:12:05 AM', user: 'System (PII Filter)', action: 'Data Redacted', target: 'Context Payload', status: 'Success' },
    { id: 'AL-899', time: '09:45:11 AM', user: 'Sarah J.', action: 'Policy Updated', target: 'Production Block', status: 'Success' },
    { id: 'AL-898', time: '09:30:00 AM', user: 'System (Auth)', action: 'OAuth Token Refresh', target: 'Jira Integration', status: 'Warning' },
    { id: 'AL-897', time: '08:15:44 AM', user: 'System (AI)', action: 'Delegation Blocked', target: 'TSK-8401', status: 'Error' },
  ];

  return (
    <div className="max-w-container-max mx-auto p-margin flex flex-col gap-xl">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-semibold text-on-surface">System Audit Log</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-sm max-w-2xl">Immutable record of all system, AI, and user actions for compliance and debugging.</p>
        </div>
        <button className="px-md py-sm rounded border border-outline-variant bg-transparent text-on-surface hover:bg-surface-variant transition-colors font-label-md text-label-md flex items-center gap-sm">
          <Download size={18} />
          Export CSV
        </button>
      </div>

      <div className="bg-surface-container rounded-lg border border-outline-variant p-sm flex items-center gap-md">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input 
            type="text" 
            placeholder="Search logs by ID, user, or action..." 
            className="w-full h-9 bg-surface-variant border border-transparent rounded focus:border-outline-variant focus:ring-0 text-body-sm text-on-surface pl-10 pr-3 placeholder-on-surface-variant outline-none" 
          />
        </div>
         <button className="px-md py-xs rounded bg-surface-variant text-on-surface font-label-md text-label-md flex items-center gap-xs hover:bg-outline-variant transition-colors">
          <Filter size={16} />
          Filters
        </button>
      </div>

      <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-variant/50 border-b border-outline-variant">
              <th className="p-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Timestamp</th>
              <th className="p-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Log ID</th>
              <th className="p-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Actor</th>
              <th className="p-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Action</th>
              <th className="p-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Target</th>
              <th className="p-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-outline-variant/30 hover:bg-surface-variant/30 transition-colors">
                <td className="p-md font-body-sm text-body-sm text-on-surface flex items-center gap-xs whitespace-nowrap">
                  <Clock size={14} className="text-on-surface-variant" /> {log.time}
                </td>
                <td className="p-md font-mono text-body-sm text-on-surface-variant">{log.id}</td>
                <td className="p-md font-body-sm text-body-sm text-on-surface">{log.user}</td>
                <td className="p-md font-body-sm text-body-sm text-on-surface">{log.action}</td>
                <td className="p-md font-body-sm text-body-sm text-on-surface-variant">{log.target}</td>
                <td className="p-md">
                  <span className={`px-2 py-1 rounded font-label-sm text-label-sm uppercase ${
                    log.status === 'Success' ? 'bg-tertiary/10 text-tertiary' :
                    log.status === 'Warning' ? 'bg-[#312e81] text-primary' :
                    'bg-error/20 text-error'
                  }`}>
                    {log.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

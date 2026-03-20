"use client";

interface AuditLog {
  id: string;
  timestamp: string;
  createdAt: string;
  action: string;
  actor: string;
  details: any;
  user?: {
    walletAddress: string;
    fullName?: string;
  };
}

export default function AuditLogTable({ logs }: { logs: AuditLog[] }) {
  const truncate = (str: string) => {
    if (str.length <= 12) return str;
    return `${str.slice(0, 6)}...${str.slice(-4)}`;
  };

  return (
    <div className="w-full overflow-x-auto border border-border rounded-lg bg-card">
      <table className="w-full text-left text-sm border-collapse">
        <thead className="bg-[#080c14] border-b border-border">
          <tr>
            <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">Timestamp</th>
            <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">Action</th>
            <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">Actor</th>
            <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-white/5 transition-colors">
              <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  log.action.includes('REJECT') || log.action.includes('FAIL')
                    ? 'bg-danger/10 text-danger border-danger/20'
                    : log.action.includes('SUCCESS') || log.action.includes('APPROVE')
                    ? 'bg-success/10 text-success border-success/20'
                    : 'bg-primary/10 text-primary border-primary/20'
                }`}>
                  {log.action}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-[11px]">
                {log.user?.walletAddress ? truncate(log.user.walletAddress) : truncate(log.actor)}
              </td>
              <td className="px-4 py-3">
                <div className="max-w-xs overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-gray-400" title={JSON.stringify(log.details)}>
                  {JSON.stringify(log.details)}
                </div>
              </td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-gray-500 italic">
                No logs found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

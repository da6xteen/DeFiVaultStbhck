export default function KycStatusBadge({ status }: { status: string | null }) {
  const getStatusConfig = (status: string | null) => {
    switch (status) {
      case "APPROVED":
        return { label: "APPROVED", className: "bg-success/20 text-success border-success/30" };
      case "PENDING":
        return { label: "PENDING", className: "bg-warning/20 text-warning border-warning/30" };
      case "REJECTED":
        return { label: "REJECTED", className: "bg-danger/20 text-danger border-danger/30" };
      case "NOT_SUBMITTED":
        return { label: "NOT STARTED", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" };
      default:
        return { label: "UNKNOWN", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold tracking-wider ${config.className}`}>
      {config.label}
    </span>
  );
}

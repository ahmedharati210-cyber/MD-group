import { Loader2 } from "lucide-react";

export default function PortalLoading() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
    </div>
  );
}

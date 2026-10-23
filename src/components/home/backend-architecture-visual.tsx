import { Card } from "@/components/ui/card";
import { MaterialIcon } from "@/components/ui/material-icon";
import { cn } from "@/lib/utils";

type ArchitectureLabels = {
  title: string;
  apiGateway: string;
  database: string;
  cache: string;
  cloud: string;
  services: string;
};

type ArchitectureNodeProps = {
  className?: string;
  icon: string;
  label: string;
};

function ArchitectureNode({ className, icon, label }: ArchitectureNodeProps) {
  return (
    <Card
      className={cn(
        "absolute flex h-24 w-28 flex-col items-center justify-center gap-2 rounded-md bg-card/95 text-center shadow-[var(--shadow-soft)]",
        className
      )}
    >
      <MaterialIcon className="text-2xl text-primary" name={icon} />
      <span className="font-mono text-xs text-card-foreground">{label}</span>
    </Card>
  );
}

export function BackendArchitectureVisual({ labels }: { labels: ArchitectureLabels }) {
  return (
    <div className="relative hidden min-h-[430px] lg:block" aria-label={labels.title}>
      <div className="absolute left-1/2 top-1/2 h-px w-[72%] -translate-x-1/2 bg-border" />
      <div className="absolute left-1/2 top-[24%] h-[52%] w-px -translate-x-1/2 bg-border" />
      <div className="absolute left-[18%] top-[31%] h-px w-[64%] bg-border" />
      <div className="absolute left-1/2 top-1/2 flex size-56 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-center shadow-[var(--shadow-soft)]">
        <MaterialIcon className="text-4xl text-primary" name="api" />
        <span className="mt-3 font-mono text-sm font-semibold text-foreground">
          {labels.apiGateway}
        </span>
        <span className="mt-1 text-xs text-muted-foreground">{labels.title}</span>
      </div>
      <ArchitectureNode
        className="left-1/2 top-0 -translate-x-1/2"
        icon="cloud"
        label={labels.cloud}
      />
      <ArchitectureNode
        className="bottom-0 left-1/2 -translate-x-1/2"
        icon="database"
        label={labels.database}
      />
      <ArchitectureNode
        className="left-0 top-1/2 -translate-y-1/2"
        icon="dns"
        label={labels.services}
      />
      <ArchitectureNode
        className="right-0 top-1/2 -translate-y-1/2"
        icon="cached"
        label={labels.cache}
      />
    </div>
  );
}

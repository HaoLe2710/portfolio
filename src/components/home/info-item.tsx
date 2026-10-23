import { Card } from "@/components/ui/card";
import { MaterialIcon } from "@/components/ui/material-icon";

export type InfoItemProps = {
  icon: string;
  label: string;
  value: string;
};

export function InfoItem({ icon, label, value }: InfoItemProps) {
  return (
    <Card className="flex gap-4 rounded-md p-5">
      <MaterialIcon className="mt-1 text-2xl text-primary" name={icon} />
      <div>
        <p className="font-mono text-xs uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-medium leading-6 text-card-foreground">
          {value}
        </p>
      </div>
    </Card>
  );
}

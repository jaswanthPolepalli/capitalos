import { CircleDashed } from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import type { NavigationItem } from "../navigation/navigation";

interface ModulePageProps {
  item: NavigationItem;
}

export function ModulePage({ item }: ModulePageProps) {
  const Icon = item.icon;

  return (
    <div className="module-page">
      <PageHeader description={item.description} title={item.label} />
      <section className="module-workspace" aria-label={`${item.label} workspace`}>
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">
            <Icon size={25} />
          </span>
          <h2>No records yet</h2>
          <p>This workspace has no {item.label.toLowerCase()} records.</p>
          <span className="status-chip status-chip--neutral">
            <CircleDashed size={14} aria-hidden="true" />
            Empty
          </span>
        </div>
      </section>
    </div>
  );
}
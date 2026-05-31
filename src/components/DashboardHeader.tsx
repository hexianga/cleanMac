import { Grid } from "@mantine/core";
import type { DiskOverview } from "../lib/types";
import { DiskUsageCard } from "./DiskUsageCard";
import { PrivacyBadgeCard } from "./PrivacyBadgeCard";

interface DashboardHeaderProps {
  disk: DiskOverview;
}

export function DashboardHeader({ disk }: DashboardHeaderProps) {
  return (
    <Grid gutter="md" align="stretch">
      <Grid.Col span={{ base: 12, md: 8 }}>
        <DiskUsageCard disk={disk} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 4 }}>
        <PrivacyBadgeCard />
      </Grid.Col>
    </Grid>
  );
}

import { moduleRoutes } from "../../modules/registry";

export const breadcrumbMap: Record<string, string[]> = Object.fromEntries(
  moduleRoutes.map((route) => [route.label, ["IPD Billing", route.label]]),
);

export const topNavQuickLinks = moduleRoutes.map((route) => ({
  label: route.label,
  page: route.label,
}));

export const notificationItems: Array<{
  id: string;
  title: string;
  subtitle: string;
  page: string;
}> = [];

export const quickAddSections: Array<{
  title: string;
  items: Array<{ label: string; action: string; page: string; enabled: boolean; note?: string }>;
}> = [
  {
    title: "Billing",
    items: [
      { label: "Register patient", action: "patients", page: "Patients", enabled: true },
      { label: "New admission", action: "admission", page: "IPD Admission", enabled: true },
      { label: "Collect advance", action: "advance", page: "Advances", enabled: true },
      { label: "Final bill", action: "final-bill", page: "Final Bill", enabled: true },
    ],
  },
];

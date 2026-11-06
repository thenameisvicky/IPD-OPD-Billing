import type { ReactElement } from "react";
import DashboardPage from "../pages/Dashboard";
import PatientRegistrationPage from "../pages/PatientRegistration";
import IpdAdmissionPage from "../pages/IpdAdmission";
import AdvancePaymentPage from "../pages/AdvancePayment";
import DischargeBillPage from "../pages/DischargeBill";
import PaymentCollectionPage from "../pages/PaymentCollection";
import RefundsPage from "../pages/Refunds";
import DailyCollectionPage from "../pages/DailyCollection";
import ServiceCataloguePage from "../pages/ServiceCatalogue";
import HospitalSettingsPage from "../pages/HospitalSettings";
import InvoicePrintPage from "../pages/InvoicePrint";

export type ModuleId = "healthcare";

export interface ModuleRoute {
  id: string;
  label: string;
  module: ModuleId;
  component: () => ReactElement;
}

export const moduleRoutes: ModuleRoute[] = [
  { id: "IPD Dashboard", label: "IPD Dashboard", module: "healthcare", component: DashboardPage },
  { id: "Patients", label: "Patients", module: "healthcare", component: PatientRegistrationPage },
  { id: "IPD Admission", label: "IPD Admission", module: "healthcare", component: IpdAdmissionPage },
  { id: "Advances", label: "Advances", module: "healthcare", component: AdvancePaymentPage },
  { id: "Final Bill", label: "Final Bill", module: "healthcare", component: DischargeBillPage },
  { id: "Payments", label: "Payments", module: "healthcare", component: PaymentCollectionPage },
  { id: "Refunds", label: "Refunds", module: "healthcare", component: RefundsPage },
  { id: "Catalogue", label: "Catalogue", module: "healthcare", component: ServiceCataloguePage },
  { id: "Hospital", label: "Hospital", module: "healthcare", component: HospitalSettingsPage },
  { id: "Print Invoice", label: "Print Invoice", module: "healthcare", component: InvoicePrintPage },
  { id: "Daily Collection", label: "Daily Collection", module: "healthcare", component: DailyCollectionPage },
];

export const routeLabels = moduleRoutes.map((route) => route.label);

export function getModuleRoute(label: string) {
  return moduleRoutes.find((route) => route.label === label) ?? moduleRoutes[0];
}

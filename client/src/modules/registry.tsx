import type { ReactElement } from "react";
import DashboardPage from "../pages/Dashboard";
import PatientRegistrationPage from "../pages/PatientRegistration";
import IpdAdmissionPage from "../pages/IpdAdmission";
import AdvancePaymentPage from "../pages/AdvancePayment";
import DischargeBillPage from "../pages/DischargeBill";
import PaymentCollectionPage from "../pages/PaymentCollection";
import RefundsPage from "../pages/Refunds";
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
  { id: "Home", label: "Home", module: "healthcare", component: DashboardPage },
  { id: "Patients", label: "Patients", module: "healthcare", component: PatientRegistrationPage },
  { id: "Admissions", label: "Admissions", module: "healthcare", component: IpdAdmissionPage },
  { id: "Advances", label: "Advances", module: "healthcare", component: AdvancePaymentPage },
  { id: "Final Bill", label: "Final Bill", module: "healthcare", component: DischargeBillPage },
  { id: "Payments", label: "Payments", module: "healthcare", component: PaymentCollectionPage },
  { id: "Refunds", label: "Refunds", module: "healthcare", component: RefundsPage },
  { id: "Services", label: "Services", module: "healthcare", component: ServiceCataloguePage },
  { id: "Invoices", label: "Invoices", module: "healthcare", component: InvoicePrintPage },
  { id: "Settings", label: "Settings", module: "healthcare", component: HospitalSettingsPage },
];

export const routeLabels = moduleRoutes.map((route) => route.label);

export function getModuleRoute(label: string) {
  return moduleRoutes.find((route) => route.label === label) ?? moduleRoutes[0];
}

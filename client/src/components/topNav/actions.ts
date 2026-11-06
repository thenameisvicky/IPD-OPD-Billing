export type TopNavAction =
  | "create-customer"
  | "create-product"
  | "create-invoice"
  | "add-stock"
  | "adjust-stock"
  | "view-low-stock"
  | "prepare-gstr1";

export const TOP_NAV_ACTION_EVENT = "wai:top-nav-action";

export function emitTopNavAction(action: TopNavAction) {
  window.dispatchEvent(
    new CustomEvent<TopNavAction>(TOP_NAV_ACTION_EVENT, { detail: action }),
  );
}

export function subscribeToTopNavAction(
  handler: (action: TopNavAction) => void,
) {
  const listener = (event: Event) => {
    handler((event as CustomEvent<TopNavAction>).detail);
  };

  window.addEventListener(TOP_NAV_ACTION_EVENT, listener);
  return () => window.removeEventListener(TOP_NAV_ACTION_EVENT, listener);
}

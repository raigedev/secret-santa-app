export const INVALID_INVITE_TOKEN = "playwright-invalid-invite-token";
export const TEST_GROUP_ID = "11111111-1111-1111-1111-111111111111";
export const TEST_ITEM_ID = "22222222-2222-2222-2222-222222222222";
export const UNKNOWN_ROUTE_PATH = "/playwright-route-that-should-not-exist";

export const PROTECTED_PAGE_PATHS = [
  "/dashboard",
  "/dashboard/affiliate-report",
  "/create-group",
  `/group/${TEST_GROUP_ID}`,
  `/group/${TEST_GROUP_ID}/reveal`,
  "/history",
  "/notifications",
  "/profile",
  "/secret-santa",
  "/secret-santa-chat",
  "/settings",
  "/wishlist",
];

export const PUBLIC_PAGE_PATHS = [
  "/",
  "/cool-app",
  "/login",
  "/create-account",
  "/forgot-password",
  "/privacy",
  "/reset-password",
  `/invite/${INVALID_INVITE_TOKEN}`,
];

function isDeployedAppRuntime(): boolean {
  return (
    process.env.VERCEL === "1" ||
    Boolean(process.env.VERCEL_ENV?.trim()) ||
    Boolean(process.env.VERCEL_URL?.trim())
  );
}

export function isLocalCronBypassAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && !isDeployedAppRuntime();
}

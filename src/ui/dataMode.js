export function resolveDataMode(requestedMode = "live", mockDataEnabled = false) {
  if (!mockDataEnabled) return "live";
  if (requestedMode === "mock" || requestedMode === "empty") return requestedMode;
  return "live";
}

export function resolveLocalData({
  dataMode = "live",
  mockData,
  emptyData = [],
}) {
  return dataMode === "mock" ? mockData : emptyData;
}

export function shouldUseRealData(organizationId, dataMode = "live") {
  return Boolean(organizationId) && dataMode !== "empty";
}

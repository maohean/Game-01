export const SERVER_WS_URL =
  import.meta.env.VITE_SERVER_WS_URL || "ws://localhost:2567";

export const NETWORK_SIM_CONFIG = {
  ENABLED_ON_BOOT: false,
  MIN_RTT_MS: 100,
  MAX_RTT_MS: 200,
  PACKET_LOSS_RATE: 0.05,
};

export { MaestroSidecar } from './src/sidecar.js';
export { findFreePort } from './src/port-finder.js';
export { waitForHealth } from './src/health-checker.js';
export { detectMaestroRoot, getServicePaths, getBundledPaths, hasBundledBinaries, getPlatformRid } from './src/config.js';
export type { SidecarOptions, SidecarStatus, ServiceInfo } from './src/types.js';

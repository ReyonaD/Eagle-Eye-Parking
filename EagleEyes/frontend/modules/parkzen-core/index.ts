// Reexport the native module. On web, it will be resolved to parkzen-coreModule.web.ts
// and on native platforms to parkzen-coreModule.ts
export { default } from './src/parkzen-coreModule';
export { default as parkzen-coreView } from './src/parkzen-coreView';
export * from  './src/parkzen-core.types';

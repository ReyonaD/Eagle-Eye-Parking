import { requireNativeModule } from 'expo-modules-core';

// This reaches across the bridge and grabs the Swift code!
export default requireNativeModule('ParkzenCore');
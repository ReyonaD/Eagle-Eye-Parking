const { withAndroidManifest, withAndroidColors } = require('@expo/config-plugins');

// 1. Automatically fixes the ParkZen Manifest Merger error
const withAllowBackupFix = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    const app = androidManifest.application[0];
    
    // Inject the tools namespace and the override command
    androidManifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    app.$['tools:replace'] = 'android:allowBackup';
    
    return config;
  });
};

// 2. Automatically injects the missing colors for ParkZen
const withParkZenColors = (config) => {
  return withAndroidColors(config, async (config) => {
    config.modResults = config.modResults || { resources: { color: [] } };
    
    const colorsToAdd = [
      { $: { name: 'white' }, _: '#FFFFFF' },
      { $: { name: 'black' }, _: '#000000' },
      { $: { name: 'primary' }, _: '#00853E' },
      { $: { name: 'colorPrimary' }, _: '#00853E' }
    ];

    // Add them if they don't already exist
    colorsToAdd.forEach(newColor => {
      const exists = config.modResults.resources.color.find(c => c.$.name === newColor.$.name);
      if (!exists) config.modResults.resources.color.push(newColor);
    });

    return config;
  });
};

module.exports = ({ config }) => {
  // Apply our custom plugins to the Expo config
  config = withAllowBackupFix(config);
  config = withParkZenColors(config);
  return config;
};
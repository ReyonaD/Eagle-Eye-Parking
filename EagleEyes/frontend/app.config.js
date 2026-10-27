const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withAndroidColors, withProjectBuildGradle, withGradleProperties, withStringsXml, withPodfile, withInfoPlist } = require('@expo/config-plugins');

// 1. Automatically fixes the ParkZen Manifest Merger error
const withAllowBackupFix = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    const app = androidManifest.application[0];
    
    // Inject the tools namespace and the override command
    androidManifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    app.$['tools:replace'] = 'android:allowBackup';

    // The ParkZen SDK ships its own Maps key; make ours win the merge
    const mapsKey = (app['meta-data'] || []).find(
      (m) => m.$['android:name'] === 'com.google.android.geo.API_KEY'
    );
    if (mapsKey) mapsKey.$['tools:replace'] = 'android:value';

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

// 3. ParkZenCore 1.0.4 comes from ParkZen's GitHub Packages Maven repo (see
// the Android SDK guide). Downloading it needs a GitHub classic token with only
// read:packages, which stays on each developer's machine: set
// parkzenGithubUser / parkzenGithubToken in ~/.gradle/gradle.properties, or the
// PARKZEN_GITHUB_USER / PARKZEN_GITHUB_TOKEN environment variables.
const PARKZEN_MAVEN_REPO = `
    // ParkZenCore Maven package (parkzen-core-dist)
    maven {
      name = "parkzen-core-dist"
      url = uri("https://maven.pkg.github.com/ParkZenApp/parkzen-core-dist")
      credentials {
        username = findProperty("parkzenGithubUser") ?: System.getenv("PARKZEN_GITHUB_USER")
        password = findProperty("parkzenGithubToken") ?: System.getenv("PARKZEN_GITHUB_TOKEN")
      }
      // only ask GitHub for ParkZen's own artifacts, never every dependency
      content { includeGroup("com.parkzenlib") }
    }`;

const withParkZenMaven = (config) => {
  config = withProjectBuildGradle(config, (config) => {
    const gradle = config.modResults;
    if (gradle.contents.includes('parkzen-core-dist')) return config;
    const allprojectsRepos = /allprojects\s*\{\s*repositories\s*\{/;
    if (!allprojectsRepos.test(gradle.contents)) {
      throw new Error('ParkZen: could not find allprojects { repositories { ... } } in android/build.gradle');
    }
    gradle.contents = gradle.contents.replace(allprojectsRepos, (match) => match + PARKZEN_MAVEN_REPO);
    return config;
  });
  return withGradleProperties(config, (config) => {
    const properties = {
      // ParkZenCore still uses support libraries that have to be migrated to AndroidX
      'android.enableJetifier': 'true',
      // React Native's own libraries are already AndroidX; rewriting them is slow
      // and is what ran the build out of memory
      'android.jetifier.ignorelist': 'react-android,hermes-android,fbjni',
      // Jetifier needs more than the template's 2 GB heap
      'org.gradle.jvmargs': '-Xmx4096m -XX:MaxMetaspaceSize=1024m',
    };
    config.modResults = config.modResults.filter(
      (item) => !(item.type === 'property' && item.key in properties)
    );
    for (const [key, value] of Object.entries(properties)) {
      config.modResults.push({ type: 'property', key, value });
    }
    return config;
  });
};

// 4. ParkZen credentials for Android, from frontend/.env: the ParkZen login
// (PARKZEN_USERNAME / PARKZEN_PASSWORD, the same one iOS uses), the client ID
// (PARKZEN_CLIENT_ID) and PARKZEN_ANDROID_API_KEY, which configure() still
// takes but 1.0.4 doesn't use. They're built in as string resources so the
// native module can configure ParkZenCore in Application.onCreate, before any
// JS runs, which is what keeps parking detection alive after Android restarts
// the app in the background. (Not manifest meta-data: Android turns an
// all-digit value there into a number.)
const PARKZEN_STRINGS = {
  parkzen_api_key: process.env.PARKZEN_ANDROID_API_KEY,
  parkzen_client_id: process.env.PARKZEN_CLIENT_ID,
  parkzen_username: process.env.PARKZEN_USERNAME,
  parkzen_password: process.env.PARKZEN_PASSWORD,
};

const withParkZenCredentials = (config) => {
  return withStringsXml(config, (config) => {
    const strings = (config.modResults.resources.string || []).filter((s) => !(s.$.name in PARKZEN_STRINGS));
    for (const [name, value] of Object.entries(PARKZEN_STRINGS)) {
      if (value) strings.push({ $: { name, translatable: 'false' }, _: value });
    }
    config.modResults.resources.string = strings;
    return config;
  });
};

// 5. ParkZenCoreV2 for iOS comes from ParkZen's CocoaPod (see the iOS SDK
// guide). modules/parkzen-core depends on it, but a podspec can't say where a
// git-hosted pod lives, so the Podfile has to.
const PARKZEN_IOS_POD =
  "  pod 'ParkZenCore-Dist/Parking', :git => 'https://github.com/ParkZenApp/ParkZenCore-Dist.git', :tag => '0.0.24'";

const withParkZenPod = (config) => {
  return withPodfile(config, (config) => {
    const podfile = config.modResults;
    if (podfile.contents.includes('ParkZenCore-Dist')) return config;
    if (!podfile.contents.includes('use_expo_modules!')) {
      throw new Error('ParkZen: could not find use_expo_modules! in ios/Podfile');
    }
    podfile.contents = podfile.contents.replace('use_expo_modules!', (match) => `${match}\n${PARKZEN_IOS_POD}`);
    return config;
  });
};

// 6. The same ParkZen login and client ID for iOS, from frontend/.env
// (PARKZEN_USERNAME / PARKZEN_PASSWORD / PARKZEN_CLIENT_ID). Built into
// Info.plist so the app delegate can call ParkZenV2.configure at launch,
// before any JS runs.
const PARKZEN_INFO_PLIST = {
  ParkZenUsername: process.env.PARKZEN_USERNAME,
  ParkZenPassword: process.env.PARKZEN_PASSWORD,
  ParkZenClientId: process.env.PARKZEN_CLIENT_ID,
};

const withParkZenIosCredentials = (config) => {
  return withInfoPlist(config, (config) => {
    for (const [key, value] of Object.entries(PARKZEN_INFO_PLIST)) {
      if (value) config.modResults[key] = value;
      else delete config.modResults[key];
    }
    return config;
  });
};

module.exports = ({ config }) => {
  // Android push tokens need Firebase (FCM). Only point at google-services.json
  // when it's been added, so builds keep working without it.
  // eslint-disable-next-line no-undef -- this file runs in Node, not the app
  if (fs.existsSync(path.join(__dirname, 'google-services.json'))) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  }
  // Apply our custom plugins to the Expo config
  config = withAllowBackupFix(config);
  config = withParkZenColors(config);
  config = withParkZenMaven(config);
  config = withParkZenCredentials(config);
  config = withParkZenPod(config);
  config = withParkZenIosCredentials(config);
  return config;
};
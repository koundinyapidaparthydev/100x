const iosDevice = process.env.DETOX_IOS_DEVICE || 'iPhone 16 Pro';

/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 300000,
    },
  },
  artifacts: {
    rootDir: 'artifacts',
    plugins: {
      log: 'failing',
      screenshot: {
        shouldTakeAutomaticSnapshots: true,
        keepOnlyFailedTestsArtifacts: true,
      },
      video: 'failing',
    },
  },
  apps: {
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/AplifyAI.app',
      build:
        'export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 ' +
        'EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:4000/api/v1 && ' +
        'npx expo prebuild --platform ios --clean && ' +
        'xcodebuild -workspace ios/AplifyAI.xcworkspace -scheme AplifyAI ' +
        '-configuration Release -sdk iphonesimulator -derivedDataPath ios/build ' +
        'CODE_SIGNING_ALLOWED=NO',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: iosDevice,
      },
    },
  },
  configurations: {
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
  },
};

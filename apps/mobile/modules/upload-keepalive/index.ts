import { requireOptionalNativeModule } from 'expo-modules-core';

type Native = { start(): void; stop(): void };

const native = requireOptionalNativeModule<Native>('UploadKeepAlive');

/**
 * While photos are waiting to upload, asks the phone to keep the app running with its screen off:
 * a small "Uploading" notification on Android, extra background time on iPhone.
 */
export function setUploadKeepAlive(on: boolean) {
  if (on) native?.start();
  else native?.stop();
}

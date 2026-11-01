/**
 * LG webOS SSAP URIs and payload helpers.
 */

export const LG_SSAP_URIS = {
  // Volume & Audio
  VOLUME_UP: 'ssap://audio/volumeUp',
  VOLUME_DOWN: 'ssap://audio/volumeDown',
  SET_MUTE: 'ssap://audio/setMute',
  GET_VOLUME: 'ssap://audio/getVolume',
  GET_AUDIO_STATUS: 'ssap://audio/getStatus',

  // App Management
  LIST_APPS: 'ssap://com.webos.applicationManager/listApps',
  LIST_LAUNCH_POINTS: 'ssap://com.webos.applicationManager/listLaunchPoints',
  LAUNCH_APP: 'ssap://system.launcher/launch',
  OPEN_URL: 'ssap://system.launcher/open',
  CLOSE_APP: 'ssap://system.launcher/close',
  GET_APP_STATE: 'ssap://com.webos.applicationManager/getAppState',
  GET_FOREGROUND_APP: 'ssap://com.webos.applicationManager/getForegroundAppInfo',

  // Pointer / Network Input
  GET_POINTER_INPUT_SOCKET: 'ssap://com.webos.service.networkinput/getPointerInputSocket',

  // Pairing & Authentication
  SET_PIN: 'ssap://pairing/setPin',
  SET_PIN_ALT: 'ssap://com.webos.service.networkinput/setPin',

  // Text Input (IME)
  INSERT_TEXT: 'ssap://com.webos.service.ime/insertText',
  SEND_ENTER_KEY: 'ssap://com.webos.service.ime/sendEnterKey',
  DELETE_CHARACTERS: 'ssap://com.webos.service.ime/deleteCharacters',

  // Media Controls
  MEDIA_PLAY: 'ssap://media.controls/play',
  MEDIA_PAUSE: 'ssap://media.controls/pause',
  MEDIA_STOP: 'ssap://media.controls/stop',
  MEDIA_REWIND: 'ssap://media.controls/rewind',
  MEDIA_FAST_FORWARD: 'ssap://media.controls/fastForward',

  // System
  SYSTEM_INFO: 'ssap://com.webos.service.update/getCurrentSWInformation',
  TURN_OFF: 'ssap://system/turnOff',
} as const;

/**
 * Standard manifest requesting permissions required for TV remote operations.
 */
export const LG_PERMISSIONS_MANIFEST = {
  manifestVersion: 1,
  appVersion: '1.0.0',
  signed: {
    created: '20261101',
    appId: 'com.antigravity.lgremote',
    vendorId: 'antigravity',
    localizedAppNames: {
      '': 'LG Smart Remote',
    },
    localizedVendorNames: {
      '': 'Antigravity',
    },
    permissions: [
      'LAUNCH',
      'LAUNCH_WEBAPP',
      'APP_TO_APP',
      'CONTROL_AUDIO',
      'CONTROL_DISPLAY',
      'CONTROL_INPUT_JOYSTICK',
      'CONTROL_INPUT_MEDIA_PLAYBACK',
      'CONTROL_INPUT_MEDIA_RECORDING',
      'CONTROL_INPUT_TEXT',
      'CONTROL_MOUSE_AND_KEYBOARD',
      'READ_APP_STATE',
      'READ_CURRENT_CHANNEL',
      'READ_INPUT_DEVICE_LIST',
      'READ_NETWORK_STATE',
      'READ_RUNNING_APPS',
      'READ_TV_CHANNEL_LIST',
      'WRITE_NOTIFICATION_ALERT',
    ],
    serial: 'antigravity-lgremote-001',
  },
  permissions: [
    'LAUNCH',
    'CONTROL_AUDIO',
    'CONTROL_INPUT_TEXT',
    'CONTROL_MOUSE_AND_KEYBOARD',
    'READ_RUNNING_APPS',
  ],
};


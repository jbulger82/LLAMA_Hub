import { type Settings } from './settings';
import * as systemService from './systemService';

type VoiceCommand = 'piper-on' | 'piper-off' | 'whisper-on' | 'whisper-off';

async function runVoiceCommand(command: VoiceCommand, settings: Settings, recoveryMode: boolean): Promise<string> {
  const { stdout, stderr } = await systemService.executeCommand(command, [], recoveryMode, settings.proxyUrl);
  if (stderr && stderr.trim()) {
    throw new Error(stderr.trim());
  }
  return stdout?.trim() || 'Command executed successfully.';
}

export function startPiper(settings: Settings, recoveryMode: boolean) {
  return runVoiceCommand('piper-on', settings, recoveryMode);
}

export function stopPiper(settings: Settings, recoveryMode: boolean) {
  return runVoiceCommand('piper-off', settings, recoveryMode);
}

export function startWhisper(settings: Settings, recoveryMode: boolean) {
  return runVoiceCommand('whisper-on', settings, recoveryMode);
}

export function stopWhisper(settings: Settings, recoveryMode: boolean) {
  return runVoiceCommand('whisper-off', settings, recoveryMode);
}

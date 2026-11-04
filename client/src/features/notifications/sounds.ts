import type { AdhanSound } from '@/api/types';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export const SOUND_LABEL: Record<AdhanSound, string> = {
  mekke: 'Ezan · Mekke',
  medine: 'Ezan · Medine',
  istanbul: 'Ezan · İstanbul',
  kisa: 'Kısa ezan',
  cansesi: 'Hafif çan',
  sessiz: 'Sessiz',
};

export const SOUND_SUB: Record<AdhanSound, string> = {
  mekke: 'Tam ezan',
  medine: 'Tam ezan',
  istanbul: 'Tam ezan',
  kisa: 'Yalnızca ilk tekbir',
  cansesi: 'Kısa, yumuşak ton',
  sessiz: 'Yalnızca bildirim',
};

export const SOUNDS = Object.keys(SOUND_LABEL) as AdhanSound[];


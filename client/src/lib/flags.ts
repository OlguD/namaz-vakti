import { create } from 'zustand';
import { KEYS, kv } from './storage';

/** Device-local app flags, hydrated before the first screen renders. */
interface Flags {
  onboarded: boolean;
  chatRulesAccepted: boolean;
}

export const useFlags = create<Flags>(() => ({ onboarded: false, chatRulesAccepted: false }));

export async function hydrateFlags(): Promise<void> {
  const [onboarded, chatRulesAccepted] = await Promise.all([
    kv.get<boolean>(KEYS.onboarded),
    kv.get<boolean>(KEYS.chatRulesAccepted),
  ]);
  useFlags.setState({ onboarded: !!onboarded, chatRulesAccepted: !!chatRulesAccepted });
}

export async function setFlag<K extends keyof Flags>(key: K, value: Flags[K]): Promise<void> {
  useFlags.setState({ [key]: value } as Pick<Flags, K>);
  await kv.set(key === 'onboarded' ? KEYS.onboarded : KEYS.chatRulesAccepted, value);
}

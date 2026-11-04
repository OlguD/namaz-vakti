import { Link } from 'expo-router';
import { View } from 'react-native';
import type { Dua, DuasResponse } from './api';
import { useTheme } from '@/theme/theme';
import { Touch, Txt } from '@/ui';

/** List card for a dua (category · source, title, Arabic, meaning). */
export function DuaCard({ dua, data }: { dua: Dua; data: DuasResponse }) {
  const { c } = useTheme();
  const cat = data.categories.find((k) => k.id === dua.categoryId)?.nameTr ?? '';
  return (
    <Link href={{ pathname: '/dualar/[key]', params: { key: dua.key } }} asChild>
      <Touch accessibilityRole="link" accessibilityLabel={`${dua.title}. ${cat}`} style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 6, borderRadius: 20, backgroundColor: c.raised, borderWidth: 1, borderColor: c.hair }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Txt v="small" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {cat}
          </Txt>
          {dua.source ? (
            <Txt v="small" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {dua.source}
            </Txt>
          ) : null}
        </View>
        <Txt v="callout">{dua.title}</Txt>
        {dua.arabic ? (
          <Txt v="arabicSm" lang="ar" numberOfLines={2}>
            {dua.arabic}
          </Txt>
        ) : null}
        <Txt v="sub" tone="sub" numberOfLines={2}>
          {dua.meaningTr}
        </Txt>
      </Touch>
    </Link>
  );
}

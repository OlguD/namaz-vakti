import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/, 'lower-case slug');

export const duaCategorySchema = z.object({
  id: slug,
  nameTr: z.string().min(1).max(60),
  nameEn: z.string().max(60).optional(),
  nameAr: z.string().max(60).optional(),
  icon: z.string().max(40).optional(),
  sortOrder: z.number().int().default(0),
});

export const duaSchema = z.object({
  key: slug,
  categoryId: slug,
  title: z.string().min(1).max(120),
  arabic: z.string().min(1).max(5000),
  transliteration: z.string().max(5000).optional(),
  meaningTr: z.string().min(1).max(5000),
  meaningEn: z.string().max(5000).optional(),
  source: z.string().max(200).optional(),
  sortOrder: z.number().int().default(0),
  published: z.boolean().default(true),
});

export const esmaSchema = z.object({
  no: z.number().int().min(1).max(99),
  arabic: z.string().min(1).max(100),
  transliteration: z.string().min(1).max(100),
  meaningTr: z.string().max(500).optional(),
  meaningEn: z.string().max(500).optional(),
});

export const religiousDaySchema = z.object({
  date: isoDate,
  key: slug,
  hijriYear: z.number().int().min(1400).max(1700),
  nameTr: z.string().min(1).max(80),
  nameEn: z.string().max(80).optional(),
  hijri: z.string().max(60).optional(),
  note: z.string().max(200).optional(),
});

export const duasFileSchema = z.object({
  categories: z.array(duaCategorySchema),
  duas: z.array(duaSchema),
});
export const esmaFileSchema = z.object({ names: z.array(esmaSchema).length(99) });
export const religiousDaysFileSchema = z.object({ days: z.array(religiousDaySchema) });

export type DuaInput = z.infer<typeof duaSchema>;
export type DuaCategoryInput = z.infer<typeof duaCategorySchema>;
export type EsmaInput = z.infer<typeof esmaSchema>;
export type ReligiousDayInput = z.infer<typeof religiousDaySchema>;

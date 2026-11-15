import { Schema } from 'firebase/ai';
import type { ExtraLanguage } from './languages';

export function makeNoticeSchema(language?: ExtraLanguage) { return Schema.object({
  properties: {
    summary: Schema.string(),
    actions: Schema.array({ items: Schema.string() }),
    place: Schema.string(),
    time: Schema.string(),
    easyJapanese: Schema.string(),
    english: Schema.string(),
    ...(language ? { translation: Schema.string() } : {}),
  },
}); }

export const noticeSchema = makeNoticeSchema();

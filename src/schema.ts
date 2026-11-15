import { Schema } from 'firebase/ai';

export const noticeSchema = Schema.object({
  properties: {
    summary: Schema.string(),
    actions: Schema.array({ items: Schema.string() }),
    place: Schema.string(),
    time: Schema.string(),
    easyJapanese: Schema.string(),
    english: Schema.string(),
  },
});

// One revision-pinned multilingual voice serves both Japanese and English.
export const voiceModelUrl = 'https://huggingface.co/ayousanz/piper-plus-tsukuyomi-chan/resolve/619ad26fcbd5635b3d70a27eac919f4c2ce892b1/tsukuyomi-chan-6lang-fp16.onnx';
export const voiceConfigUrl = new URL('config.json', voiceModelUrl).href;

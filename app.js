/*
 * Өгүүлэгч: Mongolian text-to-speech with Puter.js + ElevenLabs.
 *
 * Sections:
 *   1. Config            6. Errors             11. Download
 *   2. i18n              7. Auth               12. UI rendering
 *   3. DOM helpers       8. Voices & engines   13. Generation controller
 *   4. Storage           9. Chunker            14. Event wiring & init
 *   5. History          10. TTS + audio
 *
 * API reference: https://docs.puter.com/AI/txt2speech/
 * `puter.ai.txt2speech(text, options)` resolves to an HTMLAudioElement whose
 * `src` is a data URI. Inputs over 3,000 characters fail with `input_too_large`.
 *
 * Transcript translation lives in translate.js.
 */

import { TRANSLATE_STRINGS, createTranslator } from './translate.js';

// ==========================================================================
// 1. Config
// ==========================================================================

const CONFIG = {
  provider: 'elevenlabs',
  // Puter.js rejects longer input client-side (MAX_INPUT_SIZE in puter-js tts.js).
  maxCharsPerRequest: 3000,
  // Upper bound for a single job, to keep cost and browser memory predictable.
  maxTotalChars: 50000,
  maxImportBytes: 2 * 1024 * 1024,
  historyLimit: 12,
  historyTextLimit: 20000,
  voiceSearchThreshold: 20,
  defaultModel: 'eleven_v3',
  defaultFormat: 'mp3_44100_128',
  defaultVoiceId: '21m00Tcm4TlvDq8ikWAM',
  defaultSettings: { stability: 0.5, similarity: 0.75, style: 0, speed: 1 },
  // `?test` in the URL uses Puter's test mode: sample audio, no usage charged.
  testMode: new URLSearchParams(location.search).has('test'),

  // ElevenLabs models that list Mongolian (mn) and are accepted by Puter.
  // Older models (multilingual_v2, flash_v2_5) do not support Mongolian.
  models: [
    { id: 'eleven_v3', name: 'Eleven v3', stabilityPresets: [0, 0.5, 1] },
    { id: 'eleven_v4', name: 'Eleven v4' },
    { id: 'eleven_v4_turbo', name: 'Eleven v4 Turbo' },
  ],

  // `merge` names the strategy used to join chunk files; null means the
  // format can't be joined reliably in the browser, so parts are offered.
  formats: [
    { id: 'mp3_44100_128', label: 'MP3, 44.1 kHz, 128 kbps', ext: 'mp3', mime: 'audio/mpeg', merge: 'mp3', family: 'mp3' },
    { id: 'mp3_44100_192', label: 'MP3, 44.1 kHz, 192 kbps', ext: 'mp3', mime: 'audio/mpeg', merge: 'mp3', family: 'mp3' },
    { id: 'mp3_44100_96', label: 'MP3, 44.1 kHz, 96 kbps', ext: 'mp3', mime: 'audio/mpeg', merge: 'mp3', family: 'mp3' },
    { id: 'mp3_44100_64', label: 'MP3, 44.1 kHz, 64 kbps', ext: 'mp3', mime: 'audio/mpeg', merge: 'mp3', family: 'mp3' },
    { id: 'mp3_22050_32', label: 'MP3, 22 kHz, 32 kbps', ext: 'mp3', mime: 'audio/mpeg', merge: 'mp3', family: 'mp3' },
    { id: 'wav_44100', label: 'WAV, 44.1 kHz', ext: 'wav', mime: 'audio/wav', merge: 'wav', family: 'wav' },
    { id: 'wav_24000', label: 'WAV, 24 kHz', ext: 'wav', mime: 'audio/wav', merge: 'wav', family: 'wav' },
    { id: 'opus_48000_128', label: 'Opus, 48 kHz, 128 kbps', ext: 'opus', mime: 'audio/ogg', merge: null, family: 'opus' },
  ],

  // Used before sign-in and whenever listVoices() is unavailable.
  // Any ElevenLabs voice ID works; add or remove entries freely.
  fallbackVoices: [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'female', style: { mn: 'тайван', en: 'calm' } },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'female', style: { mn: 'зөөлөн', en: 'soft' } },
    { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', gender: 'female', style: { mn: 'сэргэг', en: 'upbeat' } },
    { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', gender: 'female', style: { mn: 'итгэлтэй', en: 'confident' } },
    { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', gender: 'female', style: { mn: 'найрсаг', en: 'friendly' } },
    { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', gender: 'female', style: { mn: 'дулаан', en: 'warm' } },
    { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', gender: 'female', style: { mn: 'илэрхий', en: 'expressive' } },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'male', style: { mn: 'бүдүүн', en: 'deep' } },
    { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', gender: 'male', style: { mn: 'өгүүлэмж', en: 'narration' } },
    { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', gender: 'male', style: { mn: 'дулаан', en: 'warm' } },
    { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', gender: 'male', style: { mn: 'мэдээний', en: 'newsreader' } },
    { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', gender: 'male', style: { mn: 'тод', en: 'articulate' } },
    { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric', gender: 'male', style: { mn: 'уян', en: 'smooth' } },
    { id: 'pqHfZKP75CyOlFTdXaVS', name: 'Bill', gender: 'male', style: { mn: 'нас тогтсон', en: 'mature' } },
    { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River', gender: 'neutral', style: { mn: 'тайван', en: 'relaxed' } },
  ],
};

const CUSTOM_VOICE = '__custom__';
const VOICE_ID_PATTERN = /^[A-Za-z0-9]{20}$/;
const LOG_PREFIX = '[Өгүүлэгч]';

// ==========================================================================
// 2. i18n
// ==========================================================================

const STRINGS = {
  mn: {
    skipToEditor: 'Текст рүү шилжих',
    tagline: 'Монгол текстээ ElevenLabs-ийн дуу хоолойгоор уншуулж, MP3 файлаар татаж аваарай.',
    langToggleHint: 'Интерфэйсийн хэлийг англи болгох',
    themeLabel: (mode) => `Өнгөний горим: ${mode}`,
    theme_system: 'системийн',
    theme_light: 'цайвар',
    theme_dark: 'бараан',
    signIn: 'Puter-ээр нэвтрэх',
    signOut: 'Гарах',
    textLabel: 'Текст',
    importTxt: '.txt оруулах',
    copy: 'Хуулах',
    clear: 'Цэвэрлэх',
    dropHere: '.txt файлаа энд тавина уу',
    chars: (n) => `${n} тэмдэгт`,
    charsOver: (n, max) => `${n} / ${max} тэмдэгт, хязгаараас хэтэрсэн`,
    fitsOne: 'Нэг хүсэлтээр үүснэ',
    splitInto: (n) => `${n} хэсэгт хувааж үүсгэнэ`,
    costEstimate: (s) => `Ойролцоогоор ${s}`,
    costTitle: 'Puter-ийн үнийн мэдээллээр тооцоолсон. Зардлыг таны Puter данснаас тооцно.',
    controlsTitle: 'Тохиргоо',
    authNoticeTitle: 'Эхлээд Puter-ээр нэвтэрнэ үү',
    authNoticeBody: 'Puter «хэрэглэгч төлөх» загвартай. ElevenLabs-ийн зардлыг таны Puter данснаас тооцдог тул энэ апп API түлхүүр шаардахгүй.',
    voice: 'Дуу хоолой',
    sample: 'Дээж сонсох',
    sampleBusy: 'Үүсгэж байна…',
    sampleText: 'Сайн байна уу? Энэ бол миний дуу хоолой. Таны текстийг би ингэж уншина.',
    voiceSearch: 'Дуу хоолой хайх',
    voicesPremade: 'ElevenLabs-ийн бэлэн дуу хоолой',
    voicesOther: 'Бусад дуу хоолой',
    voicesBuiltin: 'Үндсэн жагсаалт',
    customVoice: 'Өөр voice ID ашиглах…',
    customVoiceLabel: 'ElevenLabs voice ID',
    customVoiceHint: '20 тэмдэгттэй ID эсвэл дуу хоолойн яг нэрийг оруулна.',
    voiceSrcBuiltin: 'Нэвтэрсний дараа Puter-ээс бүрэн жагсаалтыг ачаална.',
    voiceSrcLoading: 'Puter-ээс дуу хоолойнуудыг ачаалж байна…',
    voiceSrcPuter: (n) => `Puter-ээс ${n} дуу хоолой ачааллаа.`,
    voiceSrcFallback: 'Puter-ээс жагсаалт авч чадсангүй, үндсэн жагсаалтыг харуулж байна.',
    gender_male: 'эрэгтэй',
    gender_female: 'эмэгтэй',
    gender_neutral: 'саармаг',
    model: 'Загвар',
    model_eleven_v3: 'Хамгийн уран илэрхийлэлтэй загвар. Монгол хэлийг дэмждэг.',
    model_eleven_v4: 'Шинэ үеийн, сэтгэл хөдлөлийг сайн илэрхийлдэг загвар. Монгол хэлийг дэмждэг.',
    model_eleven_v4_turbo: 'Eleven v4-ийн хурдан, хямд хувилбар. Монгол хэлийг дэмждэг.',
    modelUnavailable: 'Puter дээр одоогоор боломжгүй',
    format: 'Файлын формат',
    format_mp3: 'MP3 бүх төхөөрөмж дээр тоглогдоно. 128 kbps ихэнх хэрэглээнд хангалттай.',
    format_wav: 'Шахагдаагүй, өндөр чанартай. Файлын хэмжээ MP3-аас хэд дахин том.',
    format_opus: 'Жижиг хэмжээтэй. Урт текстийн хэсгүүдийг нэг файл болгох боломжгүй тул тус тусад нь татна.',
    voiceSettings: 'Дуу хоолойн тохиргоо',
    stability: 'Тогтвортой байдал',
    stabilityHint: 'Бага утга нь сэтгэл хөдлөлийг илүү олон янз болгоно. Их утга нь жигд, тайван уншуулна.',
    stabilityHintV3: 'Eleven v3 гурван түвшин дэмждэг. «Бүтээлч» нь сэтгэл хөдлөлтэй, «Тогтвортой» нь жигд уншина.',
    stabCreative: 'Бүтээлч',
    stabNatural: 'Байгалийн',
    stabRobust: 'Тогтвортой',
    similarity: 'Дуу хоолойтой төстэй байдал',
    similarityHint: 'Сонгосон дуу хоолойн өнгө аясыг хэр нарийн дагахыг тохируулна. Хэт өндөр утгад чимээ гарч болно.',
    style: 'Хэв маягийн тодрол',
    styleHint: 'Дуу хоолойн өвөрмөц хэв маягийг тодотгоно. 0 үед хамгийн тогтвортой, хурдан.',
    speed: 'Хурд',
    speedHint: '1.0 нь хэвийн хурд. Бага утга удаан, их утга хурдан уншина.',
    resetSettings: 'Анхны утгаар тохируулах',
    autoplay: 'Бэлэн болмогц автоматаар тоглуулах',
    generate: 'Яриа үүсгэх',
    signInAndGenerate: 'Нэвтэрч яриа үүсгэх',
    generating: 'Үүсгэж байна…',
    cancel: 'Зогсоох',
    cancelling: 'Одоогийн хэсэг дуусмагц зогсооно…',
    progressSingle: 'Яриа үүсгэж байна…',
    progressChunk: (i, n) => `${n} хэсгийн ${i}-р хэсгийг үүсгэж байна…`,
    merging: 'Хэсгүүдийг нэг файл болгож байна…',
    stopped: (d, n) => `Зогсоолоо. ${n} хэсгээс ${d} нь бэлэн.`,
    failedAt: (i, n) => `${i}-р хэсэг дээр алдаа гарлаа (нийт ${n}).`,
    resumeFrom: (i) => `${i}-р хэсгээс үргэлжлүүлэх`,
    useCompleted: 'Бэлэн хэсгүүдийг ашиглах',
    discard: 'Болих',
    resultTitle: 'Таны яриа бэлэн',
    download: (ext) => `${ext} татах`,
    replay: 'Эхнээс нь тоглуулах',
    downloadAll: 'Бүх хэсгийг татах',
    part: (i, n) => `Хэсэг ${i}/${n}`,
    downloadPart: (i) => `${i}-р хэсгийг татах`,
    partsExplainFormat: 'Opus хэсгүүдийг хөтөч дээр найдвартай нэгтгэх боломжгүй. Хэсэг бүрийг дарааллаар нь татаж авна уу. Нэг файл хэрэгтэй бол MP3 эсвэл WAV формат сонгоно уу.',
    mergeFailed: 'Хэсгүүдийг нэг файл болгож чадсангүй. Хэсэг бүрийг дарааллаар нь татаж авна уу.',
    partialNote: (d, n) => `Энэ нь ${n} хэсгийн эхний ${d} хэсэг.`,
    settingsIgnored: 'Энэ загвар дуу хоолойн тохиргоог хүлээж аваагүй тул анхны тохиргоогоор үүсгэлээ.',
    testModeNote: 'Туршилтын горим: Puter жишээ аудио буцаасан, төлбөр тооцоогүй.',
    dVoice: 'Дуу хоолой',
    dModel: 'Загвар',
    dFormat: 'Формат',
    dChars: 'Тэмдэгт',
    dParts: 'Хэсэг',
    dDuration: 'Үргэлжлэх хугацаа',
    dCreated: 'Үүсгэсэн',
    history: 'Сүүлийн үүсгэлтүүд',
    historyEmpty: 'Үүсгэсэн яриа энд харагдана. Аудио зөвхөн энэ хөтөч дээр хадгалагдана.',
    clearHistory: 'Түүхийг устгах',
    confirmClear: 'Дахин дарж баталгаажуулна уу',
    hOpen: 'Нээж сонсох',
    hDownload: 'Татах',
    hUseText: 'Текст, тохиргоог дахин ашиглах',
    hDelete: 'Устгах',
    hNoAudio: 'аудио хадгалагдаагүй',
    hParts: (n) => `${n} хэсэг`,
    footer: 'Puter.js болон ElevenLabs ашиглан ажилладаг. API түлхүүр шаардлагагүй.',
    copied: 'Текстийг хууллаа',
    copyFailed: 'Хуулж чадсангүй',
    nothingToCopy: 'Хуулах текст алга',
    imported: (name) => `«${name}» файлыг орууллаа`,
    importType: 'Зөвхөн .txt текст файл оруулах боломжтой.',
    importSize: 'Файл хэт том байна. 2 МБ хүртэл файл оруулна уу.',
    importRead: 'Файлыг уншиж чадсангүй.',
    cleared: 'Цэвэрлэлээ',
    historyCleared: 'Түүхийг устгалаа',
    historyDeleted: 'Устгалаа',
    textLoaded: 'Текст, тохиргоог ачааллаа',
    signedIn: (name) => `${name} нэрээр нэвтэрлээ`,
    signedOut: 'Гарлаа',
    audioMissing: 'Энэ үүсгэлтийн аудио хөтөч дээр хадгалагдаагүй байна.',
    dismiss: 'Хаах',
    technicalDetails: 'Техникийн мэдээлэл',
    retry: 'Дахин оролдох',
    leaveWarning: 'Яриа үүсгэж байна. Хуудсыг хаавал бэлэн болоогүй хэсгүүд алга болно.',
    errors: {
      auth: ['Puter-т нэвтрээгүй байна', 'Яриа үүсгэхийн тулд Puter-ээр нэвтэрнэ үү. Нэвтрэх цонх нээгдэхгүй бол хөтчийн popup хаалтыг шалгана уу.'],
      quota: ['Puter дансны хэрэглээний хязгаар хүрсэн', 'Puter данс дээрх үлдэгдлээ шалгаад дахин оролдоно уу.'],
      rate: ['Хэт олон хүсэлт илгээлээ', 'Түр хүлээгээд дахин оролдоно уу.'],
      tooLong: ['Текст хэт урт байна', (c) => `Нэг хүсэлтэд ${c.perRequest} хүртэл тэмдэгт багтана. Текстийг богиносгоод дахин оролдоно уу.`],
      tooLongTotal: ['Текст хэт урт байна', (c) => `Нэг удаад ${c.total} хүртэл тэмдэгт үүсгэх боломжтой. Текстээ хэд хувааж үүсгэнэ үү.`],
      model: ['Энэ загварыг ашиглах боломжгүй', 'Загвар хэсгээс өөр загвар сонгоод дахин оролдоно уу.'],
      voice: ['Дуу хоолой олдсонгүй', 'Жагсаалтаас өөр дуу хоолой сонгох эсвэл voice ID-г шалгана уу.'],
      voiceInvalid: ['Voice ID буруу байна', '20 тэмдэгттэй ElevenLabs voice ID эсвэл дуу хоолойн яг нэрийг оруулна уу.'],
      format: ['Энэ форматыг ашиглах боломжгүй', '«MP3, 44.1 kHz, 128 kbps» форматыг сонгоод дахин оролдоно уу.'],
      network: ['Интернэт холболт тасарлаа', 'Холболтоо шалгаад дахин оролдоно уу.'],
      provider: ['ElevenLabs үйлчилгээнд алдаа гарлаа', 'Хэдэн минутын дараа дахин оролдоно уу.'],
      audio: ['Аудио файлыг уншиж чадсангүй', 'Дахин үүсгэж үзнэ үү.'],
      empty: ['Текст оруулаагүй байна', 'Уншуулах текстээ дээрх талбарт бичнэ үү.'],
      puterMissing: ['Puter.js ачаалагдсангүй', 'Интернэт холболт болон зар хаагч өргөтгөлөө шалгаад хуудсыг дахин ачаална уу.'],
      generic: ['Яриа үүсгэж чадсангүй', 'Дахин оролдоно уу. Алдаа давтагдвал өөр загвар эсвэл дуу хоолой сонгоно уу.'],
    },
  },

  en: {
    skipToEditor: 'Skip to text',
    tagline: 'Turn Mongolian text into speech with ElevenLabs voices and download it as an MP3.',
    langToggleHint: 'Switch the interface to Mongolian',
    themeLabel: (mode) => `Color mode: ${mode}`,
    theme_system: 'system',
    theme_light: 'light',
    theme_dark: 'dark',
    signIn: 'Sign in with Puter',
    signOut: 'Sign out',
    textLabel: 'Text',
    importTxt: 'Import .txt',
    copy: 'Copy',
    clear: 'Clear',
    dropHere: 'Drop a .txt file here',
    chars: (n) => `${n} characters`,
    charsOver: (n, max) => `${n} / ${max} characters, over the limit`,
    fitsOne: 'Fits in one request',
    splitInto: (n) => `Will be generated in ${n} parts`,
    costEstimate: (s) => `About ${s}`,
    costTitle: 'Estimated from Puter pricing. Charged to your Puter account.',
    controlsTitle: 'Settings',
    authNoticeTitle: 'Sign in with Puter first',
    authNoticeBody: 'Puter uses a user-pays model: ElevenLabs usage is billed to your own Puter account, so this app needs no API key.',
    voice: 'Voice',
    sample: 'Play a sample',
    sampleBusy: 'Generating…',
    sampleText: 'Сайн байна уу? Энэ бол миний дуу хоолой. Таны текстийг би ингэж уншина.',
    voiceSearch: 'Search voices',
    voicesPremade: 'ElevenLabs premade voices',
    voicesOther: 'Other voices',
    voicesBuiltin: 'Built-in list',
    customVoice: 'Use another voice ID…',
    customVoiceLabel: 'ElevenLabs voice ID',
    customVoiceHint: 'A 20-character voice ID, or the exact voice name.',
    voiceSrcBuiltin: 'Sign in to load the full voice list from Puter.',
    voiceSrcLoading: 'Loading voices from Puter…',
    voiceSrcPuter: (n) => `Loaded ${n} voices from Puter.`,
    voiceSrcFallback: 'Couldn’t load voices from Puter, showing the built-in list.',
    gender_male: 'male',
    gender_female: 'female',
    gender_neutral: 'neutral',
    model: 'Model',
    model_eleven_v3: 'The most expressive model. Supports Mongolian.',
    model_eleven_v4: 'Newest generation with strong emotional range. Supports Mongolian.',
    model_eleven_v4_turbo: 'Faster, cheaper variant of Eleven v4. Supports Mongolian.',
    modelUnavailable: 'not currently available on Puter',
    format: 'Audio format',
    format_mp3: 'MP3 plays everywhere. 128 kbps is enough for most uses.',
    format_wav: 'Uncompressed, highest quality. Files are several times larger than MP3.',
    format_opus: 'Small files. Long text can’t be joined into one file, so parts download separately.',
    voiceSettings: 'Voice settings',
    stability: 'Stability',
    stabilityHint: 'Lower values give a wider emotional range. Higher values read more evenly and calmly.',
    stabilityHintV3: 'Eleven v3 accepts three levels. Creative is more emotional, Robust reads most evenly.',
    stabCreative: 'Creative',
    stabNatural: 'Natural',
    stabRobust: 'Robust',
    similarity: 'Similarity to the voice',
    similarityHint: 'How closely the speech follows the selected voice. Very high values can add artifacts.',
    style: 'Style exaggeration',
    styleHint: 'Amplifies the voice’s characteristic style. 0 is the most stable and fastest.',
    speed: 'Speed',
    speedHint: '1.0 is normal speed. Lower is slower, higher is faster.',
    resetSettings: 'Reset to defaults',
    autoplay: 'Play automatically when ready',
    generate: 'Generate speech',
    signInAndGenerate: 'Sign in and generate',
    generating: 'Generating…',
    cancel: 'Cancel',
    cancelling: 'Stopping after the current part…',
    progressSingle: 'Generating speech…',
    progressChunk: (i, n) => `Generating ${i} of ${n}…`,
    merging: 'Joining parts into one file…',
    stopped: (d, n) => `Stopped. ${d} of ${n} parts are ready.`,
    failedAt: (i, n) => `Part ${i} of ${n} failed.`,
    resumeFrom: (i) => `Continue from part ${i}`,
    useCompleted: 'Use finished parts',
    discard: 'Discard',
    resultTitle: 'Your audio is ready',
    download: (ext) => `Download ${ext}`,
    replay: 'Replay',
    downloadAll: 'Download all parts',
    part: (i, n) => `Part ${i}/${n}`,
    downloadPart: (i) => `Download part ${i}`,
    partsExplainFormat: 'Opus parts can’t be joined reliably in the browser. Download each part and play them in order. Choose MP3 or WAV to get a single file.',
    mergeFailed: 'The parts couldn’t be joined into one file. Download each part and play them in order.',
    partialNote: (d, n) => `This contains the first ${d} of ${n} parts.`,
    settingsIgnored: 'This model rejected the voice settings, so the voice’s default settings were used.',
    testModeNote: 'Test mode: Puter returned sample audio and nothing was charged.',
    dVoice: 'Voice',
    dModel: 'Model',
    dFormat: 'Format',
    dChars: 'Characters',
    dParts: 'Parts',
    dDuration: 'Duration',
    dCreated: 'Created',
    history: 'Recent generations',
    historyEmpty: 'Generated audio appears here. It’s stored only in this browser.',
    clearHistory: 'Delete history',
    confirmClear: 'Click again to confirm',
    hOpen: 'Open and play',
    hDownload: 'Download',
    hUseText: 'Reuse text and settings',
    hDelete: 'Delete',
    hNoAudio: 'audio not stored',
    hParts: (n) => `${n} parts`,
    footer: 'Powered by Puter.js and ElevenLabs. No API key required.',
    copied: 'Text copied',
    copyFailed: 'Couldn’t copy the text',
    nothingToCopy: 'There’s no text to copy',
    imported: (name) => `Imported “${name}”`,
    importType: 'Only .txt text files can be imported.',
    importSize: 'That file is too large. Import files up to 2 MB.',
    importRead: 'Couldn’t read that file.',
    cleared: 'Cleared',
    historyCleared: 'History deleted',
    historyDeleted: 'Deleted',
    textLoaded: 'Text and settings loaded',
    signedIn: (name) => `Signed in as ${name}`,
    signedOut: 'Signed out',
    audioMissing: 'The audio for this generation isn’t stored in this browser.',
    dismiss: 'Dismiss',
    technicalDetails: 'Technical details',
    retry: 'Try again',
    leaveWarning: 'Speech is still generating. Leaving now loses unfinished parts.',
    errors: {
      auth: ['You’re not signed in to Puter', 'Sign in with Puter to generate speech. If the sign-in window doesn’t open, allow pop-ups for this site.'],
      quota: ['Your Puter usage limit is reached', 'Check the balance on your Puter account, then try again.'],
      rate: ['Too many requests', 'Wait a moment, then try again.'],
      tooLong: ['The text is too long', (c) => `One request fits up to ${c.perRequest} characters. Shorten the text and try again.`],
      tooLongTotal: ['The text is too long', (c) => `You can generate up to ${c.total} characters at once. Split the text into several runs.`],
      model: ['This model isn’t available', 'Choose a different model and try again.'],
      voice: ['Voice not found', 'Pick another voice from the list or check the voice ID.'],
      voiceInvalid: ['That voice ID isn’t valid', 'Enter a 20-character ElevenLabs voice ID or the exact voice name.'],
      format: ['This format isn’t available', 'Choose “MP3, 44.1 kHz, 128 kbps” and try again.'],
      network: ['The connection dropped', 'Check your internet connection and try again.'],
      provider: ['ElevenLabs returned an error', 'Try again in a few minutes.'],
      audio: ['The audio couldn’t be read', 'Generate it again.'],
      empty: ['There’s no text yet', 'Type or paste the text to read aloud in the field above.'],
      puterMissing: ['Puter.js didn’t load', 'Check your connection and any ad blockers, then reload the page.'],
      generic: ['Speech generation failed', 'Try again. If it keeps failing, choose a different model or voice.'],
    },
  },
};

for (const lang of Object.keys(STRINGS)) {
  const { errors, ...rest } = TRANSLATE_STRINGS[lang] || {};
  Object.assign(STRINGS[lang], rest);
  Object.assign(STRINGS[lang].errors, errors);
}

function t(key, ...args) {
  const dict = STRINGS[state.prefs.lang] || STRINGS.mn;
  const value = dict[key] ?? STRINGS.mn[key] ?? key;
  return typeof value === 'function' ? value(...args) : value;
}

function errorText(kind) {
  const dict = (STRINGS[state.prefs.lang] || STRINGS.mn).errors;
  const [title, hint] = dict[kind] || dict.generic;
  const limits = { perRequest: fmtNum(CONFIG.maxCharsPerRequest), total: fmtNum(CONFIG.maxTotalChars) };
  return { title, hint: typeof hint === 'function' ? hint(limits) : hint };
}

const locale = () => (state.prefs.lang === 'en' ? 'en-US' : 'mn-MN');
const fmtNum = (n) => new Intl.NumberFormat(locale()).format(n);

function fmtDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

function fmtDate(date) {
  try {
    return new Date(date).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return new Date(date).toLocaleString();
  }
}

// ==========================================================================
// 3. DOM helpers
// ==========================================================================

const $ = (id) => document.getElementById(id);
const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (typeof value !== 'string' && key in node) node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

const ICON_PATHS = {
  play: 'M8 5.5v13l10.5-6.5z',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  reuse: 'M4 6h16M4 12h10M4 18h7M17 15l3 3-3 3',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
};

function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICON_PATHS[name]);
  svg.append(path);
  return svg;
}

function iconButton(name, label, onclick) {
  return el('button', { type: 'button', class: 'btn btn-ghost btn-icon btn-sm', 'aria-label': label, title: label, onclick }, icon(name));
}

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function revealIfHidden(node) {
  const rect = node.getBoundingClientRect();
  if (rect.top < 0 || rect.bottom > window.innerHeight) {
    node.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }
}

// ==========================================================================
// 4. Storage (localStorage prefs + IndexedDB audio)
// ==========================================================================

const Store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn(LOG_PREFIX, `Could not save ${key}`, err);
      return false;
    }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

const PREFS_KEY = 'mntts.prefs';
const DRAFT_KEY = 'mntts.draft';

const DEFAULT_PREFS = {
  lang: 'mn',
  theme: 'system',
  voiceId: CONFIG.defaultVoiceId,
  voiceName: '',
  customVoice: '',
  model: CONFIG.defaultModel,
  format: CONFIG.defaultFormat,
  settings: { ...CONFIG.defaultSettings },
  autoplay: false,
  view: 'tts',
};

function loadPrefs() {
  const saved = Store.get(PREFS_KEY, {});
  const prefs = { ...DEFAULT_PREFS, ...saved, settings: { ...DEFAULT_PREFS.settings, ...(saved.settings || {}) } };
  if (!CONFIG.models.some((m) => m.id === prefs.model)) prefs.model = CONFIG.defaultModel;
  if (!CONFIG.formats.some((f) => f.id === prefs.format)) prefs.format = CONFIG.defaultFormat;
  if (!['mn', 'en'].includes(prefs.lang)) prefs.lang = 'mn';
  if (!['system', 'light', 'dark'].includes(prefs.theme)) prefs.theme = 'system';
  if (!['tts', 'translate'].includes(prefs.view)) prefs.view = 'tts';
  return prefs;
}

const savePrefs = debounce(() => Store.set(PREFS_KEY, state.prefs), 200);

/** Audio blobs for history entries; too large for localStorage. */
const AudioStore = {
  dbPromise: null,
  open() {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
        const req = indexedDB.open('mntts', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('audio');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('IndexedDB blocked'));
      });
      this.dbPromise.catch(() => { this.dbPromise = null; });
    }
    return this.dbPromise;
  },
  async run(mode, op) {
    const db = await this.open();
    const request = new Promise((resolve, reject) => {
      const tx = db.transaction('audio', mode);
      const req = op(tx.objectStore('audio'));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    // IndexedDB can stall indefinitely (blocked upgrades, some private modes).
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('IndexedDB timed out')), 8000));
    return Promise.race([request, timeout]);
  },
  put: (id, value) => AudioStore.run('readwrite', (s) => s.put(value, id)),
  get: (id) => AudioStore.run('readonly', (s) => s.get(id)),
  delete: (id) => AudioStore.run('readwrite', (s) => s.delete(id)),
  clear: () => AudioStore.run('readwrite', (s) => s.clear()),
};

// ==========================================================================
// 5. History
// ==========================================================================

const HISTORY_KEY = 'mntts.history';

const History = {
  list() {
    const list = Store.get(HISTORY_KEY, []);
    return Array.isArray(list) ? list : [];
  },

  /** Records the entry immediately; `hasAudio` flips once the audio is stored. */
  async add(entry, audio) {
    const list = [{ ...entry, hasAudio: false }, ...this.list().filter((e) => e.id !== entry.id)];
    const evicted = list.splice(CONFIG.historyLimit);
    evicted.forEach((e) => AudioStore.delete(e.id).catch(() => {}));
    // If quota is hit, shed the oldest entries until the list fits.
    while (!Store.set(HISTORY_KEY, list) && list.length > 1) {
      const dropped = list.pop();
      AudioStore.delete(dropped.id).catch(() => {});
    }
    try {
      await AudioStore.put(entry.id, audio);
      this.update(entry.id, { hasAudio: true });
    } catch (err) {
      console.warn(LOG_PREFIX, 'Audio not stored in history', err);
    }
  },

  update(id, patch) {
    const list = this.list();
    const entry = list.find((e) => e.id === id);
    if (!entry) return;
    Object.assign(entry, patch);
    Store.set(HISTORY_KEY, list);
  },

  async remove(id) {
    Store.set(HISTORY_KEY, this.list().filter((e) => e.id !== id));
    await AudioStore.delete(id).catch(() => {});
  },

  async clear() {
    Store.remove(HISTORY_KEY);
    await AudioStore.clear().catch(() => {});
  },
};

// ==========================================================================
// 6. Errors
// ==========================================================================

const Errors = {
  /** Flatten the error shapes Puter, fetch and our own code throw. */
  extract(err) {
    if (err == null) return { code: '', message: '', status: 0, field: '' };
    if (typeof err === 'string') return { code: '', message: err, status: 0, field: '' };
    const inner = err.error && typeof err.error === 'object' ? err.error : null;
    const src = inner || err;
    return {
      code: String(src.code || err.code || src.legacyCode || '').toLowerCase(),
      message: String(src.message || err.message || (typeof err.error === 'string' ? err.error : '') || ''),
      status: Number(src.status || err.status || src.statusCode || 0) || 0,
      field: String(src.fields?.key || err.fields?.key || ''),
      name: String(err.name || ''),
    };
  },

  classify(err) {
    const e = this.extract(err);
    const msg = e.message.toLowerCase();
    if (e.code === 'puter_missing') return 'puterMissing';
    if (e.code === 'voice_invalid') return 'voiceInvalid';
    if (e.code === 'translate_parse') return 'translateParse';
    if (!navigator.onLine || e.code === 'network' || e.code === 'network_error' || /failed to fetch|networkerror|network error|load failed|err_internet/.test(msg)) return 'network';
    if (e.code === 'input_too_large' || /too large|larger than|at most \d+ characters|too long/.test(msg)) return 'tooLong';
    if (e.status === 401 || /token_auth_failed|unauthori[sz]ed|auth|not_logged_in|login/.test(e.code) || /sign ?in|log ?in|unauthori|authenticat|session/.test(msg)) return 'auth';
    if (e.status === 429 || /rate.?limit|too many requests|too_many/.test(e.code + ' ' + msg)) return 'rate';
    if (e.status === 402 || /insufficient|funds|quota|usage.?limit|credit|balance|limit_exceeded/.test(e.code + ' ' + msg)) return 'quota';
    if (e.field === 'model' || /invalid model|model_not_found|unsupported model/.test(msg)) return 'model';
    if (e.field === 'voice' || /voice_not_found|unknown elevenlabs voice|ambiguous elevenlabs voice|voice id/.test(e.code + ' ' + msg)) return 'voice';
    if (e.field === 'output_format' || e.field === 'response_format' || /output_format/.test(msg)) return 'format';
    if (e.code === 'invalid_audio_response' || e.code === 'audio_decode') return 'audio';
    if (e.status >= 500 || /elevenlabs|upstream|provider|bad gateway|timeout|timed out/.test(msg)) return 'provider';
    return 'generic';
  },

  /** True when ElevenLabs refused voice_settings rather than the request itself. */
  isVoiceSettingsRejection(err) {
    const e = this.extract(err);
    const haystack = `${e.code} ${e.message} ${e.field}`.toLowerCase();
    return (e.status === 400 || e.status === 422 || /invalid|field/.test(haystack))
      && /voice_settings|stability|similarity|style|speed|ttd/.test(haystack);
  },

  describe(err) {
    const e = this.extract(err);
    const parts = [];
    if (e.code) parts.push(`code: ${e.code}`);
    if (e.status) parts.push(`status: ${e.status}`);
    if (e.field) parts.push(`field: ${e.field}`);
    if (e.message) parts.push(`message: ${e.message}`);
    return parts.join('\n') || String(err);
  },
};

class AppError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

// ==========================================================================
// 7. Auth
// ==========================================================================

const puterAvailable = () => typeof window.puter !== 'undefined' && !!window.puter?.ai?.txt2speech;

const Auth = {
  isSignedIn() {
    try { return !!(puterAvailable() && puter.auth.isSignedIn()); } catch { return false; }
  },
  async signIn() {
    // Opens a popup, so this must run inside a user gesture handler.
    await puter.auth.signIn();
    if (!this.isSignedIn()) throw new AppError('auth', 'Sign-in was not completed');
  },
  async getUser() {
    try { return await puter.auth.getUser(); } catch (err) {
      console.warn(LOG_PREFIX, 'getUser failed', err);
      return null;
    }
  },
  async signOut() {
    await puter.auth.signOut();
  },
};

// ==========================================================================
// 8. Voices & engines
// ==========================================================================

/** Puter's list endpoints may resolve to an array, a JSON string or a wrapper. */
function toArray(result) {
  let value = result;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return []; }
  }
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.result)) return value.result;
  if (Array.isArray(value?.voices)) return value.voices;
  return [];
}

// ElevenLabs voice labels arrive in English; translate the common age values.
const TRAIT_MN = { young: 'залуу', 'middle aged': 'дунд насны', old: 'ахмад' };

function normalizeVoice(raw) {
  const labels = raw.labels && typeof raw.labels === 'object' ? raw.labels : {};
  return {
    id: String(raw.id),
    name: String(raw.name),
    category: raw.category || '',
    gender: labels.gender || '',
    traits: [labels.age, labels.accent, labels.descriptive || labels.description, labels.use_case]
      .filter((v) => typeof v === 'string' && v)
      .map((v) => v.replace(/_/g, ' ')),
    description: typeof raw.description === 'string' ? raw.description : '',
  };
}

function builtinVoices() {
  return CONFIG.fallbackVoices.map((v) => ({
    id: v.id,
    name: v.name,
    category: 'builtin',
    gender: v.gender,
    traits: v.style ? [v.style[state.prefs.lang] || v.style.en] : [],
    description: '',
  }));
}

const Voices = {
  async load() {
    if (!Auth.isSignedIn()) {
      state.voices = builtinVoices();
      state.voiceSource = 'builtin';
      renderVoices();
      return;
    }
    state.voiceSource = 'loading';
    renderVoiceSource();
    try {
      const list = toArray(await puter.ai.txt2speech.listVoices({ provider: CONFIG.provider }))
        .filter((v) => v && v.id && v.name)
        .map(normalizeVoice);
      if (!list.length) throw new Error('Empty voice list');
      list.sort((a, b) => (a.category === 'premade' ? 0 : 1) - (b.category === 'premade' ? 0 : 1) || a.name.localeCompare(b.name));
      state.voices = list;
      state.voiceSource = 'puter';
    } catch (err) {
      console.warn(LOG_PREFIX, 'listVoices failed, using built-in voices', err);
      state.voices = builtinVoices();
      state.voiceSource = 'fallback';
    }
    renderVoices();
  },

  find(id) {
    return state.voices.find((v) => v.id === id) || builtinVoices().find((v) => v.id === id) || null;
  },

  shortName(voice) {
    return voice.name.split(' - ')[0].trim();
  },

  trait(value) {
    return (state.prefs.lang === 'mn' && TRAIT_MN[value.toLowerCase()]) || value;
  },

  label(voice) {
    const gender = voice.gender ? t(`gender_${voice.gender}`) : '';
    const traits = [gender, voice.traits[0] && this.trait(voice.traits[0])].filter(Boolean);
    return traits.length ? `${this.shortName(voice)} (${traits.join(', ')})` : this.shortName(voice);
  },

  /** The voice that will be sent to Puter, or null if the custom value is invalid. */
  current() {
    if (state.prefs.voiceId === CUSTOM_VOICE) {
      const value = state.prefs.customVoice.trim();
      if (!value || value.length > 100) return null;
      return { id: value, name: value, custom: true };
    }
    const voice = this.find(state.prefs.voiceId);
    return voice
      ? { id: voice.id, name: this.shortName(voice) }
      : { id: state.prefs.voiceId, name: state.prefs.voiceName || state.prefs.voiceId };
  },
};

const Engines = {
  async load() {
    if (!Auth.isSignedIn()) return;
    try {
      const engines = toArray(await puter.ai.txt2speech.listEngines({ provider: CONFIG.provider }));
      if (!engines.length) return;
      state.availableModels = new Set(engines.map((e) => e.id));
      for (const e of engines) {
        if (typeof e.pricing_per_million_chars === 'number') state.pricing.set(e.id, e.pricing_per_million_chars);
      }
    } catch (err) {
      console.info(LOG_PREFIX, 'listEngines unavailable; model list and pricing stay static', err);
    }
    renderModels();
    renderStats();
  },
};

// ==========================================================================
// 9. Chunker: paragraphs → lines → sentences → clauses → words
// ==========================================================================

const sentenceSegmenter = (() => {
  try { return new Intl.Segmenter('mn', { granularity: 'sentence' }); } catch { return null; }
})();

const Chunker = {
  normalize(text) {
    return String(text ?? '')
      .replace(/\r\n?/g, '\n')
      .replace(/[​-‍﻿]/g, '')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  },

  split(text, limit = CONFIG.maxCharsPerRequest) {
    const clean = this.normalize(text);
    if (!clean) return [];
    if (clean.length <= limit) return [clean];

    const words = (s) => pack(s.split(' '), ' ', limit, (w) => hardSplit(w, limit));
    const clauses = (s) => pack(splitClauses(s), ' ', limit, words);
    const sentences = (s) => pack(splitSentences(s), ' ', limit, clauses);
    const lines = (s) => pack(s.split('\n'), '\n', limit, sentences);
    return pack(clean.split(/\n{2,}/), '\n\n', limit, lines);
  },
};

/** Greedily joins units up to `limit`; units that are too long are split further. */
function pack(units, joiner, limit, splitOversized) {
  const out = [];
  let current = '';
  for (const raw of units) {
    const unit = raw.trim();
    if (!unit) continue;
    if (unit.length > limit) {
      if (current) out.push(current);
      current = '';
      out.push(...splitOversized(unit));
    } else if (!current) {
      current = unit;
    } else if (current.length + joiner.length + unit.length <= limit) {
      current += joiner + unit;
    } else {
      out.push(current);
      current = unit;
    }
  }
  if (current) out.push(current);
  return out;
}

function splitSentences(text) {
  if (sentenceSegmenter) {
    return Array.from(sentenceSegmenter.segment(text), (s) => s.segment.trim()).filter(Boolean);
  }
  return text.match(/[^.!?…]*[.!?…]+["'»”)\]]*|[^.!?…]+$/g) || [text];
}

function splitClauses(text) {
  return text.match(/[^,;:—–]*[,;:—–]+|[^,;:—–]+$/g) || [text];
}

/** Last resort for a single "word" longer than the limit; never splits a surrogate pair. */
function hardSplit(word, limit) {
  const out = [];
  let current = '';
  for (const ch of word) {
    if (current.length + ch.length > limit) {
      out.push(current);
      current = '';
    }
    current += ch;
  }
  if (current) out.push(current);
  return out;
}

// ==========================================================================
// 10. TTS + audio processing
// ==========================================================================

const modelById = (id) => CONFIG.models.find((m) => m.id === id) || CONFIG.models[0];
const formatById = (id) => CONFIG.formats.find((f) => f.id === id) || CONFIG.formats[0];

function snapStability(value, presets) {
  return presets.reduce((best, p) => (Math.abs(p - value) < Math.abs(best - value) ? p : best), presets[0]);
}

function buildVoiceSettings(modelId, settings) {
  const model = modelById(modelId);
  const voiceSettings = {
    stability: model.stabilityPresets ? snapStability(settings.stability, model.stabilityPresets) : settings.stability,
    similarity_boost: settings.similarity,
    style: settings.style,
  };
  if (Math.abs(settings.speed - 1) > 0.001) voiceSettings.speed = settings.speed;
  return voiceSettings;
}

const TTS = {
  /**
   * Synthesizes one request-sized chunk and returns its audio Blob.
   * If ElevenLabs rejects voice_settings for this model, retries once without them.
   */
  async synthesize(text, { model, voice, format, settings, skipSettings }) {
    const options = { provider: CONFIG.provider, model, voice, output_format: format };
    if (CONFIG.testMode) options.test_mode = true;
    if (!skipSettings) options.voice_settings = buildVoiceSettings(model, settings);

    try {
      return { blob: await this.request(text, options), settingsIgnored: false };
    } catch (err) {
      if (!options.voice_settings || !Errors.isVoiceSettingsRejection(err)) throw err;
      console.warn(LOG_PREFIX, 'voice_settings rejected; retrying with voice defaults', err);
      delete options.voice_settings;
      return { blob: await this.request(text, options), settingsIgnored: true };
    }
  },

  async request(text, options) {
    console.debug(LOG_PREFIX, 'txt2speech', { chars: text.length, ...options });
    const audio = await puter.ai.txt2speech(text, options);
    const src = audio?.src || (audio ? String(audio) : '');
    if (!src) throw new AppError('invalid_audio_response', 'txt2speech returned no audio source');

    let raw;
    try {
      const res = await fetch(src);
      if (!res.ok) throw new AppError('invalid_audio_response', `Audio fetch failed with HTTP ${res.status}`);
      raw = await res.blob();
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw Object.assign(new AppError('invalid_audio_response', `Could not read audio: ${err.message}`), { cause: err });
    }
    if (!raw.size) throw new AppError('invalid_audio_response', 'Audio response was empty');
    // Test mode returns a fixed sample, so keep whatever type it reports.
    const type = CONFIG.testMode ? raw.type || 'audio/mpeg' : formatById(options.output_format).mime;
    return new Blob([raw], { type });
  },
};

const AudioTools = {
  /** Joins chunk blobs into one file. Throws if the format can't be joined. */
  async merge(blobs, format) {
    if (blobs.length === 1) return blobs[0];
    const buffers = await Promise.all(blobs.map(async (b) => new Uint8Array(await b.arrayBuffer())));
    if (format.merge === 'mp3') return new Blob(buffers.map(stripMp3), { type: 'audio/mpeg' });
    if (format.merge === 'wav') return mergeWav(buffers);
    throw new Error(`No merge strategy for ${format.id}`);
  },

  /** Decodes at a low sample rate to get an exact duration and waveform peaks. */
  async analyze(blob, buckets = 800) {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline || blob.size > 80 * 1024 * 1024) return null;
    try {
      const data = await blob.arrayBuffer();
      let ctx;
      try { ctx = new Offline(1, 1, 8000); } catch { ctx = new Offline(1, 1, 44100); }
      const buffer = await ctx.decodeAudioData(data);
      const channel = buffer.getChannelData(0);
      const size = Math.max(1, Math.floor(channel.length / buckets));
      const peaks = new Float32Array(buckets);
      let max = 0;
      for (let i = 0; i < buckets; i++) {
        let peak = 0;
        const end = Math.min(channel.length, (i + 1) * size);
        for (let j = i * size; j < end; j++) {
          const v = Math.abs(channel[j]);
          if (v > peak) peak = v;
        }
        peaks[i] = peak;
        if (peak > max) max = peak;
      }
      if (max > 0) for (let i = 0; i < buckets; i++) peaks[i] /= max;
      return { duration: buffer.duration, peaks };
    } catch (err) {
      console.warn(LOG_PREFIX, 'Audio analysis failed', err);
      return null;
    }
  },

  probeDuration(url) {
    return new Promise((resolve) => {
      const audio = new Audio();
      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        audio.removeAttribute('src');
        resolve(value);
      };
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? audio.duration : null);
      audio.onerror = () => done(null);
      setTimeout(() => done(null), 8000);
      audio.src = url;
    });
  },
};

const MP3_BITRATES = {
  v1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  v2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const MP3_SAMPLE_RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** Byte length of the MPEG Layer III frame starting at `i`, or 0. */
function mp3FrameLength(bytes, i) {
  if (i + 4 > bytes.length || bytes[i] !== 0xff || (bytes[i + 1] & 0xe0) !== 0xe0) return 0;
  const version = (bytes[i + 1] >> 3) & 3;
  const layer = (bytes[i + 1] >> 1) & 3;
  const bitrateIdx = bytes[i + 2] >> 4;
  const rateIdx = (bytes[i + 2] >> 2) & 3;
  const padding = (bytes[i + 2] >> 1) & 1;
  if (version === 1 || layer !== 1 || bitrateIdx === 0 || bitrateIdx === 15 || rateIdx === 3) return 0;
  const bitrate = (version === 3 ? MP3_BITRATES.v1 : MP3_BITRATES.v2)[bitrateIdx] * 1000;
  const sampleRate = MP3_SAMPLE_RATES[version][rateIdx];
  return Math.floor(((version === 3 ? 144 : 72) * bitrate) / sampleRate) + padding;
}

function hasAscii(bytes, start, end, word) {
  outer: for (let i = start; i <= end - word.length; i++) {
    for (let j = 0; j < word.length; j++) if (bytes[i + j] !== word.charCodeAt(j)) continue outer;
    return true;
  }
  return false;
}

/**
 * Returns the raw MPEG frames of an MP3 file: drops ID3v2/ID3v1 tags and a
 * leading Xing/Info/VBRI header frame, which would otherwise make players
 * report only the first chunk's duration after concatenation.
 */
function stripMp3(bytes) {
  let start = 0;
  let end = bytes.length;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
    start = 10 + size + (bytes[5] & 0x10 ? 10 : 0);
  }
  if (end - start > 128 && bytes[end - 128] === 0x54 && bytes[end - 127] === 0x41 && bytes[end - 126] === 0x47) end -= 128;
  // A real frame start is followed by another frame (or the end of the file).
  const isFrameStart = (i) => {
    const length = mp3FrameLength(bytes, i);
    return length > 0 && (i + length >= end || mp3FrameLength(bytes, i + length) > 0);
  };
  while (start < end && !isFrameStart(start)) start++;
  if (start >= end) throw new Error('No MPEG frames found');

  const first = mp3FrameLength(bytes, start);
  const headerEnd = Math.min(start + first, start + 64);
  if (['Xing', 'Info', 'VBRI'].some((tag) => hasAscii(bytes, start + 4, headerEnd, tag))) start += first;
  return bytes.subarray(start, end);
}

function readAscii(bytes, offset, length) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function parseWav(bytes) {
  if (readAscii(bytes, 0, 4) !== 'RIFF' || readAscii(bytes, 8, 4) !== 'WAVE') throw new Error('Not a WAV file');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let fmt = null;
  while (offset + 8 <= bytes.length) {
    const id = readAscii(bytes, offset, 4);
    let size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') fmt = bytes.subarray(body, body + size);
    if (id === 'data') {
      // Streamed WAVs may carry a placeholder size; use what's actually there.
      if (size === 0 || size === 0xffffffff || body + size > bytes.length) size = bytes.length - body;
      if (!fmt) throw new Error('WAV data before fmt chunk');
      const blockAlign = new DataView(fmt.buffer, fmt.byteOffset, fmt.byteLength).getUint16(12, true) || 1;
      return { fmt, data: bytes.subarray(body, body + size - (size % blockAlign)) };
    }
    offset = body + size + (size & 1);
  }
  throw new Error('WAV has no data chunk');
}

function mergeWav(buffers) {
  const parsed = buffers.map(parseWav);
  const { fmt } = parsed[0];
  const sameFmt = (a) => a.length === fmt.length && a.every((b, i) => b === fmt[i]);
  if (!parsed.every((p) => sameFmt(p.fmt))) throw new Error('WAV parts use different formats');

  const dataLength = parsed.reduce((sum, p) => sum + p.data.length, 0);
  const fmtPadded = fmt.length + (fmt.length & 1);
  const headerLength = 12 + 8 + fmtPadded + 8;
  if (headerLength - 8 + dataLength > 0xffffffff) throw new Error('Merged WAV exceeds 4 GB');

  const header = new Uint8Array(headerLength);
  const view = new DataView(header.buffer);
  const writeAscii = (offset, s) => { for (let i = 0; i < s.length; i++) header[offset + i] = s.charCodeAt(i); };
  writeAscii(0, 'RIFF');
  view.setUint32(4, headerLength - 8 + dataLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, fmt.length, true);
  header.set(fmt, 20);
  writeAscii(20 + fmtPadded, 'data');
  view.setUint32(24 + fmtPadded, dataLength, true);
  return new Blob([header, ...parsed.map((p) => p.data)], { type: 'audio/wav' });
}

/** Canvas waveform synced to an <audio> element; click or drag to seek. */
class Waveform {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.audio = audio;
    this.peaks = null;
    this.frame = 0;
    this.dragging = false;

    const tick = () => {
      this.draw();
      if (!this.audio.paused) this.frame = requestAnimationFrame(tick);
    };
    audio.addEventListener('play', () => { cancelAnimationFrame(this.frame); tick(); });
    ['pause', 'seeked', 'timeupdate', 'ended'].forEach((e) => audio.addEventListener(e, () => this.draw()));

    const seek = (event) => {
      if (!this.peaks || !Number.isFinite(audio.duration)) return;
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      audio.currentTime = ratio * audio.duration;
      this.draw();
    };
    canvas.addEventListener('pointerdown', (e) => { this.dragging = true; canvas.setPointerCapture(e.pointerId); seek(e); });
    canvas.addEventListener('pointermove', (e) => { if (this.dragging) seek(e); });
    canvas.addEventListener('pointerup', () => { this.dragging = false; });
    canvas.addEventListener('pointercancel', () => { this.dragging = false; });

    new ResizeObserver(() => this.draw()).observe(canvas);
  }

  setPeaks(peaks) {
    this.peaks = peaks;
    this.draw();
  }

  draw() {
    const { canvas, peaks } = this;
    if (!peaks || !canvas.isConnected) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const styles = getComputedStyle(document.documentElement);
    const played = styles.getPropertyValue('--accent').trim();
    const idle = styles.getPropertyValue('--wave-idle').trim();
    const head = styles.getPropertyValue('--red').trim();

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    const barWidth = Math.max(2, Math.round(2 * dpr));
    const gap = Math.max(1, Math.round(2 * dpr));
    const bars = Math.max(1, Math.floor(width / (barWidth + gap)));
    const progress = this.audio.duration ? this.audio.currentTime / this.audio.duration : 0;
    const mid = height / 2;

    for (let i = 0; i < bars; i++) {
      const from = Math.floor((i / bars) * peaks.length);
      const to = Math.max(from + 1, Math.floor(((i + 1) / bars) * peaks.length));
      let peak = 0;
      for (let j = from; j < to; j++) if (peaks[j] > peak) peak = peaks[j];
      const h = Math.max(2 * dpr, peak * (height - 4 * dpr));
      ctx.fillStyle = i / bars < progress ? played : idle;
      ctx.fillRect(i * (barWidth + gap), mid - h / 2, barWidth, h);
    }

    if (progress > 0 && progress < 1) {
      ctx.fillStyle = head;
      ctx.fillRect(Math.round(progress * width) - dpr, 0, Math.max(2, Math.round(2 * dpr)), height);
    }
  }
}

// ==========================================================================
// 11. Download
// ==========================================================================

function timestamp(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** mongolian-tts-YYYY-MM-DD-HHMMSS.mp3, or …-part-02-of-05.opus for parts. */
function buildFilename(date, ext, part) {
  const base = `mongolian-tts-${timestamp(date)}`;
  if (!part) return `${base}.${ext}`;
  const width = String(part.total).length < 2 ? 2 : String(part.total).length;
  return `${base}-part-${String(part.index).padStart(width, '0')}-of-${String(part.total).padStart(width, '0')}.${ext}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: filename, rel: 'noopener', hidden: true });
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function downloadText(text, filename, mime = 'text/plain') {
  // The BOM helps older players and Windows editors detect UTF-8 Cyrillic.
  downloadBlob(new Blob(['\uFEFF', text], { type: `${mime};charset=utf-8` }), filename);
}

// ==========================================================================
// 12. State & UI rendering
// ==========================================================================

const state = {
  prefs: loadPrefs(),
  user: null,
  voices: [],
  voiceSource: 'builtin',
  voiceFilter: '',
  availableModels: null,
  pricing: new Map(),
  busy: false,
  sampleBusy: false,
  cancelRequested: false,
  job: null,
  output: null,
  outputUrls: [],
};

let ui = {};
let waveform = null;
let translator = null;
let toastTimer = 0;

function cacheDom() {
  const ids = [
    'langToggle', 'langToggleHint', 'themeToggle', 'themeToggleLabel', 'authUser', 'signInBtn', 'signOutBtn',
    'dropZone', 'dropOverlay', 'textInput', 'charCount', 'chunkEstimate', 'costEstimate', 'importBtn', 'copyBtn',
    'clearBtn', 'fileInput', 'authNotice', 'noticeSignInBtn', 'voiceSelect', 'voiceSearch', 'voiceMeta',
    'voiceSource', 'customVoiceGroup', 'customVoiceInput', 'sampleBtn', 'modelSelect', 'modelHint',
    'formatSelect', 'formatHint', 'stabilitySlider', 'stabilityPresets', 'stabilityInput', 'stabilityValue',
    'stabilityHint', 'similarityInput', 'similarityValue', 'styleInput', 'styleValue', 'speedInput', 'speedValue',
    'resetSettingsBtn', 'autoplayInput', 'generateBtn', 'generateLabel', 'cancelBtn', 'errorBox', 'progressPanel',
    'progressLabel', 'progressCount', 'progressSegments', 'progressActions', 'resultPanel', 'resultDuration',
    'waveformWrap', 'waveform', 'player', 'resultActions', 'downloadBtn', 'downloadLabel', 'replayBtn',
    'partsBlock', 'partsExplain', 'partsList', 'downloadAllBtn', 'resultWarning', 'resultDetails',
    'historyList', 'historyEmpty', 'clearHistoryBtn', 'toast',
  ];
  ui = Object.fromEntries(ids.map((id) => [id, $(id)]));
}

function toast(message) {
  ui.toast.textContent = message;
  ui.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { ui.toast.hidden = true; }, 2800);
}

function applyTheme() {
  const root = document.documentElement;
  const pref = state.prefs.theme;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  root.dataset.themePref = pref;
  const label = t('themeLabel', t(`theme_${pref}`));
  ui.themeToggleLabel.textContent = label;
  ui.themeToggle.title = label;
  waveform?.draw();
}

function applyLanguage() {
  document.documentElement.lang = state.prefs.lang;
  document.querySelectorAll('[data-i18n]').forEach((node) => { node.textContent = t(node.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => { node.placeholder = t(node.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((node) => { node.setAttribute('aria-label', t(node.dataset.i18nAriaLabel)); });
  ui.langToggle.textContent = state.prefs.lang === 'mn' ? 'EN' : 'МН';
  ui.langToggle.setAttribute('lang', state.prefs.lang === 'mn' ? 'en' : 'mn');
  // Built-in voice traits are localized, so rebuild them.
  if (state.voiceSource !== 'puter') state.voices = builtinVoices();
  applyTheme();
  renderAll();
}

function renderAll() {
  renderAuth();
  renderVoices();
  renderModels();
  renderFormats();
  renderSettings();
  renderStats();
  renderGenerateButton();
  renderHistory();
  translator?.render();
  if (state.output) renderOutputDetails(state.output);
  if (state.job && !ui.progressPanel.hidden) renderProgress(state.job, state.job.cursor, ui.progressPanel.dataset.state || 'running');
}

function renderAuth() {
  const signedIn = Auth.isSignedIn();
  const name = state.user?.username || '';
  ui.authUser.textContent = name;
  ui.authUser.hidden = !signedIn || !name;
  ui.signInBtn.hidden = signedIn || !puterAvailable();
  ui.signOutBtn.hidden = !signedIn;
  ui.authNotice.hidden = signedIn || !puterAvailable();
  renderGenerateButton();
}

function renderVoiceSource() {
  const map = {
    builtin: t('voiceSrcBuiltin'),
    loading: t('voiceSrcLoading'),
    puter: t('voiceSrcPuter', fmtNum(state.voices.length)),
    fallback: t('voiceSrcFallback'),
  };
  ui.voiceSource.textContent = map[state.voiceSource] || '';
}

function renderVoices() {
  const select = ui.voiceSelect;
  const selected = state.prefs.voiceId;
  const query = state.voiceFilter.trim().toLowerCase();
  const matches = (v) => !query || v.id === selected || `${v.name} ${v.gender} ${v.traits.join(' ')}`.toLowerCase().includes(query);

  const groups = new Map();
  // Keep a saved voice selectable even if the current list doesn't include it
  // (e.g. a Puter voice while only the built-in list is shown).
  const known = state.voices.some((v) => v.id === selected) || selected === CUSTOM_VOICE;
  if (!known && selected) groups.set('', [el('option', { value: selected, text: state.prefs.voiceName || selected })]);

  for (const voice of state.voices.filter(matches)) {
    const group = voice.category === 'builtin' ? t('voicesBuiltin') : voice.category === 'premade' ? t('voicesPremade') : t('voicesOther');
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(el('option', { value: voice.id, text: Voices.label(voice) }));
  }

  const nodes = [...groups].map(([label, options]) => (label && groups.size > 1 ? el('optgroup', { label }, options) : options));
  select.replaceChildren(...nodes.flat(), el('option', { value: CUSTOM_VOICE, text: t('customVoice') }));
  select.value = state.prefs.voiceId;
  if (select.value !== state.prefs.voiceId) select.selectedIndex = 0;

  ui.voiceSearch.hidden = state.voices.length <= CONFIG.voiceSearchThreshold;
  ui.customVoiceGroup.hidden = state.prefs.voiceId !== CUSTOM_VOICE;
  ui.customVoiceInput.value = state.prefs.customVoice;
  renderVoiceMeta();
  renderVoiceSource();
}

function renderVoiceMeta() {
  if (state.prefs.voiceId === CUSTOM_VOICE) {
    ui.voiceMeta.textContent = '';
    return;
  }
  const voice = Voices.find(state.prefs.voiceId);
  if (!voice) {
    ui.voiceMeta.textContent = '';
    return;
  }
  // The select label already shows gender and the first trait; only add what's new.
  const extra = voice.traits.slice(1).map((v) => Voices.trait(v));
  ui.voiceMeta.textContent = voice.description || extra.join(', ');
}

function renderModels() {
  const options = CONFIG.models.map((model) => {
    const unavailable = state.availableModels && !state.availableModels.has(model.id);
    return el('option', {
      value: model.id,
      text: unavailable ? `${model.name} (${t('modelUnavailable')})` : model.name,
      disabled: !!unavailable,
    });
  });
  ui.modelSelect.replaceChildren(...options);

  if (state.availableModels && !state.availableModels.has(state.prefs.model)) {
    const fallback = CONFIG.models.find((m) => state.availableModels.has(m.id));
    if (fallback) {
      state.prefs.model = fallback.id;
      savePrefs();
    }
  }
  ui.modelSelect.value = state.prefs.model;
  ui.modelHint.textContent = t(`model_${state.prefs.model}`);
  renderSettings();
}

function renderFormats() {
  ui.formatSelect.replaceChildren(...CONFIG.formats.map((f) => el('option', { value: f.id, text: f.label })));
  ui.formatSelect.value = state.prefs.format;
  ui.formatHint.textContent = t(`format_${formatById(state.prefs.format).family}`);
}

function setRangeFill(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  input.style.setProperty('--fill', `${((Number(input.value) - min) / (max - min)) * 100}%`);
}

function renderSettings() {
  const { settings } = state.prefs;
  const model = modelById(state.prefs.model);
  const presets = model.stabilityPresets;

  ui.stabilitySlider.hidden = !!presets;
  ui.stabilityPresets.hidden = !presets;
  ui.stabilityHint.textContent = presets ? t('stabilityHintV3') : t('stabilityHint');
  if (presets) {
    const snapped = snapStability(settings.stability, presets);
    ui.stabilityPresets.querySelectorAll('input').forEach((input) => { input.checked = Number(input.value) === snapped; });
  }

  const sliders = [
    [ui.stabilityInput, ui.stabilityValue, settings.stability, (v) => v.toFixed(2)],
    [ui.similarityInput, ui.similarityValue, settings.similarity, (v) => v.toFixed(2)],
    [ui.styleInput, ui.styleValue, settings.style, (v) => v.toFixed(2)],
    [ui.speedInput, ui.speedValue, settings.speed, (v) => `${v.toFixed(2)}×`],
  ];
  for (const [input, output, value, format] of sliders) {
    input.value = String(value);
    output.textContent = format(value);
    setRangeFill(input);
  }
  ui.autoplayInput.checked = !!state.prefs.autoplay;
}

const renderStats = debounce(() => {
  const raw = ui.textInput.value;
  const clean = Chunker.normalize(raw);
  const count = raw.length;
  const over = clean.length > CONFIG.maxTotalChars;

  ui.charCount.textContent = over
    ? t('charsOver', fmtNum(clean.length), fmtNum(CONFIG.maxTotalChars))
    : t('chars', fmtNum(count));
  ui.charCount.classList.toggle('stat-warn', over);

  if (!clean || over) {
    ui.chunkEstimate.textContent = '';
  } else {
    const parts = Chunker.split(clean).length;
    ui.chunkEstimate.textContent = parts === 1 ? t('fitsOne') : t('splitInto', fmtNum(parts));
  }

  const price = state.pricing.get(state.prefs.model);
  if (clean && !over && typeof price === 'number' && !CONFIG.testMode) {
    const cost = (clean.length * price) / 1e6;
    ui.costEstimate.textContent = t('costEstimate', cost < 0.01 ? '< $0.01' : `$${cost.toFixed(2)}`);
    ui.costEstimate.title = t('costTitle');
    ui.costEstimate.hidden = false;
  } else {
    ui.costEstimate.hidden = true;
  }
}, 120);

function renderGenerateButton() {
  const btn = ui.generateBtn;
  btn.classList.toggle('is-busy', state.busy);
  btn.disabled = state.busy || !puterAvailable();
  btn.setAttribute('aria-busy', String(state.busy));
  ui.generateLabel.textContent = state.busy
    ? t('generating')
    : Auth.isSignedIn() || !puterAvailable() ? t('generate') : t('signInAndGenerate');
  const multiPart = state.job && state.job.chunks.length > 1;
  ui.cancelBtn.hidden = !(state.busy && multiPart);
  ui.cancelBtn.disabled = state.cancelRequested;
  ui.sampleBtn.disabled = state.busy || state.sampleBusy || !puterAvailable();
  ui.sampleBtn.textContent = state.sampleBusy ? t('sampleBusy') : t('sample');
  ui.clearBtn.disabled = state.busy;
}

// ---- Error area ----

/** Fills an `.alert` box; `box` defaults to the text-to-speech view's. */
function showError(errOrKind, { context = '', actions = [], box = ui.errorBox } = {}) {
  const isKind = typeof errOrKind === 'string';
  const kind = isKind ? errOrKind : Errors.classify(errOrKind);
  if (!isKind) console.error(LOG_PREFIX, context || 'Error', errOrKind);

  const { title, hint } = errorText(kind);
  const part = (selector) => box.querySelector(selector);
  part('.alert-title').textContent = title;
  part('.alert-hint').textContent = hint;

  const buttons = [];
  if (kind === 'auth' && puterAvailable()) {
    buttons.push({ label: t('signIn'), primary: !actions.length, onClick: () => handleSignIn() });
  }
  buttons.push(...actions);
  part('.alert-actions').replaceChildren(...buttons.map((a) => el('button', {
    type: 'button',
    class: `btn btn-sm ${a.primary ? 'btn-primary' : 'btn-secondary'}`,
    text: a.label,
    onclick: () => { box.hidden = true; a.onClick(); },
  })));

  part('.alert-details').hidden = isKind;
  part('.alert-details pre').textContent = isKind ? '' : [context, Errors.describe(errOrKind)].filter(Boolean).join('\n');
  box.hidden = false;
  revealIfHidden(box);
}

function hideError(box = ui.errorBox) {
  box.hidden = true;
}

// ---- Progress ----

function renderProgress(job, index, mode) {
  const n = job.chunks.length;
  const done = job.results.filter(Boolean).length;
  ui.progressPanel.hidden = false;
  ui.progressPanel.dataset.state = mode;

  if (ui.progressSegments.dataset.job !== job.id) {
    ui.progressSegments.dataset.job = job.id;
    ui.progressSegments.replaceChildren(...job.chunks.map((chunk) => el('span', { class: 'segment', style: `flex-grow:${chunk.length}` })));
  }
  [...ui.progressSegments.children].forEach((seg, i) => {
    seg.dataset.state = job.results[i] ? 'done'
      : i === index && mode === 'running' ? 'active'
        : i === index && mode === 'failed' ? 'failed' : 'pending';
  });

  const labels = {
    running: state.cancelRequested ? t('cancelling') : n === 1 ? t('progressSingle') : t('progressChunk', index + 1, n),
    merging: t('merging'),
    stopped: t('stopped', done, n),
    failed: t('failedAt', index + 1, n),
  };
  ui.progressLabel.textContent = labels[mode];
  const doneChars = job.chunks.reduce((sum, c, i) => sum + (job.results[i] ? c.length : 0), 0);
  const totalChars = job.chunks.reduce((sum, c) => sum + c.length, 0);
  ui.progressCount.textContent = `${Math.round((doneChars / totalChars) * 100)}%`;

  const actions = [];
  if (mode === 'stopped' || mode === 'failed') {
    actions.push(el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: t('resumeFrom', index + 1), onclick: () => resumeJob(index) }));
    if (done > 0 && job.results[0]) {
      actions.push(el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: t('useCompleted'), onclick: () => finishJob(job, { partial: true }) }));
    }
    actions.push(el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: t('discard'), onclick: discardJob }));
  }
  ui.progressActions.replaceChildren(...actions);
}

function hideProgress() {
  ui.progressPanel.hidden = true;
  ui.progressActions.replaceChildren();
}

// ---- Result ----

function releaseOutputUrls() {
  state.outputUrls.forEach((url) => URL.revokeObjectURL(url));
  state.outputUrls = [];
}

function trackUrl(blob) {
  const url = URL.createObjectURL(blob);
  state.outputUrls.push(url);
  return url;
}

/**
 * output = { id, merged: Blob|null, parts: Blob[], meta: {...} }
 * meta = { createdAt, voiceName, model, format, chars, totalParts, mergeFailed, settingsIgnored, testMode }
 */
async function showOutput(output, { autoplay = false } = {}) {
  releaseOutputUrls();
  ui.player.pause();
  state.output = output;
  const format = formatById(output.meta.format);
  const single = output.merged;

  ui.resultPanel.hidden = false;
  ui.player.hidden = !single;
  ui.resultActions.hidden = !single;
  ui.waveformWrap.hidden = true;
  ui.partsBlock.hidden = !!single;
  ui.resultDuration.textContent = '';

  if (single) {
    const url = trackUrl(single);
    ui.player.src = url;
    ui.downloadLabel.textContent = t('download', format.ext.toUpperCase());
    if (autoplay) ui.player.play().catch((err) => console.info(LOG_PREFIX, 'Autoplay blocked', err));
  } else {
    ui.player.removeAttribute('src');
    ui.player.load();
    renderParts(output, format);
  }

  renderOutputDetails(output);
  renderHistory();
  revealIfHidden(ui.resultPanel);

  // Duration and waveform are filled in once decoding finishes.
  let duration = null;
  if (single) {
    const analysis = await AudioTools.analyze(single);
    if (state.output !== output) return;
    if (analysis) {
      ui.waveformWrap.hidden = false;
      waveform.setPeaks(analysis.peaks);
      duration = analysis.duration;
    } else {
      duration = await AudioTools.probeDuration(state.outputUrls[0]);
    }
  } else {
    const durations = await Promise.all(output.parts.map((_, i) => AudioTools.probeDuration(state.outputUrls[i])));
    if (durations.every(Number.isFinite)) duration = durations.reduce((a, b) => a + b, 0);
  }
  if (state.output !== output) return;
  output.meta.duration = duration;
  renderOutputDetails(output);
  if (duration && output.historyId) {
    History.update(output.historyId, { duration });
    renderHistory();
  }
}

function renderParts(output, format) {
  const total = output.parts.length;
  ui.partsExplain.textContent = output.meta.mergeFailed ? t('mergeFailed') : t('partsExplainFormat');
  ui.partsList.replaceChildren(...output.parts.map((blob, i) => {
    const url = trackUrl(blob);
    return el('li', { class: 'part-item' },
      el('span', { class: 'part-name', text: t('part', i + 1, total) }),
      el('audio', { controls: true, preload: 'metadata', src: url }),
      iconButton('download', t('downloadPart', i + 1), () => downloadBlob(blob, buildFilename(output.meta.createdAt, format.ext, { index: i + 1, total }))));
  }));
}

function renderOutputDetails(output) {
  const { meta } = output;
  const format = formatById(meta.format);
  const partsCount = meta.totalParts && meta.totalParts !== meta.parts ? `${meta.parts} / ${meta.totalParts}` : String(meta.parts);
  const rows = [
    [t('dVoice'), meta.voiceName],
    [t('dModel'), modelById(meta.model).name],
    [t('dFormat'), format.label],
    [t('dChars'), fmtNum(meta.chars)],
    [t('dParts'), partsCount],
    [t('dDuration'), fmtDuration(meta.duration)],
    [t('dCreated'), fmtDate(meta.createdAt)],
  ].filter(([, value]) => value);
  ui.resultDetails.replaceChildren(...rows.map(([label, value]) => el('div', {}, el('dt', { text: label }), el('dd', { text: value }))));
  ui.resultDuration.textContent = fmtDuration(meta.duration);
  ui.downloadLabel.textContent = t('download', format.ext.toUpperCase());

  const warnings = [];
  if (meta.totalParts && meta.parts < meta.totalParts) warnings.push(t('partialNote', meta.parts, meta.totalParts));
  if (meta.settingsIgnored) warnings.push(t('settingsIgnored'));
  if (meta.testMode) warnings.push(t('testModeNote'));
  ui.resultWarning.textContent = warnings.join(' ');
  ui.resultWarning.hidden = !warnings.length;
  if (!output.merged) ui.partsExplain.textContent = meta.mergeFailed ? t('mergeFailed') : t('partsExplainFormat');
}

function resetOutput() {
  releaseOutputUrls();
  ui.player.pause();
  ui.player.removeAttribute('src');
  ui.player.load();
  ui.resultPanel.hidden = true;
  state.output = null;
  renderHistory();
}

// ---- History ----

let clearArmTimer = 0;

function renderHistory() {
  const list = History.list();
  ui.historyEmpty.hidden = list.length > 0;
  ui.clearHistoryBtn.hidden = list.length === 0;
  if (!ui.clearHistoryBtn.dataset.armed) ui.clearHistoryBtn.textContent = t('clearHistory');

  const currentId = state.output?.historyId;
  ui.historyList.replaceChildren(...list.map((entry) => {
    const meta = [
      fmtDate(entry.createdAt),
      entry.voiceName,
      modelById(entry.model).name,
      fmtDuration(entry.duration),
      entry.parts > 1 ? t('hParts', entry.parts) : '',
      entry.hasAudio ? '' : t('hNoAudio'),
    ].filter(Boolean);

    const actions = [];
    if (entry.hasAudio) {
      actions.push(iconButton('play', t('hOpen'), () => openHistoryEntry(entry.id)));
      actions.push(iconButton('download', t('hDownload'), () => downloadHistoryEntry(entry.id)));
    }
    actions.push(iconButton('reuse', t('hUseText'), () => reuseHistoryEntry(entry.id)));
    actions.push(iconButton('trash', t('hDelete'), () => deleteHistoryEntry(entry.id)));

    return el('li', { class: `history-item${entry.id === currentId ? ' is-current' : ''}` },
      el('p', { class: 'history-excerpt', text: entry.excerpt, lang: 'mn' }),
      el('p', { class: 'history-meta' }, meta.map((m) => el('span', { text: m }))),
      el('div', { class: 'history-actions' }, actions));
  }));
}

async function loadHistoryAudio(id) {
  try {
    const audio = await AudioStore.get(id);
    if (audio && (audio.merged || audio.parts?.length)) return audio;
  } catch (err) {
    console.warn(LOG_PREFIX, 'Could not read stored audio', err);
  }
  toast(t('audioMissing'));
  return null;
}

function outputFromEntry(entry, audio) {
  return {
    id: entry.id,
    historyId: entry.id,
    merged: audio.merged || null,
    parts: audio.merged ? [audio.merged] : audio.parts,
    meta: {
      createdAt: entry.createdAt,
      voiceName: entry.voiceName,
      model: entry.model,
      format: entry.format,
      chars: entry.chars,
      parts: entry.parts,
      totalParts: entry.totalParts,
      mergeFailed: !!entry.mergeFailed,
      settingsIgnored: !!entry.settingsIgnored,
      testMode: !!entry.testMode,
      duration: entry.duration || null,
    },
  };
}

async function openHistoryEntry(id) {
  const entry = History.list().find((e) => e.id === id);
  const audio = entry && await loadHistoryAudio(id);
  if (audio) showOutput(outputFromEntry(entry, audio));
}

async function downloadHistoryEntry(id) {
  const entry = History.list().find((e) => e.id === id);
  const audio = entry && await loadHistoryAudio(id);
  if (!audio) return;
  const { ext } = formatById(entry.format);
  if (audio.merged) {
    downloadBlob(audio.merged, buildFilename(entry.createdAt, ext));
  } else {
    downloadParts(audio.parts, entry.createdAt, ext);
  }
}

function reuseHistoryEntry(id) {
  const entry = History.list().find((e) => e.id === id);
  if (!entry) return;
  ui.textInput.value = entry.text;
  Object.assign(state.prefs, {
    voiceId: entry.voiceId,
    voiceName: entry.voiceName,
    customVoice: entry.voiceId === CUSTOM_VOICE ? entry.customVoice || '' : state.prefs.customVoice,
    model: entry.model,
    format: entry.format,
    settings: { ...state.prefs.settings, ...(entry.settings || {}) },
  });
  savePrefs();
  saveDraft();
  renderVoices();
  renderModels();
  renderFormats();
  renderStats();
  ui.textInput.focus();
  toast(t('textLoaded'));
}

async function deleteHistoryEntry(id) {
  await History.remove(id);
  if (state.output?.historyId === id) state.output.historyId = null;
  renderHistory();
  toast(t('historyDeleted'));
}

async function onClearHistory() {
  const btn = ui.clearHistoryBtn;
  if (!btn.dataset.armed) {
    btn.dataset.armed = '1';
    btn.textContent = t('confirmClear');
    clearTimeout(clearArmTimer);
    clearArmTimer = setTimeout(() => { delete btn.dataset.armed; btn.textContent = t('clearHistory'); }, 4000);
    return;
  }
  clearTimeout(clearArmTimer);
  delete btn.dataset.armed;
  await History.clear();
  if (state.output) state.output.historyId = null;
  renderHistory();
  toast(t('historyCleared'));
}

// ==========================================================================
// 13. Generation controller
// ==========================================================================

function setBusy(busy) {
  state.busy = busy;
  if (!busy) state.cancelRequested = false;
  renderGenerateButton();
}

function snapshotParams() {
  const voice = Voices.current();
  return {
    model: state.prefs.model,
    format: state.prefs.format,
    voice: voice.id,
    voiceName: voice.name,
    voicePref: state.prefs.voiceId,
    customVoice: state.prefs.customVoice,
    settings: { ...state.prefs.settings },
  };
}

/** Signs the user in from inside a click handler if needed. Returns true when ready. */
async function ensureSignedIn(box = ui.errorBox) {
  if (!puterAvailable()) {
    showError('puterMissing', { box });
    return false;
  }
  if (Auth.isSignedIn()) return true;
  try {
    await Auth.signIn();
  } catch (err) {
    showError(Errors.classify(err) === 'network' ? err : 'auth', { box });
    console.warn(LOG_PREFIX, 'Sign-in failed or was cancelled', err);
    return false;
  }
  await onSignedIn();
  return true;
}

async function onSignedIn() {
  state.user = await Auth.getUser();
  renderAuth();
  if (state.user?.username) toast(t('signedIn', state.user.username));
  Voices.load();
  Engines.load();
  translator?.onSignedIn();
}

async function handleSignIn() {
  if (!puterAvailable()) return showError('puterMissing');
  try {
    await Auth.signIn();
    hideError();
    await onSignedIn();
  } catch (err) {
    console.warn(LOG_PREFIX, 'Sign-in failed or was cancelled', err);
    showError(Errors.classify(err) === 'network' ? err : 'auth');
  }
}

async function handleSignOut() {
  try {
    await Auth.signOut();
  } catch (err) {
    console.warn(LOG_PREFIX, 'Sign-out failed', err);
  }
  state.user = null;
  state.availableModels = null;
  state.pricing.clear();
  renderAuth();
  renderModels();
  renderStats();
  Voices.load();
  translator?.onSignedOut();
  toast(t('signedOut'));
}

function validateInput() {
  const text = Chunker.normalize(ui.textInput.value);
  if (!text) {
    showError('empty');
    ui.textInput.focus();
    return null;
  }
  if (text.length > CONFIG.maxTotalChars) {
    showError('tooLongTotal');
    return null;
  }
  if (!Voices.current() || (state.prefs.voiceId === CUSTOM_VOICE && !isPlausibleVoice(state.prefs.customVoice))) {
    showError('voiceInvalid');
    ui.customVoiceInput.setAttribute('aria-invalid', 'true');
    ui.customVoiceInput.focus();
    return null;
  }
  return text;
}

function isPlausibleVoice(value) {
  const v = value.trim();
  return VOICE_ID_PATTERN.test(v) || (v.length >= 2 && v.length <= 100);
}

async function onGenerate() {
  if (state.busy) return;
  hideError();
  const text = validateInput();
  if (!text) return;
  if (!(await ensureSignedIn())) return;

  const chunks = Chunker.split(text);
  state.job = {
    id: `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    chunks,
    results: new Array(chunks.length).fill(null),
    params: snapshotParams(),
    skipSettings: false,
    settingsIgnored: false,
    cursor: 0,
  };
  resetOutput();
  await runJob(0);
}

async function resumeJob(fromIndex) {
  if (state.busy || !state.job) return;
  hideError();
  if (!(await ensureSignedIn())) return;
  await runJob(fromIndex);
}

function discardJob() {
  state.job = null;
  hideProgress();
  hideError();
}

async function runJob(fromIndex) {
  const job = state.job;
  const total = job.chunks.length;
  setBusy(true);
  renderProgress(job, fromIndex, 'running');

  for (let i = fromIndex; i < total; i++) {
    job.cursor = i;
    if (state.cancelRequested) {
      setBusy(false);
      renderProgress(job, i, 'stopped');
      return;
    }
    renderProgress(job, i, 'running');
    try {
      const { blob, settingsIgnored } = await TTS.synthesize(job.chunks[i], { ...job.params, skipSettings: job.skipSettings });
      job.results[i] = blob;
      if (settingsIgnored) job.skipSettings = job.settingsIgnored = true;
    } catch (err) {
      setBusy(false);
      renderProgress(job, i, 'failed');
      const actions = total > 1 ? [] : [{ label: t('retry'), primary: true, onClick: () => resumeJob(i) }];
      showError(err, { context: `txt2speech chunk ${i + 1}/${total} (${job.chunks[i].length} chars)`, actions });
      return;
    }
  }

  await finishJob(job);
}

/** Merges finished chunks, shows the result and records it in history. */
async function finishJob(job, { partial = false } = {}) {
  const firstMissing = job.results.indexOf(null);
  const blobs = partial && firstMissing !== -1 ? job.results.slice(0, firstMissing) : job.results;
  const format = formatById(job.params.format);
  setBusy(true);
  renderProgress(job, job.cursor, 'merging');

  let merged = null;
  let mergeFailed = false;
  if (blobs.length === 1) {
    merged = blobs[0];
  } else if (format.merge) {
    try {
      merged = await AudioTools.merge(blobs, format);
    } catch (err) {
      console.error(LOG_PREFIX, 'Merging failed; offering parts instead', err);
      mergeFailed = true;
    }
  }

  const createdAt = new Date().toISOString();
  const chars = job.chunks.slice(0, blobs.length).reduce((sum, c) => sum + c.length, 0);
  const output = {
    id: job.id,
    historyId: job.id,
    merged,
    parts: merged ? [merged] : blobs,
    meta: {
      createdAt,
      voiceName: job.params.voiceName,
      model: job.params.model,
      format: job.params.format,
      chars,
      parts: blobs.length,
      totalParts: job.chunks.length,
      mergeFailed,
      settingsIgnored: job.settingsIgnored,
      testMode: CONFIG.testMode,
      duration: null,
    },
  };

  state.job = null;
  setBusy(false);
  hideProgress();

  const text = partial ? job.chunks.slice(0, blobs.length).join('\n\n') : job.text;
  // Not awaited: the result must never wait on storage.
  History.add({
    id: job.id,
    createdAt,
    text: text.slice(0, CONFIG.historyTextLimit),
    excerpt: text.slice(0, 180),
    chars,
    parts: blobs.length,
    totalParts: job.chunks.length,
    voiceId: job.params.voicePref,
    customVoice: job.params.voicePref === CUSTOM_VOICE ? job.params.customVoice : '',
    voiceName: job.params.voiceName,
    model: job.params.model,
    format: job.params.format,
    settings: job.params.settings,
    mergeFailed,
    settingsIgnored: job.settingsIgnored,
    testMode: CONFIG.testMode,
    duration: null,
  }, merged ? { merged } : { parts: blobs }).then(renderHistory);

  await showOutput(output, { autoplay: state.prefs.autoplay });
}

function onCancel() {
  if (!state.busy) return;
  state.cancelRequested = true;
  renderGenerateButton();
  if (state.job) renderProgress(state.job, state.job.cursor, 'running');
}

async function onSample() {
  if (state.busy || state.sampleBusy) return;
  hideError();
  if (state.prefs.voiceId === CUSTOM_VOICE && !isPlausibleVoice(state.prefs.customVoice)) {
    showError('voiceInvalid');
    return;
  }
  if (!(await ensureSignedIn())) return;

  state.sampleBusy = true;
  renderGenerateButton();
  try {
    const params = snapshotParams();
    const { blob } = await TTS.synthesize(t('sampleText'), { ...params, format: CONFIG.defaultFormat });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
    await audio.play().catch((err) => console.info(LOG_PREFIX, 'Sample playback blocked', err));
  } catch (err) {
    showError(err, { context: 'voice sample' });
  } finally {
    state.sampleBusy = false;
    renderGenerateButton();
  }
}

function downloadParts(parts, createdAt, ext) {
  // Stagger downloads; browsers may block several simultaneous ones.
  parts.forEach((blob, i) => setTimeout(() => {
    downloadBlob(blob, buildFilename(createdAt, ext, { index: i + 1, total: parts.length }));
  }, i * 400));
}

// ---- Text input helpers ----

const saveDraft = debounce(() => {
  const value = ui.textInput.value;
  if (value.length <= CONFIG.maxTotalChars * 2) Store.set(DRAFT_KEY, value);
}, 400);

/** Decodes a text file as UTF-8, falling back to Windows-1251. */
async function readFileText(file) {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    // Older Mongolian (and Russian) documents are often Windows-1251 encoded.
    return new TextDecoder('windows-1251').decode(buffer);
  }
}

async function readTextFile(file) {
  const isText = file.type.startsWith('text/') || /\.txt$/i.test(file.name);
  if (!isText) return toast(t('importType'));
  if (file.size > CONFIG.maxImportBytes) return toast(t('importSize'));
  try {
    ui.textInput.value = await readFileText(file);
    onTextChanged();
    ui.textInput.focus();
    toast(t('imported', file.name));
  } catch (err) {
    console.error(LOG_PREFIX, 'File import failed', err);
    toast(t('importRead'));
  }
}

function onTextChanged() {
  renderStats();
  saveDraft();
}

async function onCopy() {
  const text = ui.textInput.value;
  if (!text.trim()) return toast(t('nothingToCopy'));
  try {
    await navigator.clipboard.writeText(text);
    toast(t('copied'));
  } catch {
    ui.textInput.select();
    const ok = document.execCommand?.('copy');
    toast(ok ? t('copied') : t('copyFailed'));
  }
}

function onClear() {
  if (state.busy) return;
  ui.textInput.value = '';
  onTextChanged();
  hideError();
  if (state.job) discardJob();
  resetOutput();
  ui.textInput.focus();
  toast(t('cleared'));
}

// ==========================================================================
// 14. Event wiring & init
// ==========================================================================

const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');

/** Shows `overlay` while a file is dragged over `zone`; passes a dropped file to `onFile`. */
function bindDropZone(zone, overlay, onFile) {
  let depth = 0;
  zone.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    overlay.hidden = false;
  });
  zone.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  zone.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) overlay.hidden = true;
  });
  zone.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    overlay.hidden = true;
    const [file] = e.dataTransfer.files;
    if (file) onFile(file);
  });
}

function setView(view) {
  state.prefs.view = view;
  savePrefs();
  for (const tab of document.querySelectorAll('.view-tab')) {
    const selected = tab.dataset.view === view;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  $('ttsView').hidden = view !== 'tts';
  $('translateView').hidden = view !== 'translate';
}

function sendToVoiceOver(text) {
  ui.textInput.value = text;
  onTextChanged();
  hideError();
  setView('tts');
  ui.textInput.focus();
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

function bindEvents() {
  ui.langToggle.addEventListener('click', () => {
    state.prefs.lang = state.prefs.lang === 'mn' ? 'en' : 'mn';
    savePrefs();
    applyLanguage();
  });

  ui.themeToggle.addEventListener('click', () => {
    const order = ['system', 'light', 'dark'];
    state.prefs.theme = order[(order.indexOf(state.prefs.theme) + 1) % order.length];
    savePrefs();
    applyTheme();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => waveform?.draw());

  ui.signInBtn.addEventListener('click', handleSignIn);
  ui.noticeSignInBtn.addEventListener('click', handleSignIn);
  ui.signOutBtn.addEventListener('click', handleSignOut);

  ui.textInput.addEventListener('input', onTextChanged);
  ui.importBtn.addEventListener('click', () => ui.fileInput.click());
  ui.fileInput.addEventListener('change', () => {
    const [file] = ui.fileInput.files;
    if (file) readTextFile(file);
    ui.fileInput.value = '';
  });
  ui.copyBtn.addEventListener('click', onCopy);
  ui.clearBtn.addEventListener('click', onClear);

  bindDropZone(ui.dropZone, ui.dropOverlay, readTextFile);
  // Stop the browser from opening files dropped outside the editor.
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => { if (hasFiles(e)) e.preventDefault(); });

  ui.voiceSelect.addEventListener('change', () => {
    state.prefs.voiceId = ui.voiceSelect.value;
    const voice = Voices.find(state.prefs.voiceId);
    if (voice) state.prefs.voiceName = Voices.shortName(voice);
    savePrefs();
    ui.customVoiceGroup.hidden = state.prefs.voiceId !== CUSTOM_VOICE;
    renderVoiceMeta();
    if (state.prefs.voiceId === CUSTOM_VOICE) ui.customVoiceInput.focus();
  });
  ui.voiceSearch.addEventListener('input', () => {
    state.voiceFilter = ui.voiceSearch.value;
    renderVoices();
  });
  ui.customVoiceInput.addEventListener('input', () => {
    state.prefs.customVoice = ui.customVoiceInput.value.trim();
    ui.customVoiceInput.removeAttribute('aria-invalid');
    savePrefs();
  });
  ui.sampleBtn.addEventListener('click', onSample);

  ui.modelSelect.addEventListener('change', () => {
    state.prefs.model = ui.modelSelect.value;
    savePrefs();
    ui.modelHint.textContent = t(`model_${state.prefs.model}`);
    renderSettings();
    renderStats();
  });
  ui.formatSelect.addEventListener('change', () => {
    state.prefs.format = ui.formatSelect.value;
    savePrefs();
    ui.formatHint.textContent = t(`format_${formatById(state.prefs.format).family}`);
  });

  const bindSlider = (input, key) => input.addEventListener('input', () => {
    state.prefs.settings[key] = Number(input.value);
    savePrefs();
    renderSettings();
  });
  bindSlider(ui.stabilityInput, 'stability');
  bindSlider(ui.similarityInput, 'similarity');
  bindSlider(ui.styleInput, 'style');
  bindSlider(ui.speedInput, 'speed');
  ui.stabilityPresets.addEventListener('change', (e) => {
    state.prefs.settings.stability = Number(e.target.value);
    savePrefs();
    renderSettings();
  });
  ui.resetSettingsBtn.addEventListener('click', () => {
    state.prefs.settings = { ...CONFIG.defaultSettings };
    savePrefs();
    renderSettings();
  });
  ui.autoplayInput.addEventListener('change', () => {
    state.prefs.autoplay = ui.autoplayInput.checked;
    savePrefs();
  });

  ui.generateBtn.addEventListener('click', onGenerate);
  ui.cancelBtn.addEventListener('click', onCancel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing) {
      e.preventDefault();
      if (state.prefs.view === 'translate') translator.translate();
      else onGenerate();
    }
  });

  document.querySelectorAll('.alert-close').forEach((btn) => btn.addEventListener('click', () => { btn.closest('.alert').hidden = true; }));

  const tabs = [...document.querySelectorAll('.view-tab')];
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => setView(tab.dataset.view));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      setView(next.dataset.view);
      next.focus();
    });
  });

  ui.downloadBtn.addEventListener('click', () => {
    const output = state.output;
    if (!output?.merged) return;
    downloadBlob(output.merged, buildFilename(output.meta.createdAt, formatById(output.meta.format).ext));
  });
  ui.replayBtn.addEventListener('click', () => {
    ui.player.currentTime = 0;
    ui.player.play().catch((err) => console.info(LOG_PREFIX, 'Replay blocked', err));
  });
  ui.downloadAllBtn.addEventListener('click', () => {
    const output = state.output;
    if (output) downloadParts(output.parts, output.meta.createdAt, formatById(output.meta.format).ext);
  });
  ui.player.addEventListener('loadedmetadata', () => {
    if (state.output && !state.output.meta.duration && Number.isFinite(ui.player.duration)) {
      ui.resultDuration.textContent = fmtDuration(ui.player.duration);
    }
  });

  ui.clearHistoryBtn.addEventListener('click', onClearHistory);

  window.addEventListener('beforeunload', (e) => {
    if (!state.busy && !translator?.isBusy()) return;
    e.preventDefault();
    e.returnValue = t('leaveWarning');
  });
}

function createTranslatorView() {
  const box = $('trErrorBox');
  return createTranslator({
    t, el, $, Store, toast, debounce, fmtNum, timestamp, downloadText, readFileText, bindDropZone, sendToVoiceOver,
    showError: (err, opts = {}) => showError(err, { ...opts, box }),
    hideError: () => hideError(box),
    ensureSignedIn: () => ensureSignedIn(box),
    puterAvailable,
    isSignedIn: () => Auth.isSignedIn(),
    lang: () => state.prefs.lang,
    logPrefix: LOG_PREFIX,
    testMode: CONFIG.testMode,
  });
}

async function init() {
  cacheDom();
  waveform = new Waveform(ui.waveform, ui.player);
  bindEvents();
  translator = createTranslatorView();
  translator.init();
  setView(state.prefs.view);

  ui.textInput.value = Store.get(DRAFT_KEY, '') || '';
  state.voices = builtinVoices();
  applyLanguage();

  if (!puterAvailable()) {
    console.error(LOG_PREFIX, 'Puter.js is not available; check that https://js.puter.com/v2/ loaded.');
    showError('puterMissing');
    renderAuth();
    return;
  }
  if (CONFIG.testMode) console.info(LOG_PREFIX, 'Test mode is on: Puter returns sample audio and charges nothing.');

  if (Auth.isSignedIn()) {
    state.user = await Auth.getUser();
    renderAuth();
    Voices.load();
    Engines.load();
    translator.onSignedIn();
  }
}

init();

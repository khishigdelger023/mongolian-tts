/*
 * Transcript translation for Өгүүлэгч.
 *
 * Translates film transcripts and subtitles (SRT, WebVTT, plain text) with
 * `puter.ai.chat()`. Timestamps and cue structure are kept; only dialogue is
 * sent to the model, in batches that carry the previous lines as context.
 *
 * API reference: https://docs.puter.com/AI/chat/
 *
 * The UI side is created by `createTranslator(deps)`; app.js injects the
 * shared helpers (i18n, storage, errors, auth) so this module has no imports.
 */

// ==========================================================================
// Config
// ==========================================================================

const TR_CONFIG = {
  storageKey: 'mntts.translation',
  maxItemsPerBatch: 40,
  maxCharsPerBatch: 3500,
  contextPairs: 6,
  maxImportBytes: 5 * 1024 * 1024,
  defaultModel: 'claude-sonnet-4-6',
  defaultFrom: 'auto',
  defaultTo: 'mn',
  defaultStyle: 'dub',
  // Shown only when puter.ai.listModels() includes them (or when listing is
  // unavailable and `listedOnly` is false). Order is the preference order.
  models: [
    { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', listedOnly: true },
    { id: 'claude-opus-4-8', name: 'Claude Opus 4.8' },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
    { id: 'gpt-5.5', name: 'GPT-5.5' },
    { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
    { id: 'gpt-5.4-nano', name: 'GPT-5.4 nano' },
  ],
  languages: [
    { code: 'mn', en: 'Mongolian', mn: 'Монгол' },
    { code: 'en', en: 'English', mn: 'Англи' },
    { code: 'ru', en: 'Russian', mn: 'Орос' },
    { code: 'ko', en: 'Korean', mn: 'Солонгос' },
    { code: 'ja', en: 'Japanese', mn: 'Япон' },
    { code: 'zh', en: 'Chinese', mn: 'Хятад' },
    { code: 'tr', en: 'Turkish', mn: 'Турк' },
    { code: 'de', en: 'German', mn: 'Герман' },
    { code: 'fr', en: 'French', mn: 'Франц' },
    { code: 'es', en: 'Spanish', mn: 'Испани' },
    { code: 'it', en: 'Italian', mn: 'Итали' },
    { code: 'hi', en: 'Hindi', mn: 'Хинди' },
  ],
};

// ==========================================================================
// Strings (merged into app.js STRINGS)
// ==========================================================================

export const TRANSLATE_STRINGS = {
  mn: {
    viewTabs: 'Горим',
    tabTts: 'Текстээс яриа',
    tabTranslate: 'Транскрипт орчуулах',
    trSourceLabel: 'Эх транскрипт',
    trSourcePlaceholder: 'Киноны транскрипт эсвэл хадмалаа (.srt, .vtt) энд буулгана уу...',
    trImport: 'Файл оруулах',
    trDrop: '.srt, .vtt эсвэл .txt файлаа энд тавина уу',
    trFormat_srt: 'SRT хадмал',
    trFormat_vtt: 'WebVTT хадмал',
    trFormat_text: 'Энгийн текст',
    trUnits: (n) => `${n} мөр`,
    trBatches: (n) => `${n} хүсэлтээр орчуулна`,
    trControlsTitle: 'Орчуулгын тохиргоо',
    trFrom: 'Эх хэл',
    trTo: 'Орчуулах хэл',
    trAuto: 'Автомат',
    trModel: 'Орчуулгын загвар',
    trModelHint: 'Том загвар илүү чанартай орчуулдаг ч удаан, үнэтэй.',
    trModelsListed: (n) => `Puter дээр ${n} загвар боломжтой.`,
    trStyle: 'Орчуулгын хэв маяг',
    trStyle_dub: 'Дуу оруулгад (ярианы хэл)',
    trStyle_sub: 'Хадмалд (товч)',
    trStyleHint_dub: 'Чангаар уншихад эвтэйхэн, байгалийн ярианы хэлээр орчуулна.',
    trStyleHint_sub: 'Дэлгэцэн дээр хурдан уншихад хялбар, товч орчуулна.',
    trNotes: 'Киноны тухай тэмдэглэл',
    trNotesPlaceholder: 'Жишээ нь: «Inception», адал явдалт. Cobb → Кобб (эрэгтэй), Ariadne → Ариадна (эмэгтэй).',
    trNotesHint: 'Дүрийн нэр, хүйс, нэр томьёог бичвэл орчуулга тогтвортой болно. Заавал биш.',
    trTranslate: 'Орчуулах',
    trSignInAndTranslate: 'Нэвтэрч орчуулах',
    trTranslating: 'Орчуулж байна…',
    trProgress: (i, n) => `${n} хэсгийн ${i}-р хэсгийг орчуулж байна…`,
    trProgressSingle: 'Орчуулж байна…',
    trCancelling: 'Одоогийн хэсгийг зогсоож байна…',
    trStopped: (d, n) => `Зогсоолоо. ${n} хэсгээс ${d} нь орчуулагдсан.`,
    trFailedAt: (i, n) => `${i}-р хэсэгт алдаа гарлаа (нийт ${n}).`,
    trResume: (i) => `${i}-р хэсгээс үргэлжлүүлэх`,
    trRestored: 'Өмнөх орчуулга дуусаагүй байна.',
    trDone: 'Орчуулж дууслаа',
    trResultLabel: 'Орчуулга',
    trResultPlaceholder: 'Орчуулга энд гарна. Гарсны дараа засварлаж болно.',
    trDownload: (ext) => `${ext} татах`,
    trToVoice: 'Яриа болгох',
    trToVoiceHint: 'Цагийн тэмдэглэгээ, тэмдэглэгээ, [дуу чимээ]-г хасаад «Текстээс яриа» руу шилжүүлнэ.',
    trTimingKept: 'Цагийн тэмдэглэгээ, дугаарлалт өөрчлөгдөөгүй.',
    trSentToVoice: 'Орчуулгыг «Текстээс яриа» руу шилжүүллээ',
    trNothing: 'Орчуулах текст алга',
    trNothingToSend: 'Яриа болгох орчуулга алга',
    trImportType: 'Зөвхөн .srt, .vtt, .txt файл оруулах боломжтой.',
    trImportSize: 'Файл хэт том байна. 5 МБ хүртэл файл оруулна уу.',
    trTestMode: 'Туршилтын горим: орчуулгын оронд эх текстийг [test] тэмдэгтэйгээр буцаалаа.',
    errors: {
      translateParse: ['Орчуулгын хариуг уншиж чадсангүй', 'Загвар буруу хэлбэрээр хариулсан. Дахин оролдох эсвэл өөр загвар сонгоно уу.'],
      translateEmpty: ['Транскрипт оруулаагүй байна', 'Транскрипт буулгах эсвэл .srt, .vtt, .txt файл оруулна уу.'],
    },
  },
  en: {
    viewTabs: 'Mode',
    tabTts: 'Text to speech',
    tabTranslate: 'Translate transcript',
    trSourceLabel: 'Source transcript',
    trSourcePlaceholder: 'Paste a film transcript or subtitles (.srt, .vtt) here...',
    trImport: 'Import file',
    trDrop: 'Drop a .srt, .vtt or .txt file here',
    trFormat_srt: 'SRT subtitles',
    trFormat_vtt: 'WebVTT subtitles',
    trFormat_text: 'Plain text',
    trUnits: (n) => `${n} lines`,
    trBatches: (n) => `Translated in ${n} requests`,
    trControlsTitle: 'Translation settings',
    trFrom: 'From',
    trTo: 'To',
    trAuto: 'Auto-detect',
    trModel: 'Translation model',
    trModelHint: 'Larger models translate better but are slower and cost more.',
    trModelsListed: (n) => `${n} models available on Puter.`,
    trStyle: 'Style',
    trStyle_dub: 'For voice-over (spoken)',
    trStyle_sub: 'For subtitles (concise)',
    trStyleHint_dub: 'Natural, spoken phrasing that reads well aloud.',
    trStyleHint_sub: 'Short lines that are quick to read on screen.',
    trNotes: 'Notes about the film',
    trNotesPlaceholder: 'For example: “Inception”, action. Cobb → Кобб (male), Ariadne → Ариадна (female).',
    trNotesHint: 'Character names, genders and terms keep the translation consistent. Optional.',
    trTranslate: 'Translate',
    trSignInAndTranslate: 'Sign in and translate',
    trTranslating: 'Translating…',
    trProgress: (i, n) => `Translating ${i} of ${n}…`,
    trProgressSingle: 'Translating…',
    trCancelling: 'Stopping the current part…',
    trStopped: (d, n) => `Stopped. ${d} of ${n} parts translated.`,
    trFailedAt: (i, n) => `Part ${i} of ${n} failed.`,
    trResume: (i) => `Continue from part ${i}`,
    trRestored: 'Your previous translation isn’t finished.',
    trDone: 'Translation finished',
    trResultLabel: 'Translation',
    trResultPlaceholder: 'The translation appears here. You can edit it afterwards.',
    trDownload: (ext) => `Download ${ext}`,
    trToVoice: 'Turn into speech',
    trToVoiceHint: 'Removes timestamps, markup and [sound cues], then moves the text to Text to speech.',
    trTimingKept: 'Timestamps and numbering are unchanged.',
    trSentToVoice: 'Translation moved to Text to speech',
    trNothing: 'There’s nothing to translate',
    trNothingToSend: 'There’s no translation to turn into speech',
    trImportType: 'Only .srt, .vtt and .txt files can be imported.',
    trImportSize: 'That file is too large. Import files up to 5 MB.',
    trTestMode: 'Test mode: the source text was returned with a [test] marker instead of a translation.',
    errors: {
      translateParse: ['The translation reply couldn’t be read', 'The model answered in the wrong shape. Try again or choose a different model.'],
      translateEmpty: ['There’s no transcript yet', 'Paste a transcript or import a .srt, .vtt or .txt file.'],
    },
  },
};

// ==========================================================================
// Transcript parsing (pure; exported for tests)
// ==========================================================================

const TIMING_RE = /(?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{1,3}\s*-->\s*(?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{1,3}/;
const VTT_META_RE = /^(NOTE|STYLE|REGION)\b/;

/**
 * Parses a transcript into blocks. Cue blocks carry `head` lines (index,
 * timing) that are kept verbatim and `text` that gets translated.
 * Plain text becomes one cue per non-empty line.
 */
export function parseTranscript(raw) {
  const text = String(raw ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const trimmed = text.trim();
  const format = /^WEBVTT/.test(trimmed) ? 'vtt' : TIMING_RE.test(trimmed) ? 'srt' : 'text';

  if (format === 'text') {
    const blocks = text.split('\n').map((line) => (line.trim()
      ? { cue: true, head: [], text: line.trim() }
      : { cue: false, raw: '' }));
    while (blocks.length && !blocks[blocks.length - 1].cue) blocks.pop();
    return { format, sep: '\n', blocks };
  }

  const blocks = trimmed.split(/\n[ \t]*\n+/).map((block) => {
    const lines = block.split('\n');
    const timing = lines.findIndex((l) => TIMING_RE.test(l));
    if (timing === -1 || VTT_META_RE.test(lines[0])) return { cue: false, raw: block };
    return { cue: true, head: lines.slice(0, timing + 1), text: lines.slice(timing + 1).join('\n').trim() };
  });
  return { format, sep: '\n\n', blocks };
}

/** Rebuilds the transcript, substituting translations by block index. */
export function serializeTranscript(doc, translations = new Map(), { uptoBlock = Infinity } = {}) {
  const parts = [];
  doc.blocks.forEach((block, i) => {
    if (i > uptoBlock) return;
    if (!block.cue) parts.push(block.raw);
    else parts.push([...block.head, translations.has(i) ? translations.get(i) : block.text].filter((l, j, arr) => l !== '' || j < arr.length - 1).join('\n'));
  });
  const out = parts.join(doc.sep);
  return doc.format === 'text' ? out : `${out}\n`;
}

/** Translatable units: cue blocks with non-empty text. */
export function transcriptUnits(doc) {
  return doc.blocks.flatMap((block, index) => (block.cue && block.text ? [{ block: index, text: block.text }] : []));
}

/** Groups units into request-sized batches of unit indices. */
export function makeBatches(units, maxItems = TR_CONFIG.maxItemsPerBatch, maxChars = TR_CONFIG.maxCharsPerBatch) {
  const batches = [];
  let current = [];
  let chars = 0;
  units.forEach((unit, i) => {
    if (current.length && (current.length >= maxItems || chars + unit.text.length > maxChars)) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(i);
    chars += unit.text.length;
  });
  if (current.length) batches.push(current);
  return batches;
}

/** Spoken text for voice-over: no timestamps, markup, speaker dashes or [sound cues]. */
export function transcriptToSpeech(raw) {
  const doc = parseTranscript(raw);
  const texts = doc.format === 'text' ? doc.blocks.filter((b) => b.cue).map((b) => b.text) : transcriptUnits(doc).map((u) => u.text);
  return texts
    .map((t) => t
      .replace(/<[^>]+>/g, '')
      .replace(/\{\\[^}]*\}/g, '')
      .replace(/\[[^\]]*\]|♪|♫/g, '')
      .replace(/^\s*[-–—]\s*/gm, '')
      .replace(/[ \t]+/g, ' ')
      .split('\n').map((l) => l.trim()).filter(Boolean).join(' '))
    .filter(Boolean)
    .join('\n');
}

export class TranslateParseError extends Error {
  constructor(message) {
    super(message);
    this.code = 'translate_parse';
  }
}

/** Extracts exactly `expected` strings from a model reply. */
export function parseTranslationReply(content, expected) {
  let s = String(content ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = s.search(/[[{]/);
  const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (start === -1 || end < start) throw new TranslateParseError('Reply contains no JSON');
  let data;
  try {
    data = JSON.parse(s.slice(start, end + 1));
  } catch (err) {
    throw new TranslateParseError(`Reply is not valid JSON: ${err.message}`);
  }
  const list = Array.isArray(data) ? data : data?.t ?? data?.translations ?? data?.items;
  if (!Array.isArray(list)) throw new TranslateParseError('Reply has no translation list');
  const out = list.map((x) => (typeof x === 'string' ? x : x?.text ?? x?.t));
  if (out.length !== expected) throw new TranslateParseError(`Expected ${expected} translations, got ${out.length}`);
  if (out.some((v) => typeof v !== 'string')) throw new TranslateParseError('Reply contains non-text items');
  return out.map((v) => v.trim());
}

/** Text content of a puter.ai.chat() response in either OpenAI or vendor shape. */
export function chatText(res) {
  if (typeof res === 'string') return res;
  const content = res?.message?.content ?? res?.content ?? res?.text;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((p) => (typeof p === 'string' ? p : p?.text ?? '')).join('');
  return res == null ? '' : String(res);
}

function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// ==========================================================================
// Prompt
// ==========================================================================

const langName = (code) => TR_CONFIG.languages.find((l) => l.code === code)?.en || code;

function buildMessages(items, previous, settings) {
  const target = langName(settings.to);
  const source = settings.from === 'auto' ? 'the source language (detect it)' : langName(settings.from);
  const style = settings.style === 'sub'
    ? 'The translation will be shown as subtitles. Keep lines short and quick to read; condense when needed but keep the meaning.'
    : `The translation will be read aloud as a voice-over. Use natural, spoken, idiomatic ${target} that sounds like real people talking, and keep each line about as long as the original so it fits the scene.`;
  const script = settings.to === 'mn'
    ? 'Write in Mongolian Cyrillic with correct modern spelling and natural Mongolian word order. Transliterate foreign personal names into Mongolian Cyrillic and keep them consistent.'
    : '';

  const system = [
    'You are an expert film and TV translator.',
    `Translate dialogue from ${source} into ${target}.`,
    style,
    script,
    'Rules:',
    '- The user sends JSON with "items": an array of {"id", "text"}, and optionally "previous": already translated lines for context only.',
    '- Reply with ONLY a JSON object {"t": [...]} containing exactly one translated string per item, in the same order. Never merge, split, skip or reorder items.',
    '- Keep inline markup such as <i>, </i>, <b>, {\\an8} and line breaks ("\\n") where they belong.',
    '- Translate sound descriptions such as [door slams] inside the same brackets.',
    `- If an item is already in ${target}, or is only a name or number, return it unchanged.`,
    '- No notes, explanations or code fences.',
    settings.notes ? `Notes from the user about this film (names, genders, terminology). Follow them:\n${settings.notes}` : '',
  ].filter(Boolean).join('\n');

  const user = JSON.stringify({
    ...(previous.length ? { previous } : {}),
    items: items.map((text, i) => ({ id: i + 1, text })),
  });
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

// ==========================================================================
// UI controller
// ==========================================================================

/**
 * deps: { t, el, $, Store, toast, showError, hideError, ensureSignedIn,
 *         puterAvailable, isSignedIn, downloadText, timestamp, fmtNum, debounce,
 *         lang, sendToVoiceOver, readFileText, bindDropZone, logPrefix, testMode }
 */
export function createTranslator(deps) {
  const { t, el, $ } = deps;
  const ui = {};
  const state = {
    prefs: { from: TR_CONFIG.defaultFrom, to: TR_CONFIG.defaultTo, model: TR_CONFIG.defaultModel, style: TR_CONFIG.defaultStyle, notes: '' },
    source: '',
    filename: '',
    output: '',
    listedModels: null,
    job: null,
    busy: false,
    controller: null,
    cancelRequested: false,
  };

  // ---- Persistence ----

  function save() {
    const job = state.job && {
      hash: state.job.hash,
      results: state.job.results,
      cursor: state.job.cursor,
    };
    deps.Store.set(TR_CONFIG.storageKey, {
      prefs: state.prefs,
      source: state.source,
      filename: state.filename,
      output: state.output,
      job,
    });
  }
  const saveSoon = deps.debounce(save, 400);

  function load() {
    const saved = deps.Store.get(TR_CONFIG.storageKey, null);
    if (!saved || typeof saved !== 'object') return;
    Object.assign(state.prefs, saved.prefs || {});
    state.source = typeof saved.source === 'string' ? saved.source : '';
    state.filename = typeof saved.filename === 'string' ? saved.filename : '';
    state.output = typeof saved.output === 'string' ? saved.output : '';
    if (saved.job && Array.isArray(saved.job.results) && state.source) {
      const job = buildJob();
      if (job && job.hash === saved.job.hash && saved.job.results.length === job.results.length) {
        job.results = saved.job.results;
        job.cursor = firstPendingBatch(job);
        state.job = job;
      }
    }
  }

  // ---- Jobs ----

  function settingsKey() {
    const { from, to, model, style, notes } = state.prefs;
    return JSON.stringify({ from, to, model, style, notes });
  }

  function buildJob() {
    const doc = parseTranscript(state.source);
    const units = transcriptUnits(doc);
    if (!units.length) return null;
    return {
      hash: hashString(`${settingsKey()}\u0000${state.source}`),
      doc,
      units,
      batches: makeBatches(units),
      results: new Array(units.length).fill(null),
      settings: { ...state.prefs },
      cursor: 0,
      testMode: false,
    };
  }

  function batchOfUnit(job, unitIndex) {
    return job.batches.findIndex((b) => b.includes(unitIndex));
  }

  function translationsMap(job) {
    const map = new Map();
    job.units.forEach((unit, i) => { if (job.results[i] != null) map.set(unit.block, job.results[i]); });
    return map;
  }

  function previousPairs(job, beforeUnit) {
    const pairs = [];
    for (let i = beforeUnit - 1; i >= 0 && pairs.length < TR_CONFIG.contextPairs; i--) {
      if (job.results[i] != null) pairs.unshift({ source: job.units[i].text, translation: job.results[i] });
    }
    return pairs;
  }

  async function requestBatch(texts, previous, settings, signal) {
    if (deps.testMode) return texts.map((x) => `[test] ${x}`);
    const res = await puter.ai.chat(buildMessages(texts, previous, settings), false, {
      model: settings.model,
      temperature: 0.3,
      signal,
    });
    return parseTranslationReply(chatText(res), texts.length);
  }

  /** Translates texts; on a malformed reply retries once, then halves the batch. */
  async function translateTexts(texts, previous, settings, signal) {
    try {
      return await requestBatch(texts, previous, settings, signal);
    } catch (err) {
      if (!(err instanceof TranslateParseError)) throw err;
      console.warn(deps.logPrefix, `Malformed translation reply for ${texts.length} items; retrying`, err.message);
      if (texts.length === 1) return requestBatch(texts, previous, settings, signal);
      const mid = Math.ceil(texts.length / 2);
      const first = await translateTexts(texts.slice(0, mid), previous, settings, signal);
      const pairs = first.map((translation, i) => ({ source: texts[i], translation }));
      const second = await translateTexts(texts.slice(mid), [...previous, ...pairs].slice(-TR_CONFIG.contextPairs), settings, signal);
      return [...first, ...second];
    }
  }

  async function onTranslate() {
    if (state.busy) return;
    deps.hideError();
    readSourceFromUi();
    if (!state.source.trim() || !transcriptUnits(parseTranscript(state.source)).length) {
      deps.showError('translateEmpty');
      ui.source.focus();
      return;
    }
    if (!(await deps.ensureSignedIn())) return;

    // Resume when the same source and settings were partly translated.
    const fresh = buildJob();
    if (!state.job || state.job.hash !== fresh.hash || !state.job.results.includes(null)) {
      state.job = fresh;
    }
    await run(state.job.cursor || firstPendingBatch(state.job));
  }

  function firstPendingBatch(job) {
    const unit = job.results.indexOf(null);
    return unit === -1 ? job.batches.length : batchOfUnit(job, unit);
  }

  async function run(fromBatch) {
    const job = state.job;
    const total = job.batches.length;
    setBusy(true);
    ui.result.hidden = false;

    for (let b = fromBatch; b < total; b++) {
      job.cursor = b;
      if (state.cancelRequested) return stop(job, b, 'stopped');
      renderProgress(job, b, 'running');
      const batch = job.batches[b];
      if (batch.every((u) => job.results[u] != null)) continue;
      state.controller = new AbortController();
      try {
        const texts = batch.map((u) => job.units[u].text);
        const out = await translateTexts(texts, previousPairs(job, batch[0]), job.settings, state.controller.signal);
        batch.forEach((u, i) => { job.results[u] = out[i]; });
        job.testMode = deps.testMode;
        renderOutput(job, { partial: true });
        save();
      } catch (err) {
        if (err?.name === 'AbortError' || state.cancelRequested) return stop(job, b, 'stopped');
        stop(job, b, 'failed');
        deps.showError(err, { context: `puter.ai.chat translation batch ${b + 1}/${total} (${job.settings.model})` });
        return;
      } finally {
        state.controller = null;
      }
    }

    job.cursor = total;
    renderOutput(job, { partial: false });
    setBusy(false);
    ui.progress.hidden = true;
    save();
    deps.toast(t('trDone'));
  }

  function stop(job, batchIndex, mode) {
    setBusy(false);
    renderProgress(job, batchIndex, mode);
    save();
  }

  function onCancel() {
    if (!state.busy) return;
    state.cancelRequested = true;
    // Aborting stops waiting; Puter may still bill the in-flight request.
    state.controller?.abort();
    renderButtons();
    if (state.job) renderProgress(state.job, state.job.cursor, 'running');
  }

  function discard() {
    state.job = null;
    ui.progress.hidden = true;
    deps.hideError();
    save();
  }

  function setBusy(busy) {
    state.busy = busy;
    if (!busy) state.cancelRequested = false;
    renderButtons();
  }

  // ---- Rendering ----

  function renderButtons() {
    ui.translateBtn.classList.toggle('is-busy', state.busy);
    ui.translateBtn.disabled = state.busy || !deps.puterAvailable();
    ui.translateBtn.setAttribute('aria-busy', String(state.busy));
    ui.translateLabel.textContent = state.busy
      ? t('trTranslating')
      : deps.isSignedIn() || !deps.puterAvailable() ? t('trTranslate') : t('trSignInAndTranslate');
    ui.cancelBtn.hidden = !state.busy;
    ui.cancelBtn.disabled = state.cancelRequested;
    ui.clearBtn.disabled = state.busy;
    ui.importBtn.disabled = state.busy;
    ui.source.readOnly = state.busy;
  }

  function renderProgress(job, index, mode) {
    const n = job.batches.length;
    const doneBatches = job.batches.filter((b) => b.every((u) => job.results[u] != null)).length;
    ui.progress.hidden = false;
    ui.progress.dataset.state = mode;

    if (ui.segments.dataset.job !== job.hash) {
      ui.segments.dataset.job = job.hash;
      ui.segments.replaceChildren(...job.batches.map((b) => el('span', {
        class: 'segment',
        style: `flex-grow:${b.reduce((sum, u) => sum + job.units[u].text.length, 0)}`,
      })));
    }
    [...ui.segments.children].forEach((seg, i) => {
      const done = job.batches[i].every((u) => job.results[u] != null);
      seg.dataset.state = done ? 'done'
        : i === index && mode === 'running' ? 'active'
          : i === index && mode === 'failed' ? 'failed' : 'pending';
    });

    const labels = {
      running: state.cancelRequested ? t('trCancelling') : n === 1 ? t('trProgressSingle') : t('trProgress', index + 1, n),
      stopped: t('trStopped', doneBatches, n),
      failed: t('trFailedAt', index + 1, n),
      restored: t('trRestored'),
    };
    ui.progressLabel.textContent = labels[mode];
    ui.progressCount.textContent = `${Math.round((job.results.filter((r) => r != null).length / job.results.length) * 100)}%`;

    const actions = [];
    if (mode !== 'running') {
      const next = firstPendingBatch(job);
      actions.push(el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: t('trResume', next + 1), onclick: () => resume(next) }));
      actions.push(el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: t('discard'), onclick: discard }));
    }
    ui.progressActions.replaceChildren(...actions);
  }

  async function resume(fromBatch) {
    if (state.busy || !state.job) return;
    deps.hideError();
    if (!(await deps.ensureSignedIn())) return;
    await run(fromBatch);
  }

  function renderOutput(job, { partial }) {
    const map = translationsMap(job);
    // Batches complete in order, so a partial preview ends at the last
    // translated unit of the finished prefix.
    let upto = Infinity;
    const firstMissing = job.results.indexOf(null);
    if (partial && firstMissing !== -1) upto = firstMissing === 0 ? -1 : job.units[firstMissing - 1].block;
    state.output = upto < 0 ? '' : serializeTranscript(job.doc, map, { uptoBlock: upto });
    ui.output.value = state.output;
    renderResultMeta();
  }

  function renderResultMeta() {
    const doc = parseTranscript(state.output || state.source);
    const ext = { srt: 'SRT', vtt: 'VTT', text: 'TXT' }[doc.format];
    ui.downloadLabel.textContent = t('trDownload', ext);
    const notes = [];
    if (doc.format !== 'text') notes.push(t('trTimingKept'));
    if (state.job?.testMode) notes.push(t('trTestMode'));
    ui.resultNote.textContent = notes.join(' ');
    ui.result.hidden = !state.output;
  }

  function renderStats() {
    const doc = parseTranscript(ui.source.value);
    const units = transcriptUnits(doc);
    if (!units.length) {
      ui.format.textContent = '';
      ui.count.textContent = '';
      ui.batches.textContent = '';
      return;
    }
    ui.format.textContent = t(`trFormat_${doc.format}`);
    ui.count.textContent = t('trUnits', deps.fmtNum(units.length));
    const n = makeBatches(units).length;
    ui.batches.textContent = t('trBatches', deps.fmtNum(n));
  }
  const renderStatsSoon = deps.debounce(renderStats, 150);

  function renderSelects() {
    const lang = deps.lang();
    const langOption = (l) => el('option', { value: l.code, text: l[lang] || l.en });
    ui.from.replaceChildren(el('option', { value: 'auto', text: t('trAuto') }), ...TR_CONFIG.languages.map(langOption));
    ui.to.replaceChildren(...TR_CONFIG.languages.map(langOption));
    ui.from.value = state.prefs.from;
    ui.to.value = state.prefs.to;

    const models = availableModels();
    if (!models.some((m) => m.id === state.prefs.model)) state.prefs.model = models[0]?.id || TR_CONFIG.defaultModel;
    ui.model.replaceChildren(...models.map((m) => el('option', { value: m.id, text: m.name })));
    ui.model.value = state.prefs.model;
    ui.modelHint.textContent = t('trModelHint');

    ui.style.replaceChildren(...['dub', 'sub'].map((s) => el('option', { value: s, text: t(`trStyle_${s}`) })));
    ui.style.value = state.prefs.style;
    ui.styleHint.textContent = t(`trStyleHint_${state.prefs.style}`);
    ui.notes.value = state.prefs.notes;
  }

  function availableModels() {
    if (!state.listedModels) return TR_CONFIG.models.filter((m) => !m.listedOnly);
    const listed = TR_CONFIG.models.filter((m) => state.listedModels.has(m.id));
    return listed.length ? listed : TR_CONFIG.models.filter((m) => !m.listedOnly);
  }

  function render() {
    renderSelects();
    renderStats();
    renderButtons();
    renderResultMeta();
    if (state.job && !ui.progress.hidden) renderProgress(state.job, state.job.cursor, ui.progress.dataset.state || 'stopped');
  }

  // ---- Input ----

  function readSourceFromUi() {
    state.source = ui.source.value;
  }

  async function importFile(file) {
    const ok = /\.(srt|vtt|txt)$/i.test(file.name) || file.type.startsWith('text/');
    if (!ok) return deps.toast(t('trImportType'));
    if (file.size > TR_CONFIG.maxImportBytes) return deps.toast(t('trImportSize'));
    try {
      ui.source.value = await deps.readFileText(file);
      state.filename = file.name;
      onSourceInput();
      ui.source.focus();
      deps.toast(t('imported', file.name));
    } catch (err) {
      console.error(deps.logPrefix, 'Transcript import failed', err);
      deps.toast(t('importRead'));
    }
  }

  function onSourceInput() {
    readSourceFromUi();
    renderStatsSoon();
    saveSoon();
  }

  function onClear() {
    if (state.busy) return;
    ui.source.value = '';
    ui.output.value = '';
    state.source = '';
    state.output = '';
    state.filename = '';
    state.job = null;
    ui.progress.hidden = true;
    deps.hideError();
    renderStats();
    renderResultMeta();
    save();
    ui.source.focus();
    deps.toast(t('cleared'));
  }

  function outputFilename() {
    const doc = parseTranscript(state.output);
    const ext = { srt: 'srt', vtt: 'vtt', text: 'txt' }[doc.format];
    const to = state.job?.settings.to || state.prefs.to;
    if (state.filename) {
      // "Movie.en.srt" → "Movie.mn.srt"
      const base = state.filename.replace(/\.[^.]+$/, '').replace(/\.[a-z]{2,3}(-[A-Za-z]{2,4})?$/, '');
      return `${base}.${to}.${ext}`;
    }
    return `transcript-${to}-${deps.timestamp(new Date())}.${ext}`;
  }

  function onDownload() {
    state.output = ui.output.value;
    if (!state.output.trim()) return;
    const doc = parseTranscript(state.output);
    const mime = doc.format === 'vtt' ? 'text/vtt' : doc.format === 'srt' ? 'application/x-subrip' : 'text/plain';
    deps.downloadText(state.output, outputFilename(), mime);
  }

  async function onCopy() {
    const text = ui.output.value;
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      deps.toast(t('copied'));
    } catch {
      deps.toast(t('copyFailed'));
    }
  }

  function onToVoice() {
    const speech = transcriptToSpeech(ui.output.value);
    if (!speech) return deps.toast(t('trNothingToSend'));
    deps.sendToVoiceOver(speech);
    deps.toast(t('trSentToVoice'));
  }

  // ---- Lifecycle ----

  function init() {
    const ids = {
      source: 'trSource', importBtn: 'trImportBtn', clearBtn: 'trClearBtn', fileInput: 'trFileInput',
      dropZone: 'trDropZone', dropOverlay: 'trDropOverlay', format: 'trFormat', count: 'trCount',
      batches: 'trBatches', from: 'trFrom', to: 'trTo', model: 'trModel', modelHint: 'trModelHint',
      style: 'trStyle', styleHint: 'trStyleHint', notes: 'trNotes', translateBtn: 'trTranslateBtn',
      translateLabel: 'trTranslateLabel', cancelBtn: 'trCancelBtn', progress: 'trProgress',
      progressLabel: 'trProgressLabel', progressCount: 'trProgressCount', segments: 'trSegments',
      progressActions: 'trProgressActions', result: 'trResult', output: 'trOutput', copyBtn: 'trCopyBtn',
      downloadBtn: 'trDownloadBtn', downloadLabel: 'trDownloadLabel', toVoiceBtn: 'trToVoiceBtn',
      resultNote: 'trResultNote',
    };
    for (const [key, id] of Object.entries(ids)) ui[key] = $(id);

    load();
    ui.source.value = state.source;
    ui.output.value = state.output;

    ui.source.addEventListener('input', onSourceInput);
    ui.output.addEventListener('input', () => { state.output = ui.output.value; saveSoon(); });
    ui.importBtn.addEventListener('click', () => ui.fileInput.click());
    ui.fileInput.addEventListener('change', () => {
      const [file] = ui.fileInput.files;
      if (file) importFile(file);
      ui.fileInput.value = '';
    });
    ui.clearBtn.addEventListener('click', onClear);
    deps.bindDropZone(ui.dropZone, ui.dropOverlay, importFile);

    const bindPref = (node, key, after) => node.addEventListener(node.tagName === 'TEXTAREA' ? 'input' : 'change', () => {
      state.prefs[key] = node.value;
      saveSoon();
      after?.();
    });
    bindPref(ui.from, 'from');
    bindPref(ui.to, 'to');
    bindPref(ui.model, 'model');
    bindPref(ui.style, 'style', () => { ui.styleHint.textContent = t(`trStyleHint_${state.prefs.style}`); });
    bindPref(ui.notes, 'notes');

    ui.translateBtn.addEventListener('click', onTranslate);
    ui.cancelBtn.addEventListener('click', onCancel);
    ui.downloadBtn.addEventListener('click', onDownload);
    ui.copyBtn.addEventListener('click', onCopy);
    ui.toVoiceBtn.addEventListener('click', onToVoice);

    render();
    if (state.job && state.job.results.includes(null) && state.job.results.some((r) => r != null)) {
      renderProgress(state.job, firstPendingBatch(state.job), 'restored');
    }
  }

  async function onSignedIn() {
    try {
      const models = await puter.ai.listModels();
      const list = Array.isArray(models) ? models : [];
      if (list.length) {
        state.listedModels = new Set(list.flatMap((m) => [m.id, ...(Array.isArray(m.aliases) ? m.aliases : [])]));
        // Prefer the best listed model unless the user already picked one that exists.
        const saved = deps.Store.get(TR_CONFIG.storageKey, null);
        if (!saved?.prefs?.model || !state.listedModels.has(state.prefs.model)) {
          state.prefs.model = availableModels()[0]?.id || state.prefs.model;
        }
      }
    } catch (err) {
      console.info(deps.logPrefix, 'listModels unavailable; using the built-in translation model list', err);
    }
    render();
  }

  function onSignedOut() {
    state.listedModels = null;
    render();
  }

  return {
    init,
    render,
    onSignedIn,
    onSignedOut,
    translate: onTranslate,
    isBusy: () => state.busy,
  };
}

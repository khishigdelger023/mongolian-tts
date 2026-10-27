# Өгүүлэгч: Mongolian text-to-speech

A static single-page web app that turns Mongolian (Cyrillic) text into natural speech with ElevenLabs voices, through [Puter.js](https://docs.puter.com/). Paste text, pick a voice, generate, listen, and download the result as an MP3.

There is no backend and no API key. The whole app is `index.html`, `styles.css` and `app.js`.

## What it does

- Generates speech from Mongolian text with `puter.ai.txt2speech()` using `provider: "elevenlabs"`.
- Splits long text automatically, generates the parts in order with live progress, and joins them into **one downloadable file**.
- Loads the available ElevenLabs voices from Puter, with a configurable built-in list as a fallback and support for any custom voice ID.
- Offers only models that support Mongolian (`eleven_v3` by default, plus `eleven_v4` and `eleven_v4_turbo`).
- Has voice controls for stability, similarity, style exaggeration and speed, each with a plain-language explanation.
- Previews audio with an HTML5 player and waveform (click the waveform to seek), shows duration, and downloads as `mongolian-tts-YYYY-MM-DD-HHMMSS.mp3`.
- Keeps a history of recent generations. Audio is stored in IndexedDB, so it survives a page refresh and can be replayed, re-downloaded or reused.
- Has a Mongolian interface by default with an English toggle, plus light, dark and system themes.
- Has a second tab, **Translate transcript**, that translates film transcripts and subtitles (`.srt`, `.vtt`, `.txt`) into Mongolian with `puter.ai.chat()`, keeping every timestamp. One click turns the translation into a voice-over. See [Transcript translation](#transcript-translation).
- Also includes `.txt` import (UTF-8 or Windows-1251), drag-and-drop, a copy button, an estimate of the part count and cost before you generate, cancel and resume for long jobs, a voice sample button, saved preferences and a saved draft.

## How the Puter and ElevenLabs integration works

```js
const audio = await puter.ai.txt2speech(text, {
  provider: 'elevenlabs',
  model: 'eleven_v3',
  voice: '21m00Tcm4TlvDq8ikWAM',     // voice ID (or exact voice name)
  output_format: 'mp3_44100_128',
  voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0 },
});
// audio is an HTMLAudioElement; audio.src is a data URI.
```

The app fetches `audio.src` into a `Blob`, so it can merge parts, decode a waveform, store the audio and download it.

These are the only Puter APIs the app uses, all documented:

| API | Purpose |
|---|---|
| `puter.ai.txt2speech(text, options)` | Speech synthesis |
| `puter.ai.txt2speech.listVoices({ provider: 'elevenlabs' })` | Voice list (id, name, category, labels) |
| `puter.ai.txt2speech.listEngines({ provider: 'elevenlabs' })` | Model availability and per-character pricing for the cost estimate |
| `puter.ai.chat(messages, false, { model, temperature, signal })` | Transcript translation |
| `puter.ai.listModels()` | Which translation models are available |
| `puter.auth.isSignedIn()`, `signIn()`, `getUser()`, `signOut()` | Authentication |

These parameters were verified against the [txt2speech docs](https://docs.puter.com/AI/txt2speech/) and Puter's open-source ElevenLabs provider (`src/backend/drivers/ai-tts/providers/elevenlabs/ElevenLabsTTSProvider.ts`) in October 2026:

- `model` is checked against Puter's ElevenLabs cost table. `eleven_v3`, `eleven_v4` and `eleven_v4_turbo` are all accepted.
- `voice` takes a 20-character voice ID, which is sent straight through, or an exact voice name.
- `output_format` must be one of ElevenLabs' `codec_samplerate[_bitrate]` values. Invalid values are rejected before any credits are reserved.
- `voice_settings` is forwarded to ElevenLabs unchanged.
- `language_code` is **not** forwarded by Puter, so the app doesn't send it. ElevenLabs detects Mongolian from the text.

## Setup and running locally

You need no build step and no dependencies. Serve the folder over HTTP: Puter's sign-in popup needs a real origin, so opening `index.html` from `file://` won't work.

```bash
cd mongolian-tts
python3 -m http.server 8000
# open http://localhost:8000
```

Any static host works the same way, for example GitHub Pages, Netlify, Cloudflare Pages or Puter Hosting.

**Test mode:** open `http://localhost:8000/?test`. Puter then returns a sample clip instead of real speech and charges nothing. It's useful for working on the UI.

## Authentication

Yes, users need to sign in with Puter. Puter uses a **user-pays model**: each user's ElevenLabs usage is billed to their own Puter account, so the developer never needs or exposes an ElevenLabs API key.

- If the user isn't signed in, the app shows a notice and a **Sign in with Puter** button, and the main button reads "Sign in and generate".
- Sign-in opens a popup, so it only ever starts from a click or Ctrl/Cmd+Enter. Pop-up blockers can interfere, and the error message says so.
- Before sign-in, the voice list shows the built-in voices. After sign-in, the full list loads from Puter.

## Mongolian language support

- Mongolian (`mn`) is listed as supported for Eleven v3, Eleven v4 and Eleven v4 Turbo in [ElevenLabs' model documentation](https://elevenlabs.io/docs/overview/models).
- `eleven_multilingual_v2` (Puter's default) and `eleven_flash_v2_5` do **not** support Mongolian, so the app never offers them.
- Every ElevenLabs voice can speak Mongolian on these models, but voices keep their character and accent. Use **Play a sample** to hear a short Mongolian phrase before generating a long text.
- The text is normalized (line endings, repeated spaces, zero-width characters) without touching Cyrillic letters such as Ө/ө and Ү/ү.

## Supported models

| Model | Notes |
|---|---|
| `eleven_v3` (default) | Most expressive. Stability accepts only 0.0, 0.5 or 1.0, so the UI shows three levels: Creative, Natural and Robust. |
| `eleven_v4` | Newest generation. Continuous stability slider. |
| `eleven_v4_turbo` | Faster and cheaper variant of v4. |

When signed in, the app asks `listEngines()` which models Puter currently offers and disables any that are missing.

If ElevenLabs rejects `voice_settings` for a model, the app retries that part once without them and uses the voice's own defaults for the rest of the job. The result card says when this happened.

To change the model list, edit `CONFIG.models` in `app.js`.

## Long text handling

Puter.js rejects text longer than **3,000 characters** per request (`input_too_large`), so longer text is split before sending:

1. At paragraph boundaries (blank lines) first.
2. Then single line breaks.
3. Then sentence boundaries (using `Intl.Segmenter`, with a punctuation fallback).
4. Then clause punctuation (`,` `;` `:` `—`).
5. Then spaces between words. A word is never cut in the middle; only a single "word" over 3,000 characters is hard-split, at character boundaries.

Small pieces are packed back together greedily, so there are as few requests as possible. The character counter shows how many parts the text will need, and the estimated cost, before you click Generate.

Parts are generated **one at a time**, with progress like "Generating 2 of 5…" and a bar sized to each part's length.

- **Cancel** stops after the current part.
- If a part fails, completed parts are kept, and you can **continue from the failed part**, **use the finished parts**, or **discard** them.
- One job is capped at 50,000 characters (`CONFIG.maxTotalChars`) to keep cost and browser memory predictable.

Merging rules by format:

| Format | Merged into one file? | How |
|---|---|---|
| MP3 | Yes | MPEG frames are concatenated after stripping ID3 tags and the Xing/Info header, so players report the correct total duration. |
| WAV | Yes | The PCM data chunks are concatenated under a rebuilt RIFF header. |
| Opus | No | Ogg streams can't be joined reliably in the browser. Each part is offered as `…-part-02-of-05.opus` with an explanation, plus a "Download all parts" button. |

If a merge ever fails, the app falls back to per-part downloads and explains why.

## Transcript translation

The **Транскрипт орчуулах** (Translate transcript) tab translates film transcripts and subtitles.

1. **Paste or import** a transcript: `.srt`, `.vtt` or `.txt`, up to 5 MB, UTF-8 or Windows-1251. The format is detected automatically, and the footer shows the number of lines and how many requests the translation will need.
2. **Choose the languages:** the source language (auto-detect or a specific one) and the target language (Mongolian by default).
3. **Choose a model and a style.**
   - **For voice-over** gives natural spoken phrasing, with lines about as long as the original.
   - **For subtitles** gives short lines that are quick to read on screen.
4. **Add notes (optional):** the film title, character names with their Mongolian spelling and gender, or recurring terms. They're included in every request, so names stay consistent across the whole film.
5. **Translate**, then edit the result if needed and **download** it as `Movie.mn.srt` (or `.vtt` / `.txt`), or press **Яриа болгох** (Turn into speech).

How it works:

- **Only dialogue is sent to the model.** Cue numbers, timestamps, VTT headers and `NOTE`/`STYLE` blocks are kept verbatim and put back around the translated text. Inline tags (`<i>`, `{\an8}`) and line breaks inside a cue are preserved.
- **Batching:** lines go out in batches of up to 40 cues or 3,500 characters, one batch at a time. Each request includes the previous 6 translated lines as context, so tone and names carry over between batches.
- **Reply checking:** the model must answer with JSON containing exactly one translation per line. If a reply is malformed or has the wrong count, that batch is retried and then split in half until it works. A line can never shift onto another line's timestamp.
- **Progress** is saved to `localStorage` after every batch. Cancel, a failed batch, or even a page refresh can be resumed from where it stopped, as long as the transcript and settings are unchanged.
- **Яриа болгох** (Turn into speech) strips timestamps, markup, speaker dashes and `[sound cues]`/`♪`, then moves the clean dialogue into the Text to speech tab for the ElevenLabs voice-over.

Models: the list in `TR_CONFIG.models` (`translate.js`) is checked against `puter.ai.listModels()` after sign-in, and only models Puter actually offers are shown. The default is Claude Sonnet 4.6; Claude Sonnet 5.5 is preferred automatically when Puter lists it. Translation is billed to the user's Puter account, like speech. In `?test` mode, lines come back marked `[test]` instead of being translated.

Limits:

- **The voice-over is not time-aligned.** The generated audio is one continuous read of the translated dialogue, not a dub that follows each subtitle's timing.
- **Quality depends on the model.** Review names, honorifics and jokes before publishing subtitles.
- Aborting a request in flight stops waiting for it, but Puter may still bill it.

## Error handling

Errors are mapped to plain-language messages with a next step. The categories are: not signed in, quota or insufficient funds, rate limit, text too long, unsupported model, unknown voice, invalid format, network failure, ElevenLabs/provider failure, and unreadable audio.

Raw details are under "Technical details" in the error box. Every failure is also logged to the console with the `[Өгүүлэгч]` prefix, including the chunk number and the full error object.

## Security

- No secrets in the code. No ElevenLabs key, and no proxies: only `https://js.puter.com/v2/` and Google Fonts are loaded.
- All user-controlled text (the editor, file contents, voice names from the API, error messages) is inserted with `textContent` or `createElement`. `innerHTML` is never used.
- Preferences, the draft and history live only in this browser (`localStorage` and IndexedDB).

## Known limitations

- **Cost:** ElevenLabs v3/v4 are premium models. At Puter's current price (about $162 per million characters for v3/v4), a 3,000-character request costs roughly $0.49. The estimate shown in the app comes from `listEngines()` and is approximate.
- **Prosody at part boundaries:** each part is synthesized independently, so intonation can reset slightly where parts join. Paragraph-first splitting keeps joins at natural pauses.
- **Cancel** can't abort a request already in flight; it takes effect after the current part.
- **Some formats need higher ElevenLabs tiers.** `mp3_44100_192` and 44.1 kHz WAV may be rejected depending on Puter's account. If so, the app shows a format error and suggests MP3 128 kbps.
- **History** keeps the 12 most recent generations. Audio is stored only when IndexedDB is available (some private browsing modes block it), and it's per browser, not synced.
- **Opus playback** in Safari depends on the Safari version. MP3 is the safest choice.
- **Waveform** decoding is skipped for very large files (over 80 MB). The player still works.

## Browser compatibility

The app needs current versions of Chrome, Edge, Firefox or Safari (2023 or later), on desktop and mobile. It relies on ES modules, `fetch`, `Blob`, IndexedDB, `OfflineAudioContext` (for the waveform), CSS `color-mix()` and `:has()`.

Older browsers degrade gracefully:
- Without `Intl.Segmenter`, sentence splitting uses punctuation instead.
- Without Web Audio, the waveform is hidden and the duration comes from the audio element.
- Without IndexedDB, history keeps text and settings but not audio.

## Project structure

```text
index.html     Markup and static Mongolian copy (translated at runtime by app.js)
styles.css     Design tokens, light and dark themes, responsive layout
app.js         Config, i18n, storage, history, errors, auth, voices, chunker,
               TTS + audio merging, waveform, downloads, UI rendering, controller
translate.js   Transcript translation: SRT/VTT/text parsing, batching,
               puter.ai.chat prompts, reply validation, translation tab UI
README.md      This file
```

To customize, edit `CONFIG` at the top of `app.js`: models, formats, fallback voices, limits and defaults.

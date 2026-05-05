const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');
const Tesseract = require('tesseract.js');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
 
ffmpeg.setFfmpegPath(ffmpegPath);
 
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
 
const upload = multer({
  dest: path.join(__dirname, '../uploads'),
  limits: { fileSize: 100 * 1024 * 1024 }
});
 
const SYSTEM_PROMPT = `You are an expert parliamentary debate analyst.
Return ONLY valid JSON with:
{
  "summary": "",
  "sentiment": "",
  "sentiment_reason": "",
  "key_arguments": [],
  "speaker_stance": "",
  "parliamentary_notes": "",
  "key_topics": []
}`;
 
function cleanUp(filePath) {
  if (!filePath) return;
  try { fs.unlinkSync(filePath); } catch (e) {}
}
 
function parseJSON(text) {
  try { return JSON.parse(text); }
  catch { return { raw: text }; }
}
 
// ---------- TEXT ----------
router.post('/text', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'No text provided' });
 
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text }
      ],
      response_format: { type: 'json_object' },
    });
 
    res.json(parseJSON(response.choices[0].message.content));
  } catch (err) {
    console.error('TEXT ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});
 
// ---------- IMAGE ----------
router.post('/image', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
 
  console.log('IMAGE FILE:', req.file.originalname);
 
  try {
    console.log('STEP 1: Starting OCR...');
 
    const result = await Tesseract.recognize(req.file.path, 'eng');
    const text = result.data.text.trim();
 
    console.log('STEP 2: OCR done. Characters extracted:', text.length);
    console.log('Preview:', text.slice(0, 120));
 
    cleanUp(req.file.path);
 
    if (!text || text.length < 20) {
      return res.status(400).json({
        error: 'Could not extract meaningful text from image. Please upload a clear image of debate text.'
      });
    }
 
    console.log('STEP 3: Sending to Groq...');
 
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyze this parliamentary debate text. If it is not a debate or is unclear, return {"error": "Not a valid parliamentary debate"}\n\nText:\n${text}`
        }
      ],
      response_format: { type: 'json_object' },
    });
 
    console.log('STEP 4: Groq response received');
 
    const content = response.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error('JSON PARSE ERROR:', content);
      return res.status(500).json({ error: 'Invalid AI response format', raw: content });
    }
 
    console.log('STEP 5: Sending response to frontend');
    return res.json(parsed);
 
  } catch (err) {
    cleanUp(req.file?.path);
    console.error('IMAGE ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});
 
// ---------- AUDIO ----------
router.post('/audio', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio uploaded' });
 
  console.log('AUDIO FILE:', req.file.originalname, 'size:', req.file.size);
 
  try {
    // Rename to preserve extension for Whisper
    const ext = path.extname(req.file.originalname) || '.mp3';
    const renamedPath = req.file.path + ext;
    fs.renameSync(req.file.path, renamedPath);
 
    console.log('STEP 1: Sending to Whisper...');
 
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(renamedPath),
      model: 'whisper-large-v3',
    });
 
    const text = transcription.text;
    console.log('STEP 2: Transcription done. Length:', text?.length);
    console.log('Preview:', text?.slice(0, 120));
 
    cleanUp(renamedPath);
 
    if (!text || text.trim().length < 10) {
      return res.status(400).json({ error: 'Could not transcribe audio. Please check the file.' });
    }
 
    console.log('STEP 3: Sending to Groq...');
 
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text }
      ],
      response_format: { type: 'json_object' },
    });
 
    console.log('STEP 4: Done');
    res.json(parseJSON(response.choices[0].message.content));
 
  } catch (err) {
    cleanUp(req.file?.path);
    console.error('AUDIO ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});
 
// ---------- VIDEO ----------
router.post('/video', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video uploaded' });
 
  console.log('VIDEO FILE:', req.file.originalname, 'size:', req.file.size);
 
  const audioPath = req.file.path + '.mp3';
 
  try {
    console.log('STEP 1: Extracting audio from video...');
 
    await new Promise((resolve, reject) => {
      ffmpeg(req.file.path)
        .noVideo()
        .audioCodec('libmp3lame')
        .toFormat('mp3')
        .on('start', cmd => console.log('ffmpeg cmd:', cmd))
        .on('end', () => { console.log('ffmpeg done'); resolve(); })
        .on('error', (err) => { console.error('ffmpeg error:', err.message); reject(err); })
        .save(audioPath);
    });
 
    console.log('STEP 2: Sending audio to Whisper...');
 
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-large-v3',
    });
 
    const text = transcription.text;
    console.log('STEP 3: Transcription done. Length:', text?.length);
    console.log('Preview:', text?.slice(0, 120));
 
    cleanUp(req.file.path);
    cleanUp(audioPath);
 
    if (!text || text.trim().length < 10) {
      return res.status(400).json({ error: 'Could not transcribe video audio. Please check the file.' });
    }
 
    console.log('STEP 4: Sending to Groq...');
 
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text }
      ],
      response_format: { type: 'json_object' },
    });
 
    console.log('STEP 5: Done');
    res.json(parseJSON(response.choices[0].message.content));
 
  } catch (err) {
    cleanUp(req.file?.path);
    cleanUp(audioPath);
    console.error('VIDEO ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});
 
module.exports = router;
import type { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm, File } from "formidable";
import fs from "fs";
import OpenAI from "openai";

// Disable body parsing to handle multipart form data
export const config = {
  api: {
    bodyParser: false,
  },
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ParsedForm {
  fields: Record<string, string | string[]>;
  files: Record<string, File | File[]>;
}

function parseForm(req: NextApiRequest): Promise<ParsedForm> {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      maxFileSize: 25 * 1024 * 1024, // 25MB limit
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields: fields as Record<string, string | string[]>, files: files as Record<string, File | File[]> });
    });
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const { files } = await parseForm(req);
    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;

    if (!audioFile) {
      return res.status(400).json({ error: "no_audio_file" });
    }

    // Read the file
    const audioBuffer = fs.readFileSync(audioFile.filepath);

    // For now, we'll store as base64 in the response
    // In production, you'd upload to S3/Vercel Blob and return the URL
    const base64Audio = audioBuffer.toString("base64");
    const mimeType = audioFile.mimetype || "audio/webm";

    // Create a data URL (for demo purposes)
    // In production, upload to cloud storage and return URL
    const audioUrl = `data:${mimeType};base64,${base64Audio}`;

    // Transcribe with Whisper
    let transcript = "";
    try {
      // Use fs.createReadStream for OpenAI's API in Node.js
      const fileStream = fs.createReadStream(audioFile.filepath);

      const transcription = await openai.audio.transcriptions.create({
        file: fileStream,
        model: "whisper-1",
        language: "en",
      });

      transcript = transcription.text;
    } catch (transcribeError) {
      console.error("Transcription error:", transcribeError);
      // Continue without transcript
    }

    // Clean up temp file
    try {
      fs.unlinkSync(audioFile.filepath);
    } catch {
      // Ignore cleanup errors
    }

    return res.status(200).json({
      url: audioUrl,
      transcript,
      duration: Math.round(audioBuffer.length / 16000), // Rough estimate
    });
  } catch (error) {
    console.error("Failed to process audio upload:", error);
    return res.status(500).json({ error: "internal_error" });
  }
}

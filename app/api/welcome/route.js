import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

const openai = new OpenAI();

export async function GET() {
    const filename = `welkomst2.mp3`;
    const filePath = path.join(".", 'public', filename);
    console.log(filePath)
    // if(fs.access(filePath)) {
    //     return new NextResponse('file already exists');
    // }

    const speech = await openai.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice: "shimmer",
        input: "Hallo! Welkom, fijn dat je belt. Waar kan ik je vandaag mee helpen?",
        instructions: "Speak in a warm, friendly and calm tone at a natural pace.",
        format: 'wav',
        });


    const arrayBuffer = await speech.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fs.writeFile(filePath, buffer);
    const publicUrl = `${process.env.MY_DOMAIN}/${filename}`;

    return NextResponse.json({ url: publicUrl });
}
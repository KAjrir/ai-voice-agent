import { ElevenLabsClient, play } from '@elevenlabs/elevenlabs-js';
import WebSocket from 'ws';
import fs from "fs/promises"
import 'dotenv/config';

const voiceIdOwnVoice = process.env.ELEVENLABS_VOICE_ID;
const text = "When building an online store, the very first step is often deciding which products you want to display. Once the products are chosen, you need to create a structure that makes sense for your customers. Categories like clothing, electronics, and home decor help visitors find what they need quickly. After the structure is clear, the next important feature is the shopping cart. A shopping cart allows people to collect items before checking out, and without it, no e-commerce website would feel complete. Finally, implementing a secure payment system ensures that every transaction is safe, fast, and reliable. These steps combined create the foundation of a professional e-commerce experience."

const elevenlabs = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY
});

// const audio = await elevenlabs.textToSpeech.convert('JBFqnCBsd6RMkjVDRZzb', {
//   text: 'The first move is what sets everything in motion.',
//   modelId: 'eleven_multilingual_v2',
//   outputFormat: 'mp3_44100_128',
// });

// await play(audio);

// const voices = await elevenlabs.voices.search()

export async function streamingViaElevenlabs(input, ws, streamSid) {
    const audioStream = await elevenlabs.textToSpeech.stream(voiceIdOwnVoice, {
        outputFormat: "ulaw_8000",
        text: input,
        modelId: "eleven_multilingual_v2",
    });

    const chunks = []
    for await (const chunk of audioStream) {
        const payload = Buffer.from(chunk).toString("base64");
        ws.send(JSON.stringify({
            event: "media",
            streamSid,
            media: { 
                payload 
            }
        }));
        // const b64 = Buffer.from(chunk)
        // chunks.push(b64)
    }
    console.log("klaar met Loopen")

    // return Buffer.concat(chunks).toString('base64')
    
}


// const stream = await elevenlabs.textToSpeech.stream(voiceIdOwnVoice, {
//     outputFormat: "ulaw_8000",
//     text: "The first move is what sets everything in motion.",
//     modelId: "eleven_multilingual_v2",
//     voiceSettings: {
//         speed: 0.95
//     },
// });

// console.log(stream)

// const stream = await elevenlabs.textToSpeech.stream(voiceIdOwnVoice, {
//     outputFormat: "ulaw_8000",
//     text: "When building an online store, the very first step is often deciding which products you want to display. Once the products are chosen, you need to create a structure that makes sense for your customers. Categories like clothing, electronics, and home decor help visitors find what they need quickly. After the structure is clear, the next important feature is the shopping cart. A shopping cart allows people to collect items before checking out, and without it, no e-commerce website would feel complete. Finally, implementing a secure payment system ensures that every transaction is safe, fast, and reliable. These steps combined create the foundation of a professional e-commerce experience.",
//     modelId: "eleven_multilingual_v2",
//     voiceSettings: {
//         speed: 0.95
//     },
// });

// const reader = stream.getReader();
//   while (true) {
//     const { done, value } = await reader.read();
//     if (done) break;
//     console.log("chunk size:", value.byteLength);
//     // hier kun je bijvoorbeeld: Buffer.from(value).toString('base64')
//   }

export async function connectToElevenLabsModel(twilioWs, streamSid){
    const audioChunks = [];

  const voiceId = process.env.ELEVENLABS_VOICE_ID
  const baseURL = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/multi-stream-input`

  const url = `${baseURL}?${new URLSearchParams({
    inactivity_timeout: 20,
  }).toString()}`
  console.log(url)

  const elevenLabWs = new WebSocket(url, {
    headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY
    }
  })


  elevenLabWs.on('open', async() => {
    elevenLabWs.send(JSON.stringify({
        text: ' ',
        voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            use_speaker_boost: false,
        },
        // generation_config: {
        //     chunk_length_schedule: [120, 160, 250, 290]
        // },
        context_id: "conv_1"
    }));

    elevenLabWs.send(JSON.stringify({
        text: "Hi how are you doing, my name is Karim. ",
        context_id: "conv_1",
        flush: true,

    }));

    elevenLabWs.send(JSON.stringify({
        text: "i'm very thankfull to be a part of your journey ",
        context_id: "conv_1",
        flush: true

    }));

    elevenLabWs.send(JSON.stringify({
        context_id: "conv_1",
        close_context: true
    }))

  })

  elevenLabWs.on('message', async (event) => {
    const data = JSON.parse(event.toString())

    data?.audio ? 
        console.log({...data, audio: `${data.audio.slice(0,10)}...`}) :
        console.log(data)

    if(data.audio) {
        audioChunks.push(Buffer.from(data.audio, 'base64'))
    }

    if(data.isFinal){
        await fs.writeFile('./elevenlabsOutput.mp3', Buffer.concat(audioChunks))
    }
  })
}

connectToElevenLabsModel()


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { OpenAI } from 'openai';
import fs from 'fs/promises'
import fsR from 'fs'
import twilio  from 'twilio';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
dotenv.config();

const execAsync = promisify(exec);
const openai = new OpenAI();
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
let openAiWs;
let elevenLabWs;
const wss = new WebSocketServer({ port: 8080, autoAcceptConnections: true });
let isChatAanHetWoord = true; 
let audioString = ''

console.log('✅ EchoTranscriber WebSocket running on ws://localhost:8080');

const messagesToDisplay = {
  transcript: "",
  response: ""
}

const fullConversion = []


let streams = {}


wss.on('connection', async (ws, req) => {
  const ip = req.socket.remoteAddress;

  console.log('📞 Client connected', ip);
  let silenceCounter = 0;
  let totalCounter = 0;
  let updateInProgress = false
  let audioChunks = []
  

  let callSid
  let streamSid

  ws.on('message', async (data) => {
    const msg = JSON.parse(data);

    if(msg.event === "start") {
      callSid = msg?.start?.callSid
      streamSid = msg?.start?.streamSid
      connectToElevenLabsModel(ws, streamSid)
      connectToOpenAiModel(ws, streamSid)
      console.log(msg)
    }

    if(msg.event === "media" && openAiWs?.readyState === WebSocket.OPEN){
      if(msg?.media?.payload && !isChatAanHetWoord) fullConversion.push(Buffer.from(msg?.media?.payload, "base64"))
      openAiWs.send(JSON.stringify({
        type: "input_audio_buffer.append",
        audio: msg.media?.payload
      }))
    }

    
    if(msg.event === 'stop'){
      console.log('CALL ENDED')
      console.log(silenceCounter)
      console.log(totalCounter)
      console.log(msg)
      ws.send(JSON.stringify({
        event: 'clear',
        streamSid 
      }));

      // makeAudioFile(fullConversion)
    }

  })

});


function connectToOpenAiModel(twilioWs, streamSid) {
  console.log("Connected to OPENAI")
  openAiWs = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2025-06-03",
    {
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1",
      },
    }
  );

  const audioChunks = []

  openAiWs.on("open", () => {
    openAiWs.send(JSON.stringify({
      type: "session.update",
      session: {
        instructions: "Je bent een warme, empathische verslavingsexpert en tegelijk een ondersteunende vriend. " +
                      "Je praat alleen over verslaving en herstel. Luister eerst, moedig aan, en geef stap-voor-stap advies waar passend. " +
                      "Verwijs bij acute nood of crisis altijd door naar professionele hulp.",
        voice: "sage",
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
        input_audio_transcription: { 
          model: "gpt-4o-transcribe",
          language: "nl",
          // prompt: "Praat op een charmante en speelse manier, met een warme en uitnodigende toon die mensen nieuwsgierig maakt om verder te luisteren."
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.4,               // iets gevoeliger voor telefoonlijnen
          create_response: true,
          interrupt_response: true
        },
        input_audio_noise_reduction: {
          type: "near_field"
        },
        modalities: ["text"]
      },
    }));

    elevenLabWs.send(JSON.stringify({
          text: ' ',
          model_id: "eleven_flash_v2_5",
          voice_settings: {
              stability: 0.5,
              similarity_boost: 0.8,
              use_speaker_boost: false,
          },
          generation_config: {
              chunk_length_schedule: [60,100,140,180]
          },
          context_id: "conv_1"
      }));

    openAiWs.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: "Stel jezelf nu kort voor en vraag naar de naam en iets over de persoon."
          }
        ]
      }
    }));

    openAiWs.send(JSON.stringify({
      type: "response.create",
      response: {
        modalities: [ "text", "audio" ],
      },
    }))

  });

  openAiWs.on("message", async (data) => {
    const msg = JSON.parse(data);
    if (!msg) return;
    msg.type === "response.audio.delta" ? 
      console.log({...msg, delta: `${msg.delta.slice(0, 10)}...`}) : console.log(msg)
    
    if(msg.type === "response.audio.delta" && msg.delta){
      fullConversion.push(Buffer.from(msg.delta, "base64")) //Record Conversation
      // twilioWs.send(JSON.stringify({
      //   event: 'media',
      //   streamSid,
      //   media: {
      //     payload: msg?.delta
      //   }
      // }))
    }

    if(msg.type === "input_audio_buffer.speech_started" || msg?.response?.status_details?.reason === 'turn_detected') {
      isChatAanHetWoord = false
      twilioWs.send(JSON.stringify({
        event: 'clear',
        streamSid
      }));
      
    }

    if(msg.type === "input_audio_buffer.committed") {
      isChatAanHetWoord = true
    }

    if(msg.type === "response.audio_transcript.delta") {
      audioString += msg.delta
      console.log("AUDIOSTRING: ", audioString, "\n AUDIOLENGTH", audioString.length)

      if(audioString.length > 60){
        elevenLabWs.send(JSON.stringify({
          text: `${audioString} `,
          context_id: "conv_1",
        }));

        audioString = ""
      }
      // elevenLabWs.send(JSON.stringify({
      //     text: `${msg.delta} `,
      //     context_id: "conv_1",
      //     // flush: true,
      // }));
      
    }

    if(msg.type === "conversation.item.input_audio_transcription.completed"){
      messagesToDisplay.transcript = msg.transcript
    }

    if(msg.type === "response.audio_transcript.done") {
      messagesToDisplay.response = msg.transcript
      console.log("AUDIOSTRING: DONE", audioString)

      if(audioString.trim().length > 0){
        elevenLabWs.send(JSON.stringify({
            text: `${audioString}`,
            context_id: "conv_1",
            flush: true
        }));
        audioString = ""

        // elevenLabWs.send(JSON.stringify({
        //     context_id: "conv_1",
        //     flush: true,
        // }));
      }
      // await streamingViaElevenlabs(msg?.transcript, twilioWs, streamSid)
    }


    // conversation.item.input_audio_transcription.completed

    if (msg.type === "response.audio.done") {
      console.log("AUDIO GENERATING DONE REALTIME OPENAI")
    }

    if(msg.type === "response.done") {
      // if(msg.response.status_details) console.log(JSON.stringify(msg,null,2))
      console.log(JSON.stringify(messagesToDisplay))
    }
    


  });
  
}

function connectToElevenLabsModel(twilioWs, streamSid){
    const audioChunks = [];

    const voiceId = process.env.ELEVENLABS_VOICE_ID
    const baseURL = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/multi-stream-input`

    const url = `${baseURL}?${new URLSearchParams({
      output_format: 'ulaw_8000',
      inactivity_timeout: 120,
      // optimize_streaming_latency: 3
    }).toString()}`
    console.log(url)

    elevenLabWs = new WebSocket(url, {
      headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY
      }
    })

    elevenLabWs.on('message', async (event) => {
      const data = JSON.parse(event.toString())

      data?.audio ? 
          console.log("ELEVENLABS: ", {...data, audio: `${data.audio.slice(0,10)}...`}) :
          console.log("ELEVENLABS: ", data)

      if(data.audio) {
          // audioChunks.push(Buffer.from(data.audio, 'base64'))
          twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid,
            media: {
              payload: data.audio
            }
          }))

      }

      if(data.isFinal){
          // await fs.writeFile('./elevenlabsOutput.mp3', Buffer.concat(audioChunks))
      }
    })
}



async function makeAudioFile(audioArr) {
  const audioBuffer = Buffer.concat(audioArr)

  await fs.writeFile('./conversation/conversation.ulaw', audioBuffer)
  await execAsync('ffmpeg -y -f mulaw -ar 8000 -ac 1 -i ./conversation/conversation.ulaw ./conversation/conversation.wav');
  await execAsync("ffmpeg -f mulaw -ar 8000 -ac 1 -i ./conversation/conversation.ulaw -ar 16000 -c:a libmp3lame -b:a 64k ./conversation/conversation.mp3")
  console.log("GESLAAGD!!")
}


// if (msg.event === 'media' && msg.media?.payload && !updateInProgress) {
//       // save as buffer (mulaw)
//       const audioBuf = Buffer.from(msg.media.payload, 'base64')
//       audioChunks.push(audioBuf);
//     }

//     if(msg.event === "media"){
//       const payload = msg.media?.payload;
//       const decoded = Buffer.from(payload, 'base64')

//       const isSilent = isSilentChunk(decoded)
//       if(isSilent) silenceCounter++;

//       totalCounter++

//       if(totalCounter >= 200 && !updateInProgress) {
//         const ratio = silenceCounter / totalCounter > 0.9
//         if (ratio) updateInProgress = true
//         console.log("RatioComplete: ", ratio)
          
          
//           if (ratio) {
//             console.log("🎤 Audio verzonden naar GPT");
//             const audio = Buffer.concat(audioChunks).toString('base64')
//             console.log(audio)
          

//             try {
//               openAiWs.send(JSON.stringify({
//                 type: 'conversation.item.create',
//                 item: {
//                   type: 'message',
//                   role: 'user',
//                   content: [
//                     {
//                       type: 'input_audio',
//                       audio: audio
//                     }
//                   ]
//                 }
//               }));

//               audioChunks.length = 0;

//               openAiWs.send(JSON.stringify({
//                 type: "response.create",
//                 response: {
//                   modalities: [ "text", "audio" ],
//                   voice: 'sage',
//                 },
//               }))
//             } catch (e) {
//               console.log("ERROR UPDATING CALL!!: ", e)
//             }
//           }

//           silenceCounter = 0;
//           totalCounter = 0;
//           // try {
//           //     const {url, input, output} = await hello(ws, audioChunks, streams[callSid])
//           //     console.log(url)
//           //     console.log("DE FUNCTIE IS GESLAAGD")
              
//           //     if(!streams[callSid]){
//           //       streams[callSid] = []
//           //     }
        

//           //     streams[callSid].push({ role: 'user', content: input })
//           //     streams[callSid].push({ role: 'assistant', content: output })
//           //     console.log("ALL STREAMS: ", JSON.stringify(streams,null,2))
              
//           //     const callInfo = await client.calls(callSid).fetch();

//           //     if (callInfo.status === 'in-progress') {
//           //       audioChunks.length = 0
//           //         await client.calls(callSid).update({
//           //           twiml: `
//           //             <Response>
//           //               <Play action='${process.env.MY_DOMAIN}/api/next'>${url}</Play>
//           //               <Connect>
//           //                 <Stream url='${process.env.MY_WEBSOCKET}'/>
//           //               </Connect>
//           //               <Pause length="120"/>
//           //             </Response>
//           //           `
//           //         });
//           //         console.log("CLIENT UPDATE KLAAR")
//           //     } else {
//           //       console.log("❌ Call no longer in progress:", callInfo.status);
//           //     }
//           //   } catch (err) {
//           //     console.error("❌ Error updating call:", err);
//           //   } 
//         }
//       }

// function isSilentChunk(buffer) {
//   let silentSamples = 0;
  
//   for (let i = 0; i < buffer.length; i++) {
//     const val = buffer[i];
//     if (val >= 251) silentSamples++;
//   }
//   // console.log('silentsamples: ', silentSamples)
//   // console.log('bufferlength: ', buffer.length)
//   const ratio = silentSamples / buffer.length;
//   // console.log("RatioSilent: ", ratio)
//   return ratio > 0.8;
// }

// async function hello(ws, audioChunks, messages) {
//       const fullBuffer = Buffer.concat(audioChunks);
//       console.log(fullBuffer)
//       audioChunks.length = 0;

//       await fs.writeFile('/tmp/input.ulaw', fullBuffer);
//       await execAsync('ffmpeg -y -f mulaw -ar 8000 -ac 1 -i /tmp/input.ulaw /tmp/input.wav');
//       console.log('Bestand Aangemaakt')


//       // 2. Whisper STT
//       const transcript = await openai.audio.transcriptions.create({
//         file: fsR.createReadStream('/tmp/input.wav'),
//         model: "gpt-4o-transcribe",
//         language: 'en'
//       });

//       console.log("🧠 Transcript:", transcript.text);

//       // 3. ChatGPT
//       if(messages) console.log("ALL MESSAGES: ", messages)
//       let reply
//       if(messages){
//         reply = await openai.chat.completions.create({
//           model: "gpt-4o",
//           messages: [
//             { role: "system", content: "You are a helpful assistant on a phone call." },
//             ...messages,
//             { role: "user", content: transcript.text }
//           ]
//         })
//       } else {
//         reply = await openai.chat.completions.create({
//           model: "gpt-4o",
//           messages: [
//             { role: "system", content: "You are a helpful assistant on a phone call." },
//             { role: "user", content: transcript.text }
//           ]
//         });
//       }
//       // console.log(reply)

//       const gptResponse = reply.choices[0].message.content
//       console.log("🤖 ChatGPT:", gptResponse);

//       // 4. OpenAI TTS
//       const speech = await openai.audio.speech.create({
//         model: "gpt-4o-mini-tts",
//         voice: "nova",
//         instructions: "Speak positive but calm tone.",
//         input: gptResponse,
//         response_format: 'mp3'
//       });

//       console.log("SPEACH IS GELUKT")
//       // const delta = await speech.body()
//       // console.log(delta)

//       const mp3Buffer = Buffer.from(await speech.arrayBuffer());

//       console.log("DE BUFFER MAKEN IS GELUKT")
//       // console.log(mp3Buffer)

//       // 5. Convert mp3 → mulaw
//       await fs.writeFile('public/input.mp3', mp3Buffer);

//       console.log("NIEUWE FILE GESCHREVEN")
//       return {
//         url: `${process.env.MY_DOMAIN}/input.mp3`,
//         input: transcript.text,
//         output: gptResponse,
//       }
//       await execAsync('ffmpeg -y -i /tmp/input.wav -ar 8000 -ac 1 -f mulaw /tmp/output.mulaw');

//       console.log("OMZETTEN NAAR MULAW IS GELUKT")
//       const mulawBuffer = await fs.readFile('/tmp/output.mulaw');
//       console.log("MULAW BUFER LEZEN IS GELUKT")
//       console.log(mulawBuffer)
      

//       // 6. Verdeel in frames van 640 bytes (20ms bij 8kHz mu-law)
//       const frameSize = 640;
//       for (let i = 0; i < mulawBuffer.length; i += frameSize) {
//         const chunk = mulawBuffer.subarray(i, i + frameSize);
//         ws.send(JSON.stringify({
//           event: "media",
//           media: {
//             payload: chunk.toString('base64')
//           }
//         }));
//         await new Promise(res => setTimeout(res, 20)); // wacht 20ms
//       }
// }
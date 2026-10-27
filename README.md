# AI Voice Agent

An AI agent that **calls a real phone number and has a live spoken conversation** in Dutch. Phone audio is streamed in real time between Twilio, the OpenAI Realtime API and ElevenLabs.

## How it works

```
 Phone ◄──► Twilio ◄── Media Stream (WebSocket, μ-law 8 kHz) ──► websocketserver.js
                                                                   │          ▲
                                                     caller audio  ▼          │ AI voice (μ-law)
                                                          OpenAI Realtime   ElevenLabs
                                                   (transcription + reply)  (text-to-speech)
```

1. The Next.js app starts an outbound call through the **Twilio REST API** (`/api/call`).
2. When the call is answered, Twilio requests TwiML from `/api/voice`, which connects the call to a **Media Stream** on the WebSocket server.
3. Incoming caller audio (G.711 μ-law) is forwarded to the **OpenAI Realtime API**, which transcribes the speech (`gpt-4o-transcribe`), detects when the caller stops talking (server VAD) and generates a text reply.
4. The reply is streamed to **ElevenLabs** (multi-stream-input WebSocket, `eleven_flash_v2_5`), which returns μ-law audio that is sent straight back into the phone call.
5. The caller can interrupt the agent; after the call the conversation audio can be converted with ffmpeg.

## Tech stack

| Part | Technology |
|---|---|
| App & API routes | Next.js 15 (App Router), React 19, Tailwind CSS |
| Telephony | Twilio Programmable Voice, TwiML, Media Streams |
| Speech-to-text & LLM | OpenAI Realtime API |
| Text-to-speech | ElevenLabs streaming WebSocket API |
| Real-time transport | `ws` WebSocket server |
| Audio conversion | ffmpeg |

## Project structure

```
app/page.js               # simple UI to enter a number and start a call
app/api/call/route.js     # starts an outbound call via Twilio
app/api/voice/route.js    # TwiML: connect the call to the media stream
app/api/next/route.js     # TwiML helper used between conversation turns
app/api/status/route.js   # Twilio call status callbacks
app/api/welcome/route.js  # generates a welcome message with OpenAI TTS
websocketserver.js        # real-time bridge: Twilio ⇄ OpenAI Realtime ⇄ ElevenLabs
testElevenlabs.js         # standalone ElevenLabs streaming test
```

## Getting started

Requirements: Node.js 20+, ffmpeg, a Twilio account with a phone number, and OpenAI and ElevenLabs API keys.

```bash
npm install
cp .env.example .env     # fill in your keys
```

Twilio must be able to reach both servers, so expose them publicly (for example with ngrok) and put the URLs in `MY_DOMAIN` and `MY_WEBSOCKET`.

```bash
node websocketserver.js  # WebSocket server on port 8080
npm run dev              # Next.js app on http://localhost:3000
```

## What I learned

- Working with raw telephone audio: μ-law encoding, 8 kHz sample rates and 20 ms frames
- Bridging three real-time WebSocket APIs while keeping latency low
- Turn-taking in voice conversations: voice activity detection and handling interruptions
- How Twilio drives a call with TwiML and webhooks

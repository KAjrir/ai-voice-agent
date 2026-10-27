import { NextResponse } from "next/server";
import twilio from 'twilio';
import WebSocket from 'ws'

export async function POST(req){

    const {callSid} = await req.json() 

    const ws = new WebSocket(process.env.MY_WEBSOCKET)

    ws.on('open', () => {
        ws.send(JSON.stringify({
            event: "playFinished",
            callSid
        }))
        ws.close()
    })

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.pause({ length: 20 });

    return new NextResponse(twiml.toString(), {
        headers: {
            'Content-Type': 'text/xml'
        }
    })
}
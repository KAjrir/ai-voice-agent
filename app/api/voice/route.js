import { NextResponse } from 'next/server';
import twilio from 'twilio';


// export async function GET() {
//   const twiml = new twilio.twiml.VoiceResponse();
//   twiml.play(`${process.env.MY_DOMAIN}/welkomst.mp3`)
//   twiml.play(`${process.env.MY_DOMAIN}/telefoon_klaar.mp3`)
  
//   return new NextResponse(twiml.toString(), {
//     status: 200,
//     headers: {
//       'Content-Type': 'text/xml',
//     },
//   });
// }


export async function GET() {
  const twiml = new twilio.twiml.VoiceResponse();
  // twiml.play(`${process.env.MY_DOMAIN}/noord-afrikaan.pcm`)
  const start = twiml.connect();
  start.stream({
    url: process.env.MY_WEBSOCKET,
  });
  twiml.pause({ length: 120 });
  
  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: {
      'Content-Type': 'text/xml',
    },
  });
}



import { NextResponse } from "next/server"
import twilio from 'twilio';
import dotenv from 'dotenv'
dotenv.config()


const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);
// console.log(client)

const MY_DOMAIN = process.env.MY_DOMAIN

const isValidPhoneNumber = (number) => (
  typeof number === 'string' && /^\+?[1-9]\d{7,14}$/.test(number)
)


export async function POST(req) {
  const { number } = await req.json();
  console.log("PHONE NUMBER TO BE CALLED: ", number)
  
  if (!isValidPhoneNumber(number)) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

    try {
        const call = await client.calls.create({
          from: process.env.TWILIO_PHONE_NUMBER,
          to: number,
          url: `${MY_DOMAIN}/api/voice`,
          method: "GET"
          // statusCallback: `${MY_DOMAIN}/api/status`,
          // statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
          // statusCallbackMethod: 'POST',
        });

        console.log(`${MY_DOMAIN}/api/voice`)

        return NextResponse.json({ success: true, call });
    } catch (error) {
        console.error('Twilio error:', error);
        return NextResponse.json({ error: 'Call failed' }, { status: 500 });
    }
}

// export async function GET() {
//   const AccessToken = twilio.jwt.AccessToken;
//   const VoiceGrant = AccessToken.VoiceGrant;

//   const token = new AccessToken(
//     process.env.TWILIO_ACCOUNT_SID,
//     process.env.TWILIO_API_SID,
//     process.env.TWILIO_API_SECRET,
//     { identity: 'browser-user' }
//   );


//   const voiceGrant = new VoiceGrant({
//     outgoingApplicationSid: process.env.TWILIO_TWIML_SID, // zie hieronder
//     incomingAllow: true,
//   });

//   token.addGrant(voiceGrant);

//   return NextResponse.json({ token: token.toJwt() });
// };
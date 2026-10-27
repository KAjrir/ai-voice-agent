export async function POST(req) {
  const data = await req.formData();
  console.log('📞 Twilio status callback:', Object.fromEntries(data));
  return new Response('ok', { status: 200 });
}


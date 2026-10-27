'use client'

import { useState, useEffect, useRef } from "react";
import { Device } from '@twilio/voice-sdk';

const QUICK_DIAL_1 = process.env.NEXT_PUBLIC_QUICK_DIAL_1
const QUICK_DIAL_2 = process.env.NEXT_PUBLIC_QUICK_DIAL_2

export default function Home() {
  const [input, setInput] = useState('')
  const deviceRef = useRef(null)

  const handleInput = (e) => {
    setInput(e.target.value)
  }

  const handleCall = async (phone ,e) => {
    if (e) e.preventDefault()
    const res = await fetch('/api/call', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ number: input || phone})
    });
    const data = await res.json();

    console.log(data)
  }


  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <form onSubmit={handleCall}>
          <label>
            <input
              type="text"
              value={input}
              onChange={handleInput}
              className="w-50 h-5 border border-black"
            />
          </label>
          <button
            type="submit"
            className="border border-black rounded-xl px-5 py-2"
          >
            Call
          </button>
        </form>
      </main>
      <div className="absolute top-4 left-4 grid gap-2">
        <button className="border-2 border-neutral-400 p-1.5 rounded-2xl bg-black text-white cursor-pointer" 
                onClick={() => handleCall(QUICK_DIAL_1)}
        >
              {QUICK_DIAL_1}
        </button>

        <button className="border-2 border-neutral-400 p-1.5 rounded-2xl bg-black text-white cursor-pointer" 
                // onClick={() => handleCall(QUICK_DIAL_2)}
        >
              {QUICK_DIAL_2}
        </button>
      </div>
      
    </div>
  );
}

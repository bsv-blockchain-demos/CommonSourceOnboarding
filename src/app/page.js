"use client"

import React, { useState } from "react";
import { WalletClient, PrivateKey } from "@bsv/sdk";

export default function Home() {
  const [username, setUsername] = useState('');
  const [residence, setResidence] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [work, setWork] = useState('');

  const serverPubKey = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY;

  const handleGenerateCert = async () => {
    // Make cert with API
    const wallet = new WalletClient("Auto", "localhost");

    const certResponse = await wallet.acquireCertificate({
      type: Buffer.from("User").toString('base64'),
      fields: {
        username: username,
        residence: residence,
        age: age,
        gender: gender,
        email: email,
        work: work,
      },
      acquisitionProtocol: "issuance",
      certifier: serverPubKey,
      certifierUrl: "localhost:3000/api/certificate",
    });
    console.log(certResponse);
  }

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <div className="home">
        <h1>Home</h1>
        <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input type="text" placeholder="Residence" value={residence} onChange={(e) => setResidence(e.target.value)} />
        <input type="text" placeholder="Age" value={age} onChange={(e) => setAge(e.target.value)} />
        <input type="text" placeholder="Gender" value={gender} onChange={(e) => setGender(e.target.value)} />
        <input type="text" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="text" placeholder="Work" value={work} onChange={(e) => setWork(e.target.value)} />
        <button onClick={handleGenerateCert}>Generate</button>
      </div>
    </div>
  );
}

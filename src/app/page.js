// Temporary minimal version to debug 404 issues
"use client"

import React from "react";

export default function Home() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>CommonSource - Digital Identity Certification</h1>
      <p>Minimal version to test deployment</p>
      <p>If you can see this, the basic app structure is working.</p>
      <button style={{ padding: '10px 20px', margin: '10px' }}>Test Button</button>
    </div>
  );
}
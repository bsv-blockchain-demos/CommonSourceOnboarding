import { NextResponse } from "next/server";

// Middleware
export async function POST(req) {
    const body = await req.json();
    console.log("body", body);
    return NextResponse.json({ body }, { status: 200 });
}
    
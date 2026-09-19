import { sendTradingOtp } from "@/lib/trading-otp";
export async function POST(request: Request) { return sendTradingOtp(request); }

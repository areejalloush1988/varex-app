import { verifyTradingEmail } from "@/lib/trading-otp";
export async function POST(request: Request) { return verifyTradingEmail(request); }

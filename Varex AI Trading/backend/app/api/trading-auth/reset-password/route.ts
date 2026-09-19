import { resetTradingPassword } from "@/lib/trading-otp";
export async function POST(request: Request) { return resetTradingPassword(request); }

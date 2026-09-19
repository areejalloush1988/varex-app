import { tradingRequest } from "@/lib/trading-access";

export async function GET(request: Request) { return tradingRequest(request); }
export async function POST(request: Request) { return tradingRequest(request); }

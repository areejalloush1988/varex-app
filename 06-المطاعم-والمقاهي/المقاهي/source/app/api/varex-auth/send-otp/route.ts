import{sendOtp}from"@/lib/otp-relay";export async function POST(request:Request){return sendOtp(request)}

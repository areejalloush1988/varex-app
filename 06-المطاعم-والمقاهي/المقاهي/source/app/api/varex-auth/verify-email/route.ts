import{verifyEmailOtp}from"@/lib/otp-relay";export async function POST(request:Request){return verifyEmailOtp(request)}

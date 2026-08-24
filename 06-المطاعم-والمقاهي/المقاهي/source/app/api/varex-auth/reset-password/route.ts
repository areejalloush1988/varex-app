import{resetPasswordWithOtp}from"@/lib/otp-relay";export async function POST(request:Request){return resetPasswordWithOtp(request)}

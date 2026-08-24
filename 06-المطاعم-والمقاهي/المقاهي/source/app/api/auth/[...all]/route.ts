import {getCafeAuth} from "@/lib/auth";
async function handle(request:Request){return(await getCafeAuth()).handler(request)}
export const GET=handle;export const POST=handle;

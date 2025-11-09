import { respData, respErr } from "@/lib/resp";
import { getUserCredits } from "@/services/credit";
import { getUserUuid } from "@/services/user";

export async function GET() {
  try {
    const user_uuid = await getUserUuid();
    if (!user_uuid) return respErr("no auth");
    const credits = await getUserCredits(user_uuid);
    return respData({ left_credits: credits.left_credits || 0 });
  } catch (e) {
    return respErr("fetch credits failed");
  }
}


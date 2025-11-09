import { respData, respErr, respJson } from "@/lib/resp";

import { findUserByUuid } from "@/models/user";
import { getUserUuid } from "@/services/user";

export async function POST(req: Request) {
  try {
    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respJson(-2, "no auth");
    }

    const user = await findUserByUuid(user_uuid);
    if (!user) {
      return respErr("user not exist");
    }

    // Determine admin flag from environment variable ADMIN_EMAILS
    // Only used for UI convenience; server routes enforce admin separately.
    const admins = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const is_admin = !!user.email && admins.includes(user.email);

    return respData({ ...user, is_admin });
  } catch (e) {
    console.log("get user info failed: ", e);
    return respErr("get user info failed");
  }
}

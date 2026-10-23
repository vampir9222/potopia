import { AvatarEditor } from "@app/avatar/ui";
import { ensureAvatar } from "@app/core";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/Breadcrumb";
import { sprites } from "@/lib/avatar";
import { getCurrentMember } from "@/lib/session";
import { saveAvatarAction } from "./actions";

export const metadata: Metadata = { title: "Mon avatar" };

export default async function AvatarPage() {
  const user = await getCurrentMember();
  const avatar = await ensureAvatar({ userId: user.id, sprites });
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb />
      <AvatarEditor initialConfig={avatar.config} save={saveAvatarAction} />
    </div>
  );
}

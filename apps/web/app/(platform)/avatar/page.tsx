import { AvatarEditor, PhraseForm } from "@app/avatar/ui";
import { AVATAR_PHRASE_MAX, ensureAvatar } from "@app/core";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/Breadcrumb";
import { sprites } from "@/lib/avatar";
import { getCurrentMember } from "@/lib/session";
import { saveAvatarAction, savePhraseAction } from "./actions";

export const metadata: Metadata = { title: "Mon avatar" };

export default async function AvatarPage() {
  const user = await getCurrentMember();
  const avatar = await ensureAvatar({ userId: user.id, sprites });
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb />
      <PhraseForm
        initialPhrase={avatar.phrase}
        maxLength={AVATAR_PHRASE_MAX}
        action={savePhraseAction}
      />
      <AvatarEditor initialConfig={avatar.config} save={saveAvatarAction} />
    </div>
  );
}

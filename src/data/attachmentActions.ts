import type { Attachment } from "#/lib/types"
import type { ActionContext } from "./actions"

export function attachmentActions({ source, run, toast }: ActionContext) {
  const { attachments } = source
  return {
    // Awaited by the uploader, which shows its own per-image retry; no generic toast here
    async addAttachment(att: Attachment) {
      await attachments.insert(att).isPersisted.promise
    },
    // ponytail: the R2 object stays (see deleteAttachmentsFn), which is what makes undo possible
    removeAttachment(att: Attachment) {
      run(() => attachments.delete(att.id))
      toast("Imagem removida.", { label: "Desfazer", onClick: () => run(() => attachments.insert(att)) })
    },
  }
}

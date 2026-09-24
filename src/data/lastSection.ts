// Section last picked when creating a task on a page; storage may be unavailable (private mode), so failures are ignored
const key = (pageId: string) => `checklist-board-section-${pageId}`

export const readLastSection = (pageId: string) => {
  try {
    return localStorage.getItem(key(pageId))
  } catch {
    return null
  }
}

export const writeLastSection = (pageId: string, id: string) => {
  try {
    localStorage.setItem(key(pageId), id)
  } catch {}
}

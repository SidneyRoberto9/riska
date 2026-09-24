import { useQuery } from "@tanstack/react-query"
import { storageEnabledFn } from "#/server/attachments"
import { useSource } from "./source-context"

// Local mode never asks the server (it never hits the network) and never shows images
export function useImagesEnabled() {
  const { slug } = useSource()
  const { data } = useQuery({
    queryKey: ["storage-enabled"],
    queryFn: () => storageEnabledFn(),
    enabled: slug !== null,
    staleTime: Number.POSITIVE_INFINITY,
  })
  return slug !== null && data === true
}

export const imageSrc = (slug: string, id: string) => `/api/s/${slug}/img/${id}`

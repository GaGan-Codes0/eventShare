import type {
  ArchiveStatus,
  ArchiveScope,
  ArchiveSummary,
  CreateEventInput,
  EventDetail,
  EventPreview,
  EventSummary,
  InvitePhotographerInput,
  InvitePhotographerResult,
  Member,
  Page,
  Photo,
  PhotoLikes,
  PhotographerInvite,
  PhotoListFilter,
  PhotoVisibility,
  UpdateEventInput,
  UpdateMemberInput,
  User,
} from '@eventshare/shared';
import { FACE_MODEL, JOIN_CODE_LENGTH } from '@eventshare/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import { api } from './client';

export const keys = {
  me: ['me'] as const,
  events: ['events'] as const,
  event: (id: string) => ['events', id] as const,
  members: (id: string) => ['events', id, 'members'] as const,
  invites: (id: string) => ['events', id, 'photographer-invites'] as const,
  /** Every filtered list of an event's photos sits under this key, so one invalidation refreshes them all. */
  photos: (id: string) => ['events', id, 'photos'] as const,
  photoList: (id: string, filter: PhotoListFilter) => ['events', id, 'photos', filter] as const,
};

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => api<User>('/me') });
}

export function useEvents() {
  return useQuery({ queryKey: keys.events, queryFn: () => api<EventSummary[]>('/events') });
}

export function useEvent(id: string | null) {
  return useQuery({
    queryKey: keys.event(id ?? ''),
    queryFn: () => api<EventDetail>(`/events/${id}`),
    enabled: Boolean(id),
  });
}

export function useMembers(id: string | null) {
  return useQuery({
    queryKey: keys.members(id ?? ''),
    queryFn: () => api<Member[]>(`/events/${id}/members`),
    enabled: Boolean(id),
  });
}

/**
 * Gallery, newest first. New photos arrive through useLiveEvent; the slow full refresh only
 * keeps the signed links of older photos from expiring in a long session.
 */
export function usePhotos(id: string | null, filter: PhotoListFilter = 'all') {
  return useInfiniteQuery({
    queryKey: keys.photoList(id ?? '', filter),
    queryFn: ({ pageParam }) =>
      api<Page<Photo>>(`/events/${id}/photos?filter=${filter}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(id),
    refetchInterval: 20 * 60_000,
  });
}

export function useJoinPreview(code: string | null) {
  return useQuery({
    queryKey: ['join', code],
    queryFn: () => api<EventPreview>(`/join/${encodeURIComponent(code ?? '')}`),
    enabled: Boolean(code && code.replace(/[\s-]/g, '').length === JOIN_CODE_LENGTH),
    retry: false,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEventInput) => api<EventDetail>('/events', { body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.events }),
  });
}

export function useJoinEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api<EventDetail>('/join', { body: { code } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.events }),
  });
}

export function useRemoveMember(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api<void>(`/events/${eventId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.event(eventId) }),
  });
}

/** Host changes: shown at once (the screen re-themes as you tap), then confirmed by the server. */
export function useUpdateEvent(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEventInput) => api<EventDetail>(`/events/${eventId}`, { method: 'PATCH', body: input }),
    onMutate: (input) => {
      const before = qc.getQueryData<EventDetail>(keys.event(eventId));
      // Only plain fields can be shown early; image keys and names wait for the server.
      const { logoKey: _l, posterKey: _p, ...shown } = input;
      if (before) qc.setQueryData(keys.event(eventId), { ...before, ...shown } as EventDetail);
      return { before };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.before) qc.setQueryData(keys.event(eventId), ctx.before);
    },
    onSuccess: (event) => {
      qc.setQueryData(keys.event(eventId), event);
      void qc.invalidateQueries({ queryKey: keys.events });
    },
  });
}

/** Host makes a guest the event's photographer, or back. */
/** Host: email invites to be a photographer that haven't been taken up yet. */
export function usePhotographerInvites(eventId: string | null, enabled = true) {
  return useQuery({
    queryKey: keys.invites(eventId ?? ''),
    queryFn: () => api<PhotographerInvite[]>(`/events/${eventId}/photographer-invites`),
    enabled: Boolean(eventId) && enabled,
  });
}

/** Host invites someone by email; someone already in the event becomes the photographer at once. */
export function useInvitePhotographer(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InvitePhotographerInput) =>
      api<InvitePhotographerResult>(`/events/${eventId}/photographer-invites`, { body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.invites(eventId) });
      void qc.invalidateQueries({ queryKey: keys.members(eventId) });
      void qc.invalidateQueries({ queryKey: keys.event(eventId) });
    },
  });
}

export function useCancelPhotographerInvite(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => api<void>(`/events/${eventId}/photographer-invites/${inviteId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.invites(eventId) });
      void qc.invalidateQueries({ queryKey: keys.event(eventId) });
    },
  });
}

export function useSetMemberRole(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string } & UpdateMemberInput) =>
      api<Member>(`/events/${eventId}/members/${userId}`, { method: 'PATCH', body: { role } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.members(eventId) });
      void qc.invalidateQueries({ queryKey: keys.event(eventId) });
    },
  });
}

export function useRotateCode(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<EventDetail>(`/events/${eventId}/rotate-code`, { method: 'POST' }),
    onSuccess: (event) => qc.setQueryData(keys.event(eventId), event),
  });
}

export function useDeletePhoto(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => api<void>(`/photos/${photoId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.event(eventId) }),
  });
}

export function useSetPhotoVisibility(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ photoId, visibility }: { photoId: string; visibility: PhotoVisibility }) =>
      api<Photo>(`/photos/${photoId}`, { method: 'PATCH', body: { visibility } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.photos(eventId) }),
  });
}

/** Host approves a guest photo waiting for review. Declining is deleting it. */
export function useApprovePhoto(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => api<Photo>(`/photos/${photoId}`, { method: 'PATCH', body: { approved: true } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.photos(eventId) });
      void qc.invalidateQueries({ queryKey: keys.event(eventId) });
    },
  });
}

/**
 * Like or unlike. The heart and count change the moment it's tapped, in every cached list;
 * the server's answer then sets the true count (or the old one comes back if it failed).
 */
export function useLikePhoto(eventId: string) {
  const qc = useQueryClient();
  const patch = (photoId: string, change: (p: Photo) => Partial<Photo>) =>
    qc.setQueriesData<InfiniteData<Page<Photo>>>({ queryKey: keys.photos(eventId) }, (data) =>
      data
        ? { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.map((p) => (p.id === photoId ? { ...p, ...change(p) } : p)) })) }
        : data,
    );
  return useMutation({
    mutationFn: ({ photoId, liked }: { photoId: string; liked: boolean }) =>
      api<PhotoLikes>(`/photos/${photoId}/like`, { method: liked ? 'PUT' : 'DELETE' }),
    onMutate: async ({ photoId, liked }) => {
      await qc.cancelQueries({ queryKey: keys.photos(eventId) });
      let before: PhotoLikes | undefined;
      patch(photoId, (p) => {
        before ??= { likeCount: p.likeCount, likedByMe: p.likedByMe };
        if (p.likedByMe === liked) return {};
        return { likedByMe: liked, likeCount: Math.max(0, p.likeCount + (liked ? 1 : -1)) };
      });
      return { before };
    },
    onError: (_err, { photoId }, ctx) => {
      if (ctx?.before) patch(photoId, () => ctx.before!);
    },
    onSuccess: (likes, { photoId }) => patch(photoId, () => likes),
  });
}

/** Find my photos: opt in with your selfie's faceprint (the selfie itself never leaves the phone). */
export function useSetFaceProfile(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (embedding: number[]) =>
      api<void>(`/events/${eventId}/face-profile`, { method: 'PUT', body: { model: FACE_MODEL, embedding, consent: true } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.event(eventId) });
      void qc.invalidateQueries({ queryKey: keys.photoList(eventId, 'me') });
    },
  });
}

/** Opt out: your faceprint is deleted. */
export function useDeleteFaceProfile(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/events/${eventId}/face-profile`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.event(eventId) });
      void qc.invalidateQueries({ queryKey: keys.photoList(eventId, 'me') });
    },
  });
}

/** Host: counts and sizes for "Download all". */
export function useArchiveSummary(eventId: string | null) {
  return useQuery({
    queryKey: ['events', eventId ?? '', 'archive'],
    queryFn: () => api<ArchiveSummary>(`/events/${eventId}/archive`),
    enabled: Boolean(eventId),
  });
}

/**
 * Host: asks for the ZIP of originals. The server reuses one if the photos haven't changed, else
 * builds it in the background; ask again until it says ready.
 */
export function requestArchive(eventId: string, scope: ArchiveScope) {
  return api<ArchiveStatus>(`/events/${eventId}/archive`, { body: { scope } });
}

export function getDownloadUrl(photoId: string) {
  return api<{ url: string }>(`/photos/${photoId}/download`);
}

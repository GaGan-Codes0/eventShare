import type { EventDetail, Photo } from '@eventshare/shared';
import { Directory, File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { Check } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { Banner, Button, Text } from '@/components/ui';
import { icon, radius, screenPadding, space } from '@/constants/theme';
import { FRAMED_COPY_WIDTH, FramedCopy, HostFramedCopy } from '@/features/events/event-frame';
import { TEMPLATE_RATIO, TemplateFrame } from '@/features/events/frame-templates';
import { exportFiltered, FILTER_LABEL } from '@/features/gallery/photo-filters';
import { dateAsSavedNow } from '@/features/gallery/saved-date';
import { getDownloadUrl } from '@/services/api/hooks';
import { setPreference, usePreferences } from '@/store/preferences';
import { makeStyles, useTheme } from '@/theme';
import { formatEventDate } from '@/utils/format';

type Props = { photo: Photo; event: EventDetail | undefined; onClose: () => void };

/**
 * Save to the phone: the untouched original, a copy with the event's photo look, a framed copy
 * in the event's theme, or any mix. Each person picks; the choice is remembered on their phone.
 */
export function SaveSheet({ photo, event, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const prefs = usePreferences();
  const { width } = useWindowDimensions();
  const [local, setLocal] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ratio, setRatio] = useState(photo.width && photo.height ? photo.width / photo.height : 4 / 3);
  const [copyHeight, setCopyHeight] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  // The look baked into a full-quality copy, made once from the original (null: couldn't).
  const [looked, setLooked] = useState<string | null | undefined>(undefined);
  const copy = useRef<ComponentRef<typeof View>>(null);
  const hostCopy = useRef<ComponentRef<typeof View>>(null);
  // The host's frame, uploaded or ready-made: its shape (an upload's once loaded), and whether
  // the photo in it has drawn.
  const frameUrl = event?.frameUrl ?? null;
  const template = frameUrl ? null : (event?.frameTemplate ?? null);
  const [uploadRatio, setFrameRatio] = useState<number | null>(null);
  const frameRatio = template ? TEMPLATE_RATIO : uploadRatio;
  const [hostPhotoLoaded, setHostPhotoLoaded] = useState(false);
  const look = event?.filter ?? 'natural';
  const hasLook = look !== 'natural';

  // Both choices start from the original at full quality, downloaded once.
  useEffect(() => {
    let cancelled = false;
    let file: File | null = null;
    void (async () => {
      try {
        const { url } = await getDownloadUrl(photo.id);
        const dir = new Directory(Paths.cache, 'downloads');
        dir.create({ intermediates: true, idempotent: true });
        file = await File.downloadFileAsync(url, dir, { idempotent: true });
        if (cancelled) return;
        setLocal(file);
        if (look !== 'natural') {
          const uri = await exportFiltered(file.uri, look).catch(() => null);
          if (!cancelled) setLooked(uri);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't download the photo");
      }
    })();
    return () => {
      cancelled = true;
      if (file?.exists) file.delete();
    };
  }, [photo.id, look]);

  const wantLook = hasLook && prefs.saveFiltered;
  const wantHostFrame = Boolean(frameUrl || template) && prefs.saveHostFrame;
  const nothing = !prefs.saveOriginal && !prefs.saveFramed && !wantLook && !wantHostFrame;
  // The framed copies show the look too, so they wait for the looked copy.
  const ready =
    Boolean(local) &&
    (!prefs.saveFramed || loaded) &&
    (!wantHostFrame || (frameRatio !== null && hostPhotoLoaded)) &&
    (!hasLook || looked !== undefined);
  const framedSource = (hasLook && looked) || local?.uri;
  const scale = (width - screenPadding * 2) / FRAMED_COPY_WIDTH;

  async function save() {
    if (!local) return;
    setSaving(true);
    try {
      const perm = await requestPermissionsAsync(true);
      if (!perm.granted) throw new Error('Allow eventShare to add photos in Settings.');
      if (prefs.saveOriginal) {
        // Dated as saved now, so it's at the top of the gallery, not back on the event day.
        await dateAsSavedNow(local.uri);
        await Asset.create(local.uri);
      }
      if (wantLook) {
        if (!looked) throw new Error('This phone couldn’t apply the look to this photo. The original saves fine.');
        await Asset.create(looked);
      }
      if (prefs.saveFramed) {
        const uri = await captureRef(copy, { format: 'jpg', quality: 0.92, result: 'tmpfile' });
        await Asset.create(uri);
        new File(uri).delete();
      }
      if (wantHostFrame) {
        const uri = await captureRef(hostCopy, { format: 'jpg', quality: 0.92, result: 'tmpfile' });
        await Asset.create(uri);
        new File(uri).delete();
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const kept = [
        prefs.saveOriginal && 'the original',
        wantLook && `the ${FILTER_LABEL[look]} copy`,
        prefs.saveFramed && 'the framed copy',
        wantHostFrame && 'the copy in the host’s frame',
      ].filter(Boolean);
      const list = kept.length > 1 ? `${kept.slice(0, -1).join(', ')} and ${kept.at(-1)}` : String(kept[0]);
      Alert.alert('Saved', `${list.replace(/^./, (c) => c.toUpperCase())} ${kept.length > 1 ? 'are' : 'is'} in your library.`);
      onClose();
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
        <Text variant="eyebrow">Save to your phone</Text>
        <Text variant="h2">What would you like to keep?</Text>

        <Option
          title="Original photo"
          caption="Exactly as it was taken, full quality."
          checked={prefs.saveOriginal}
          onPress={() => setPreference('saveOriginal', !prefs.saveOriginal)}
        />
        {hasLook && (
          <Option
            title={`With the ${FILTER_LABEL[look]} look`}
            caption="Full quality, with the event’s photo look. The original stays as it is."
            checked={prefs.saveFiltered}
            onPress={() => setPreference('saveFiltered', !prefs.saveFiltered)}
          />
        )}
        {(frameUrl || template) && (
          <>
            <Option
              title="In the host’s frame"
              caption="Inside the frame the hosts made for this event. The original stays as it is."
              checked={prefs.saveHostFrame}
              onPress={() => setPreference('saveHostFrame', !prefs.saveHostFrame)}
            />
            <View style={[styles.preview, { height: frameRatio ? (FRAMED_COPY_WIDTH / frameRatio) * scale : 0 }, !prefs.saveHostFrame && styles.off]}>
              {framedSource && (!hasLook || looked !== undefined) ? (
                <View style={[styles.scaled, { transform: [{ scale }] }]}>
                  {template ? (
                    <TemplateFrame ref={hostCopy} template={template} uri={framedSource} logoUrl={event?.logoUrl ?? null} onPhotoLoad={() => setHostPhotoLoaded(true)} />
                  ) : frameUrl ? (
                    <HostFramedCopy
                      ref={hostCopy}
                      uri={framedSource}
                      frameUrl={frameUrl}
                      frameRatio={frameRatio ?? 1}
                      onFrameLoad={(size) => size.width && size.height && setFrameRatio(size.width / size.height)}
                      onPhotoLoad={() => setHostPhotoLoaded(true)}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          </>
        )}
        <Option
          title="Framed copy"
          caption={`With ${event?.name ?? 'the event'}’s frame${event?.logoUrl ? ', logo' : ''} and name. The original stays as it is.`}
          checked={prefs.saveFramed}
          onPress={() => setPreference('saveFramed', !prefs.saveFramed)}
        />

        <View style={[styles.preview, { height: copyHeight * scale }, !prefs.saveFramed && styles.off]}>
          {framedSource && (!hasLook || looked !== undefined) ? (
            <View style={[styles.scaled, { transform: [{ scale }] }]}>
              <FramedCopy
                ref={copy}
                uri={framedSource}
                ratio={ratio}
                eventName={event?.name ?? ''}
                date={formatEventDate(event?.startsAt ?? photo.takenAt ?? photo.createdAt)}
                logoUrl={event?.logoUrl ?? null}
                onHeight={setCopyHeight}
                onLoad={(size) => {
                  if (size.width && size.height) setRatio(size.width / size.height);
                  setLoaded(true);
                }}
              />
            </View>
          ) : null}
        </View>
        {!local && !error && (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text variant="caption" color="muted">
              Getting the full-quality photo…
            </Text>
          </View>
        )}
        {error && <Banner tone="danger">{error}</Banner>}

        <View style={styles.actions}>
          <Button label="Save" fullWidth disabled={nothing || !ready} loading={saving} onPress={save} />
          <Button label="Cancel" variant="ghost" fullWidth onPress={onClose} />
        </View>
      </ScrollView>
    </Modal>
  );
}

function Option({ title, caption, checked, onPress }: { title: string; caption: string; checked: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={[styles.option, checked && styles.optionOn]}>
      <View style={[styles.box, checked && styles.boxOn]}>{checked && <Check size={icon.sm} color={colors.onPrimary} />}</View>
      <View style={styles.optionText}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color="muted">
          {caption}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { padding: screenPadding, paddingTop: space['2xl'], paddingBottom: space['4xl'], gap: space.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  optionOn: { borderColor: colors.primary },
  optionText: { flex: 1, gap: 2 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  // Laid out full size, shown scaled down from its top-left corner.
  scaled: { position: 'absolute', top: 0, left: 0, width: FRAMED_COPY_WIDTH, transformOrigin: 'top left' },
  preview: { marginTop: space.sm, overflow: 'hidden', borderRadius: radius.sm },
  off: { opacity: 0.35 },
  loading: { alignItems: 'center', gap: space.sm, paddingVertical: space['2xl'] },
  actions: { gap: space.sm, marginTop: space.md },
}));

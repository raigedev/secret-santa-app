import "server-only";

import { GROUP_IMAGE_BUCKET, normalizeGroupImagePath } from "@/lib/groups/group-image";
import {
  getProfileAvatarStoragePathForUser,
  isProfileAvatarStoragePathForUser,
  PROFILE_AVATAR_BUCKET,
} from "@/lib/profile/avatar";
import { recordServerFailure } from "@/lib/security/audit";
import { supabaseAdmin } from "@/lib/supabase/admin";

const PROFILE_AVATAR_CLEANUP_PAGE_SIZE = 100;

async function collectProfileAvatarPathsForDeletion(
  userId: string,
  avatarUrl: string | null | undefined
): Promise<{ paths: string[]; success: true } | { message: string; success: false }> {
  const avatarPaths = new Set<string>();
  const currentAvatarPath = getProfileAvatarStoragePathForUser(userId, avatarUrl);

  if (currentAvatarPath) {
    avatarPaths.add(currentAvatarPath);
  }

  for (let offset = 0; ; offset += PROFILE_AVATAR_CLEANUP_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin.storage
      .from(PROFILE_AVATAR_BUCKET)
      .list(userId, {
        limit: PROFILE_AVATAR_CLEANUP_PAGE_SIZE,
        offset,
      });

    if (error) {
      await recordServerFailure({
        actorUserId: userId,
        errorMessage: error.message,
        eventType: "profile.delete_account.avatar_list",
        resourceId: userId,
        resourceType: "profile",
      });

      return {
        success: false,
        message: "We could not clear your uploaded photos. Please try again.",
      };
    }

    for (const file of data || []) {
      const storagePath = `${userId}/${file.name}`;

      if (isProfileAvatarStoragePathForUser(userId, storagePath)) {
        avatarPaths.add(storagePath);
      }
    }

    if (!data || data.length < PROFILE_AVATAR_CLEANUP_PAGE_SIZE) {
      break;
    }
  }

  return { paths: [...avatarPaths], success: true };
}

export async function cleanupProfileAvatarStorageForAccountDeletion(
  userId: string,
  avatarUrl: string | null | undefined
): Promise<{ removedCount: number; success: true } | { message: string; success: false }> {
  const avatarPathResult = await collectProfileAvatarPathsForDeletion(userId, avatarUrl);

  if (!avatarPathResult.success) {
    return avatarPathResult;
  }

  const avatarPaths = avatarPathResult.paths;

  if (avatarPaths.length === 0) {
    return { removedCount: 0, success: true };
  }

  const { error } = await supabaseAdmin.storage
    .from(PROFILE_AVATAR_BUCKET)
    .remove([...avatarPaths]);

  if (error) {
    await recordServerFailure({
      actorUserId: userId,
      details: { avatarPathCount: avatarPaths.length },
      errorMessage: error.message,
      eventType: "profile.delete_account.avatar_cleanup",
      resourceId: userId,
      resourceType: "profile",
    });

    return {
      success: false,
      message: "We could not clear your uploaded photos. Please try again.",
    };
  }

  return { removedCount: avatarPaths.length, success: true };
}

export async function cleanupReplacedProfileAvatar({
  nextAvatarUrl,
  previousAvatarUrl,
  userId,
}: {
  nextAvatarUrl: string | null | undefined;
  previousAvatarUrl: string | null | undefined;
  userId: string;
}): Promise<void> {
  const previousAvatarPath = getProfileAvatarStoragePathForUser(userId, previousAvatarUrl);
  const nextAvatarPath = getProfileAvatarStoragePathForUser(userId, nextAvatarUrl);

  if (!previousAvatarPath || previousAvatarPath === nextAvatarPath) {
    return;
  }

  const { error } = await supabaseAdmin.storage
    .from(PROFILE_AVATAR_BUCKET)
    .remove([previousAvatarPath]);

  if (error) {
    await recordServerFailure({
      actorUserId: userId,
      errorMessage: error.message,
      eventType: "profile.avatar_cleanup",
      resourceId: userId,
      resourceType: "profile",
    });
  }
}

export async function cleanupOwnedGroupImagesAfterAccountDeletion(
  userId: string,
  imageValues: Array<string | null | undefined>
): Promise<{ removedCount: number; success: true } | { message: string; success: false }> {
  const groupImagePaths = [
    ...new Set(
      imageValues
        .map((imageValue) => normalizeGroupImagePath(imageValue))
        .filter((imagePath): imagePath is string => Boolean(imagePath))
    ),
  ];

  if (groupImagePaths.length === 0) {
    return { removedCount: 0, success: true };
  }

  const { error } = await supabaseAdmin.storage
    .from(GROUP_IMAGE_BUCKET)
    .remove(groupImagePaths);

  if (error) {
    await recordServerFailure({
      actorUserId: userId,
      details: { groupImagePathCount: groupImagePaths.length },
      errorMessage: error.message,
      eventType: "profile.delete_account.group_image_cleanup",
      resourceId: userId,
      resourceType: "profile",
    });

    return {
      success: false,
      message: "We could not clear your group photos. Please try again.",
    };
  }

  return { removedCount: groupImagePaths.length, success: true };
}

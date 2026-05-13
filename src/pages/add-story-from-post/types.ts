import type { PublicProfileItem } from "@/entities/user";

export type AddStoryFromPostRouteParams = {
  postId: string;
  placeId: string | null;
  postImages: string[];
};

export type AddStoryFriendVm = PublicProfileItem & {
  fullName: string;
};

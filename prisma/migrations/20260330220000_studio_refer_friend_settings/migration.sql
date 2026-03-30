-- Настройки акции «приведи друга» на уровне студии
CREATE TYPE "ReferFriendInviteeRewardType" AS ENUM ('DISCOUNT_PERCENT', 'BONUS_PERCENT');
CREATE TYPE "ReferFriendReferrerRewardType" AS ENUM ('PERCENT_OF_PAYMENT', 'FIXED_AMOUNT');

ALTER TABLE "studios" ADD COLUMN "referFriendEnabled" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "studios" ADD COLUMN "referFriendInviteeRewardType" "ReferFriendInviteeRewardType";
ALTER TABLE "studios" ADD COLUMN "referFriendInviteeValue" INTEGER;
ALTER TABLE "studios" ADD COLUMN "referFriendReferrerRewardType" "ReferFriendReferrerRewardType";
ALTER TABLE "studios" ADD COLUMN "referFriendReferrerValue" INTEGER;

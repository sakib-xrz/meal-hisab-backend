-- Enforce at most one current (ACTIVE or INVITED) MessUser row per user globally.
-- Historical REMOVED/INACTIVE rows are excluded so users can rejoin later.
CREATE UNIQUE INDEX "MessUser_one_current_membership_per_user"
ON "MessUser"("userId")
WHERE "status" IN ('ACTIVE', 'INVITED');

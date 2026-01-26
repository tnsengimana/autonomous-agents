ALTER TABLE "agents" RENAME COLUMN "role" TO "type";
UPDATE "agents" SET "type" = 'lead' WHERE "type" IN ('team_lead', 'aide_lead');
UPDATE "agents" SET "type" = 'subordinate' WHERE "type" NOT IN ('lead');

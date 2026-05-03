-- Existing pro service prices should start as inquiry-only.
-- A price of 0 is preserved and rendered as "문의시 제공" on customer screens.
UPDATE "pro_services"
SET "basePrice" = 0
WHERE "isActive" = true;

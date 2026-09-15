-- The Parks Splash Water Park Party
-- Database-level hard safety rails.
--
-- The application already serialises reservations with SELECT ... FOR UPDATE.
-- These constraints/triggers add a second line of defence so a bad code path
-- or direct SQL cannot create a 56th confirmed ticket.

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_capacity_range"
  CHECK ("capacity" BETWEEN 1 AND 55);

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_price_nonnegative"
  CHECK ("priceCents" >= 0);

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_ticket_sequence_nonnegative"
  CHECK ("lastTicketSeq" >= 0);

CREATE OR REPLACE FUNCTION parks_enforce_event_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacity INTEGER;
  v_confirmed INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."eventId" <> OLD."eventId" THEN
    RAISE EXCEPTION 'Ticket event cannot be changed after creation'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Lock the authoritative Event row. This makes this database guard safe
  -- even if two independent writers try to confirm tickets concurrently.
  SELECT "capacity"
    INTO v_capacity
    FROM "Event"
   WHERE "id" = NEW."eventId"
   FOR UPDATE;

  IF v_capacity IS NULL THEN
    RAISE EXCEPTION 'Event % does not exist', NEW."eventId";
  END IF;

  IF NEW."status" = 'CONFIRMED' THEN
    SELECT COUNT(*)
      INTO v_confirmed
      FROM "Ticket"
     WHERE "eventId" = NEW."eventId"
       AND "status" = 'CONFIRMED'
       AND "id" <> NEW."id";

    IF v_confirmed >= v_capacity THEN
      RAISE EXCEPTION 'EVENT_SOLD_OUT: event % has reached capacity %',
        NEW."eventId", v_capacity
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Ticket_enforce_event_capacity" ON "Ticket";

CREATE TRIGGER "Ticket_enforce_event_capacity"
BEFORE INSERT OR UPDATE OF "status", "eventId"
ON "Ticket"
FOR EACH ROW
EXECUTE FUNCTION parks_enforce_event_capacity();

-- Task 28: hours with "byAppointment": true are never open now (the twin of core isOpenAt).
CREATE OR REPLACE FUNCTION darb_open_at(hours jsonb, at timestamptz) RETURNS boolean STABLE LANGUAGE sql AS $$
  WITH m AS (
    SELECT (at AT TIME ZONE 'Asia/Jerusalem')::date AS d,
           (extract(hour FROM at AT TIME ZONE 'Asia/Jerusalem') * 60
            + extract(minute FROM at AT TIME ZONE 'Asia/Jerusalem'))::int AS mins
  )
  SELECT COALESCE(hours -> 'byAppointment', 'false'::jsonb) <> 'true'::jsonb AND (
    EXISTS (
      SELECT 1 FROM m, jsonb_array_elements(darb_intervals(hours, m.d)) AS i
       WHERE CASE WHEN darb_minutes(i ->> 'close') > darb_minutes(i ->> 'open')
                  THEN m.mins >= darb_minutes(i ->> 'open') AND m.mins < darb_minutes(i ->> 'close')
                  ELSE m.mins >= darb_minutes(i ->> 'open') END)
    OR EXISTS (
      SELECT 1 FROM m, jsonb_array_elements(darb_intervals(hours, m.d - 1)) AS i
       WHERE darb_minutes(i ->> 'close') <= darb_minutes(i ->> 'open')
         AND m.mins < darb_minutes(i ->> 'close')))
$$;

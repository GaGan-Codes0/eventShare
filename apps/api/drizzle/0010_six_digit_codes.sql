-- Event codes become 6 digits (as in the prototype): give every existing event a new, unique one.
DO $$
DECLARE
  r record;
  c text;
BEGIN
  FOR r IN SELECT id FROM events LOOP
    LOOP
      c := lpad(floor(random() * 1000000)::int::text, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM events WHERE join_code = c);
    END LOOP;
    UPDATE events SET join_code = c WHERE id = r.id;
  END LOOP;
END $$;

-- The salon is in Israel: shekels, Asia/Jerusalem.
--
-- Updates the live settings row and the column defaults, so a database
-- rebuilt from scratch starts with the same values rather than the
-- eu-central-1 guesses (Europe/Berlin / EUR) it was created with.

alter table public.settings
  alter column timezone set default 'Asia/Jerusalem',
  alter column currency set default 'ILS';

update public.settings
   set timezone   = 'Asia/Jerusalem',
       currency   = 'ILS',
       updated_at = now()
 where id;

-- Backfill localized name_* and description_* for all business_cards.
-- Mirrors scripts/seed-business-cards/venueLocalizedCopy.mjs (POI name + city + category pool).
-- English base columns (name, description) are refreshed; ru/es/pt/fr/de get matching copy.
-- Brand names are kept identical across locales (same as Google POI seed behaviour).

create or replace function public.business_card_city_short(p_city text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(split_part(coalesce(p_city, ''), ',', 1)), ''),
    nullif(trim(p_city), ''),
    ''
  );
$$;

comment on function public.business_card_city_short(text) is
  'First segment of business_cards.city (before comma).';

create or replace function public.business_card_category_pool(p_category_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    (
      select case lower(trim(c.name))
        when 'restaurants' then 'restaurant'
        when 'bars' then 'bar'
        when 'beauty' then 'beauty'
        when 'clubs' then 'club'
        when 'entertainment' then 'coworking'
        when 'fitness' then 'gym'
        when 'hotels' then 'hotel'
        else 'restaurant'
      end
      from public.categories c
      where c.id = p_category_id
    ),
    'restaurant'
  );
$$;

comment on function public.business_card_category_pool(uuid) is
  'Maps categories.id → seed photo pool key for localized description templates.';

create or replace function public.business_card_localized_description(
  p_name text,
  p_city text,
  p_category_id uuid,
  p_locale text
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  n text;
  city_short text;
  pool text;
  loc text;
begin
  n := coalesce(nullif(trim(p_name), ''), 'Venue');
  city_short := public.business_card_city_short(p_city);
  pool := public.business_card_category_pool(p_category_id);
  loc := lower(coalesce(nullif(trim(p_locale), ''), 'en'));

  if pool = 'bar' then
    case loc
      when 'ru' then return format('«%s» — бар в %s. Напитки, закуски и вечерняя атмосфера.', n, city_short);
      when 'es' then return format('%s: bar en %s. Copas, tapas y ambiente nocturno.', n, city_short);
      when 'pt' then return format('%s — bar em %s. Drinks, petiscos e ambiente noturno.', n, city_short);
      when 'fr' then return format('%s — bar à %s. Boissons, planches et ambiance du soir.', n, city_short);
      when 'de' then return format('%s — Bar in %s. Drinks, kleine Gerichte und Abendstimmung.', n, city_short);
      else return format('%s — bar in %s. Drinks, small plates, and evening atmosphere.', n, city_short);
    end case;
  elsif pool = 'cafe' then
    case loc
      when 'ru' then return format('«%s» — кафе в %s. Кофе, выпечка и спокойная атмосфера.', n, city_short);
      when 'es' then return format('%s: cafetería en %s. Café, bollería y ambiente tranquilo.', n, city_short);
      when 'pt' then return format('%s — café em %s. Café, pastelaria e pausa descontraída.', n, city_short);
      when 'fr' then return format('%s — café à %s. Boissons chaudes, pâtisseries et pause détente.', n, city_short);
      when 'de' then return format('%s — Café in %s. Kaffee, Gebäck und entspannte Atmosphäre.', n, city_short);
      else return format('%s — café in %s. Coffee, pastries, and a relaxed stop anytime.', n, city_short);
    end case;
  elsif pool = 'hotel' then
    case loc
      when 'ru' then return format('«%s» — отель в %s. Комфортные номера и удобное расположение.', n, city_short);
      when 'es' then return format('%s: hotel en %s. Habitaciones cómodas y buena ubicación.', n, city_short);
      when 'pt' then return format('%s — hotel em %s. Quartos confortáveis e localização central.', n, city_short);
      when 'fr' then return format('%s — hôtel à %s. Chambres confortables et accès pratique.', n, city_short);
      when 'de' then return format('%s — Hotel in %s. Komfortable Zimmer und zentrale Lage.', n, city_short);
      else return format('%s — hotel stay in %s. Comfortable rooms and central access.', n, city_short);
    end case;
  elsif pool = 'gym' then
    case loc
      when 'ru' then return format('«%s» — фитнес-клуб в %s. Залы для тренировок и гибкие абонементы.', n, city_short);
      when 'es' then return format('%s: gimnasio en %s. Zonas de entrenamiento y membresías flexibles.', n, city_short);
      when 'pt' then return format('%s — ginásio em %s. Áreas de treino e planos flexíveis.', n, city_short);
      when 'fr' then return format('%s — salle de sport à %s. Espaces d''entraînement et abonnements flexibles.', n, city_short);
      when 'de' then return format('%s — Fitnessstudio in %s. Trainingsbereiche und flexible Mitgliedschaften.', n, city_short);
      else return format('%s — fitness club in %s. Training floors and flexible memberships.', n, city_short);
    end case;
  elsif pool = 'beauty' then
    case loc
      when 'ru' then return format('«%s» — салон красоты в %s. Услуги для волос и кожи по записи.', n, city_short);
      when 'es' then return format('%s: salón de belleza en %s. Pelo, piel y citas previas.', n, city_short);
      when 'pt' then return format('%s — salão de beleza em %s. Cabelo, pele e marcação de horário.', n, city_short);
      when 'fr' then return format('%s — salon de beauté à %s. Cheveux, peau et rendez-vous sur réservation.', n, city_short);
      when 'de' then return format('%s — Beauty-Salon in %s. Haar, Haut und Termine nach Vereinbarung.', n, city_short);
      else return format('%s — beauty salon in %s. Hair, skin, and appointment-based services.', n, city_short);
    end case;
  elsif pool = 'club' then
    case loc
      when 'ru' then return format('«%s» — ночной клуб в %s. Вечеринки, DJ и выходные.', n, city_short);
      when 'es' then return format('%s: club nocturno en %s. Noches largas, DJ y ambiente de fin de semana.', n, city_short);
      when 'pt' then return format('%s — clube noturno em %s. Noites longas, DJs e energia de fim de semana.', n, city_short);
      when 'fr' then return format('%s — club nocturne à %s. Soirées tardives, DJ et week-ends animés.', n, city_short);
      when 'de' then return format('%s — Nachtclub in %s. Lange Nächte, DJs und Wochenendstimmung.', n, city_short);
      else return format('%s — nightclub in %s. Late nights, DJs, and weekend energy.', n, city_short);
    end case;
  elsif pool = 'coworking' then
    case loc
      when 'ru' then return format('«%s» — коворкинг в %s. Рабочие места, переговорные и дневные пропуска.', n, city_short);
      when 'es' then return format('%s: espacio de trabajo en %s. Escritorios, salas y pases diarios.', n, city_short);
      when 'pt' then return format('%s — coworking em %s. Mesas, salas de reunião e passes diários.', n, city_short);
      when 'fr' then return format('%s — espace de coworking à %s. Bureaux, salles et pass journée.', n, city_short);
      when 'de' then return format('%s — Coworking in %s. Arbeitsplätze, Meetingräume und Tagespässe.', n, city_short);
      else return format('%s — workspace in %s. Desks, meeting rooms, and day passes.', n, city_short);
    end case;
  elsif pool = 'hookah' then
    case loc
      when 'ru' then return format('«%s» — лаунж в %s. Кальян, напитки и уютная посадка.', n, city_short);
      when 'es' then return format('%s: lounge en %s. Shisha, copas y ambiente relajado.', n, city_short);
      when 'pt' then return format('%s — lounge em %s. Hookah, bebidas e ambiente descontraído.', n, city_short);
      when 'fr' then return format('%s — lounge à %s. Chicha, boissons et ambiance détendue.', n, city_short);
      when 'de' then return format('%s — Lounge in %s. Shisha, Drinks und entspannte Sitzplätze.', n, city_short);
      else return format('%s — lounge in %s. Hookah, drinks, and relaxed seating.', n, city_short);
    end case;
  else
    -- restaurant (default)
    case loc
      when 'ru' then return format('«%s» — ресторан в %s. Забронируйте стол на обед или ужин.', n, city_short);
      when 'es' then return format('%s: restaurante en %s. Reserva mesa para comer o cenar.', n, city_short);
      when 'pt' then return format('%s — restaurante em %s. Reserve mesa para almoço ou jantar.', n, city_short);
      when 'fr' then return format('%s — restaurant à %s. Réservez une table pour déjeuner ou dîner.', n, city_short);
      when 'de' then return format('%s — Restaurant in %s. Tisch für Mittag- oder Abendessen reservieren.', n, city_short);
      else return format('%s — restaurant in %s. Reserve a table for lunch or dinner.', n, city_short);
    end case;
  end if;
end;
$$;

comment on function public.business_card_localized_description(text, text, uuid, text) is
  'Localized venue description from canonical name, city, and category (seed copy templates).';

-- Backfill all rows (requires non-empty English name).
update public.business_cards bc
set
  description = public.business_card_localized_description(bc.name, bc.city, bc.category_id, 'en'),
  name_ru = trim(bc.name),
  name_es = trim(bc.name),
  name_pt = trim(bc.name),
  name_fr = trim(bc.name),
  name_de = trim(bc.name),
  description_ru = public.business_card_localized_description(bc.name, bc.city, bc.category_id, 'ru'),
  description_es = public.business_card_localized_description(bc.name, bc.city, bc.category_id, 'es'),
  description_pt = public.business_card_localized_description(bc.name, bc.city, bc.category_id, 'pt'),
  description_fr = public.business_card_localized_description(bc.name, bc.city, bc.category_id, 'fr'),
  description_de = public.business_card_localized_description(bc.name, bc.city, bc.category_id, 'de')
where nullif(trim(bc.name), '') is not null;

-- TripAI — Seed data (Kura Family Europe 2026)
-- Run AFTER schema.sql.
-- Uses DO $$ ... $$ blocks so UUIDs are shared across inserts.

do $$
declare
  v_owner_id  uuid := gen_random_uuid();
  v_spouse_id uuid := gen_random_uuid();
  v_trip_id   uuid := gen_random_uuid();
begin

  -- ───────────────────────────────────────────
  -- Users (2 adults)
  -- ───────────────────────────────────────────
  insert into users (id, email, name)
  values
    (v_owner_id,  'owner@kura.family',  'Kura Owner'),
    (v_spouse_id, 'spouse@kura.family', 'Kura Spouse');

  -- ───────────────────────────────────────────
  -- Trip
  -- ───────────────────────────────────────────
  insert into trips (id, name, owner_id, start_date, end_date, budget_cap, status)
  values (
    v_trip_id,
    'Kura Family Europe 2026',
    v_owner_id,
    '2026-06-19',
    '2026-07-05',
    25000.00,
    'planning'
  );

  -- ───────────────────────────────────────────
  -- Trip members
  -- ───────────────────────────────────────────
  insert into trip_members (trip_id, user_id, role)
  values
    (v_trip_id, v_owner_id,  'owner'),
    (v_trip_id, v_spouse_id, 'member');

  -- ───────────────────────────────────────────
  -- Bookings (14 items)
  -- ───────────────────────────────────────────
  insert into bookings
    (trip_id, title, subtitle, category, urgency, estimated_cost, deadline, discount_code, card_tip)
  values
    -- fire (book this week)
    (v_trip_id,
     'Flights SFO→LHR + MXP→SFO',
     '4 travelers — Indian passports (adults), US passports (kids)',
     'flights', 'fire', 4800.00,
     'This week', null,
     'Amex Gold (3X MR on flights)'),

    (v_trip_id,
     'Eurostar London→Paris Jun 23',
     'Standard Premier class',
     'trains', 'fire', 400.00,
     'This week', 'Standard Premier',
     'Venture X (no FX fee)'),

    (v_trip_id,
     'Hotel Metropole Interlaken Jun 27–Jul 1',
     '5 nights, 4 travelers',
     'hotels', 'fire', 1300.00,
     'This week', null,
     'Venture X (no FX fee, CHF)'),

    (v_trip_id,
     'Skydive Interlaken deposit Jul 1',
     'Parents only — advance deposit',
     'activities', 'fire', 100.00,
     'This week', null,
     'Venture X (no FX fee, CHF)'),

    -- now (book this week, slightly lower urgency)
    (v_trip_id,
     'Crowne Plaza London Kings Cross Jun 20–22',
     '3 nights — IHG rate',
     'hotels', 'now', 870.00,
     'This week', '100270748',
     'Amex Gold via AmexTravel (2X MR) — IHG 14% off code 100270748'),

    (v_trip_id,
     'Novotel Paris Les Halles Jun 23–26',
     '4 nights — Accor META rate',
     'hotels', 'now', 1000.00,
     'This week', 'SC196337864',
     'Amex Gold via AmexTravel — Accor 15% off code SC196337864 · Access FA564US684'),

    (v_trip_id,
     'Hyatt Centric Milan Centrale Jul 2–4',
     '3 nights — Meta leisure rate',
     'hotels', 'now', 735.00,
     'This week', '151340',
     'Amex Gold via AmexTravel — Hyatt code 151340'),

    (v_trip_id,
     'Train Paris→Basel→Interlaken Jun 27',
     'TGV + regional connection',
     'trains', 'now', 280.00,
     'This week', null,
     'Venture X (no FX fee)'),

    -- soon (book by April–June)
    (v_trip_id,
     'Eiffel Tower tickets Jun 24',
     'Timed entry — book early, sells out',
     'activities', 'soon', 150.00,
     'Apr 25', null,
     'Venture X (no FX fee)'),

    (v_trip_id,
     'Louvre timed entry Jun 25 9am',
     'First slot — avoids peak crowds',
     'activities', 'soon', 100.00,
     'Late April', null,
     'Venture X (no FX fee)'),

    (v_trip_id,
     'Anniversary dinner Jun 26 Paris',
     'Special dinner — anniversary date',
     'food', 'soon', 300.00,
     'May', null,
     'Venture X (no FX fee)'),

    (v_trip_id,
     'Train Interlaken→Milan Jul 2',
     'Regional + Trenitalia connection',
     'trains', 'soon', 200.00,
     'May', null,
     'Venture X (no FX fee)'),

    (v_trip_id,
     'Milan Duomo rooftop Jul 3',
     'Timed entry rooftop terrace',
     'activities', 'soon', 80.00,
     'May', null,
     'Venture X (no FX fee)'),

    (v_trip_id,
     'Airalo eSIM 4 devices',
     'Europe data plan — all 4 travelers',
     'misc', 'soon', 90.00,
     'Jun 12', null,
     'Venture X (no FX fee)');

  -- ───────────────────────────────────────────
  -- Itinerary days (17 days)
  -- ───────────────────────────────────────────
  insert into itinerary_days
    (trip_id, date, city, country, title, plan, intensity, is_special, special_label)
  values
    (v_trip_id, '2026-06-19', 'San Francisco', 'US',
     'Depart SFO — Europe trip begins',
     'Early check-in at SFO. Long-haul SFO→LHR flight departs today. 4 travelers: 2 adults (Indian passports, H-1B), 2 kids (US passports). Overnight flight — arrive London Jun 20.',
     'travel', false, null),

    (v_trip_id, '2026-06-20', 'London', 'UK',
     'Arrive London — jet lag buffer',
     'Arrive LHR, transfer to Crowne Plaza Kings Cross. Light afternoon walk around King''s Cross and Granary Square. Early dinner and rest to recover from the long-haul SFO→LHR flight.',
     'light', false, null),

    (v_trip_id, '2026-06-21', 'London', 'UK',
     'London Bridge, Borough Market & South Bank',
     'Morning Borough Market for breakfast. Walk across London Bridge, explore Southwark Cathedral. Afternoon along the South Bank: Tate Modern, Millennium Bridge, Globe Theatre exterior. Evening fish and chips near the riverbank.',
     'moderate', false, null),

    (v_trip_id, '2026-06-22', 'London', 'UK',
     'Westminster, Big Ben & Natural History Museum',
     'Morning Westminster: Houses of Parliament, Big Ben, Westminster Abbey exterior, St. James''s Park. Afternoon: Natural History Museum (kids love the dinosaurs). Optional: Victoria & Albert Museum. Final London dinner — try a pub roast.',
     'busy', false, null),

    (v_trip_id, '2026-06-23', 'Paris', 'France',
     'Eurostar to Paris — arrive & explore Le Marais',
     'Morning Eurostar St Pancras → Gare du Nord (Standard Premier). Check in Novotel Les Halles. Afternoon walk through Le Marais: Place des Vosges, Sainte-Chapelle exterior. Crepes at a street stall. Easy dinner near the hotel.',
     'travel', false, null),

    (v_trip_id, '2026-06-24', 'Paris', 'France',
     'Eiffel Tower & Champ de Mars',
     'Morning timed entry Eiffel Tower (tickets pre-booked). Picnic lunch on Champ de Mars. Afternoon walk along the Seine, Trocadéro views. Evening optional Seine river cruise. Kids'' first look at Paris from the tower.',
     'busy', false, null),

    (v_trip_id, '2026-06-25', 'Paris', 'France',
     'Louvre 9am & Musée d''Orsay afternoon',
     'Louvre timed entry 9am — Mona Lisa, Venus de Milo, Egyptian wing (2–3 hours). Lunch near Palais Royal. Afternoon Musée d''Orsay: Impressionist masterpieces. Evening stroll along the Seine. Light dinner.',
     'busy', false, null),

    (v_trip_id, '2026-06-26', 'Paris', 'France',
     'Anniversary — Montmartre & special dinner',
     'Morning Montmartre: Sacré-Cœur, artist square, panoramic views over Paris. Lunch at a brasserie in the 18th. Afternoon free — kids activities or rest. Evening: anniversary dinner (reservation required by May). One of the best meals of the trip.',
     'special', true, 'Anniversary'),

    (v_trip_id, '2026-06-27', 'Interlaken', 'CH',
     'Birthday — TGV Paris→Basel→Interlaken',
     'Morning TGV Paris Gare de Lyon → Basel, regional train Basel → Interlaken Ost. Arrive mid-afternoon. Birthday celebration: check in Hotel Metropole, cake, evening walk along Höheweg with Eiger-Mönch-Jungfrau panorama.',
     'travel', true, 'Birthday'),

    (v_trip_id, '2026-06-28', 'Interlaken', 'CH',
     'Lake Brienz boat & rest day',
     'Leisurely morning. Afternoon boat cruise on turquoise Lake Brienz to Giessbach Falls. Easy hike or walk near the falls. Return to Interlaken by early evening. Low-key dinner — Swiss fondue optional.',
     'light', false, null),

    (v_trip_id, '2026-06-29', 'Interlaken', 'CH',
     'Titlis Mountain Day (Engelberg)',
     'Early train to Engelberg, then Rotair cable car to Mt. Titlis (3020m). Glacier walk, cliff walk, snow play for kids. Lunch at the summit restaurant. Afternoon descent and explore Engelberg village. Return to Interlaken for dinner.',
     'busy', false, null),

    (v_trip_id, '2026-06-30', 'Interlaken', 'CH',
     'Grindelwald flex day',
     'Train to Grindelwald, hike the Bachalpsee trail (family-friendly). Eiger north face views. Afternoon flex — Männlichen or First gondola optional. Return to Interlaken. Rest and prepare for skydiving day tomorrow.',
     'light', false, null),

    (v_trip_id, '2026-07-01', 'Interlaken', 'CH',
     'Skydiving — parents only',
     'Parents: morning tandem skydiving over the Bernese Alps (deposit paid — full balance due on day). Kids: supervised activity or hotel. Afternoon family reunion and celebration. Final Swiss dinner — raclette.',
     'busy', false, null),

    (v_trip_id, '2026-07-02', 'Milan', 'Italy',
     'Train Interlaken→Milan & Navigli evening',
     'Morning train Interlaken → Milan Centrale via Brig/Domodossola. Arrive early afternoon. Check in Hyatt Centric. Evening: explore Navigli canal district, aperitivo, dinner at a traditional trattoria.',
     'travel', false, null),

    (v_trip_id, '2026-07-03', 'Milan', 'Italy',
     'Duomo rooftop, Brera & optional Last Supper',
     'Morning: Duomo di Milano cathedral and timed-entry rooftop terrace (tickets pre-booked). Galleria Vittorio Emanuele II. Afternoon: Brera neighbourhood, Pinacoteca di Brera gallery. Optional: Leonardo''s Last Supper (if tickets available). Evening: fashion district stroll.',
     'moderate', false, null),

    (v_trip_id, '2026-07-04', 'Milan', 'Italy',
     'Flex day — pack & final Milan',
     'Relaxed morning. Optional: Sforza Castle, Parco Sempione. Shopping for last gifts. Lunch at a neighbourhood trattoria. Afternoon: pack and prepare for early departure tomorrow. Farewell Italian dinner.',
     'light', false, null),

    (v_trip_id, '2026-07-05', 'Milan', 'Italy',
     'Depart MXP→SFO',
     'Early departure to Malpensa Airport (MXP). Check-in and security. Long-haul MXP→SFO flight. Return home to San Francisco after 16 nights in Europe.',
     'travel', false, null);

end $$;

-- ───────────────────────────────────────────
-- Verification queries — run after seeding
-- ───────────────────────────────────────────
-- select count(*) from users;          -- expected: 2
-- select count(*) from trips;          -- expected: 1
-- select count(*) from trip_members;   -- expected: 2
-- select count(*) from bookings;       -- expected: 14
-- select count(*) from itinerary_days; -- expected: 17
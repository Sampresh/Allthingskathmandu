# All Things Kathmandu: listings seed data

Source: Google Maps (places) and official sites/news (apps), compiled 28 Oct 2026. Data file: `listings.csv` (328 rows: 285 places, 37 apps/brands, 6 hotlines). Same content as the PDF data pack.

## Columns
category, type (BUSINESS | PLACE | APP | HOTLINE, matches `ListingType`), name, address, phone (E.164; hotlines are short codes), hours, website (domain, no scheme), desc (apps only; use as `shortDesc`), g_rating, g_reviews, place_id (Google).

Hours format: `HH:MM-HH:MM` = daily; `Mon-Fri 09:00-18:00; Sat closed` = per day range; `24h` = open 24 hours; empty = unknown. Convert to the `hours` JSON in the schema.

## Taxonomy (group: categories, row count)
- Eat & Drink: Restaurants (9), Cafes (7), Bars & Nightlife (6), Bakeries (6), Food Delivery Apps (4), Groceries & Marts (5), Grocery Delivery (4)
- Get Around: Ride Apps (5), Bus Tickets (3), Domestic Flights (3), Car & Bike Rental (6)
- Stay: Hotels (6), Hostels (6), Homestays (6)
- Essentials: SIM & Mobile (2), Home Internet (3), Wallets & Payments (4), Money Exchange & ATMs (6), Courier (6)
- Health & Wellness: Hospitals (6), Clinics (6), Pharmacies (6), Labs (5), Dentists (6), Spa & Massage (6), Gyms (6), Yoga (6)
- Shopping: Online Shopping (2), Malls (6), Electronics (6), Souvenirs & Handicrafts (6), Trekking Gear (6), Thrift & Second-hand (6)
- Things To Do: Heritage Sites (7), Viewpoints & Hikes (6), Tours & Activities (6), Movies (6), Event & Movie Tickets (4), Classes & Workshops (6)
- Home Services: Home Service Apps (3), Plumbers (6), Electricians (6), AC & Appliance Repair (5), Cleaning & Pest Control (6), Movers (6), Painters & Carpenters (6)
- Services & Events: Lawyers (6), Accountants (6), IT & Web (6), Printing (6), Education & Language (6), Party Venues (6), Photographers (6), Decorators & Catering (6), Property & Rentals (6), Auto Service (5), Pets & Vets (6)
- Emergency: Hotlines (6), 24h Hospitals (8)

## Rules when seeding
- Seed every row as `status = PENDING`, `isVerified = false`. Admin publishes after confirming phone and hours with the business and adding logo, description and WhatsApp.
- Do not store `g_rating` or `g_reviews` (Google terms). Use them only to order the review queue. Store `place_id` (allowed) for the Google Maps link `https://www.google.com/maps/place/?q=place_id:<id>` and, if wanted later, live ratings via the Places API.
- No lat/lng in the file: set location from Place Details by `place_id` at runtime or when the owner pins it.
- APP rows: empty `website` means the official link is unconfirmed; check the Play Store or App Store listing first. Uber: confirm it operates in Kathmandu before going live.
- Map `address` to an `areas` row by area name (Thamel, Patan, Boudha, etc.); unmatched rows go to Admin for manual area assignment.

## Selection and gaps
- Up to 6 per category (9 restaurants, 7 cafes), ranked by rating weighted by review count. Heritage Sites, Viewpoints & Hikes and 24h Hospitals are listed for coverage, not rating.
- Restaurants and Cafes are Thamel-heavy; add Patan, Boudha, Jhamsikhel, Baneshwor next.
- Thin Google data: Homestays (guest houses and B&Bs near the Durbar Squares), Labs, Thrift, home-service trades. Plumbers are mostly sole traders; confirm the business name they want shown.
- Heritage Sites: add foreigner entry fees from each ticket counter.
- 24h Hospitals: call each to confirm 24-hour emergency. Pashupatinath hours are as listed on Google.
- Hotlines source: Nepal Police, Tourist Police (Dept. of Tourism), UK travel advice.

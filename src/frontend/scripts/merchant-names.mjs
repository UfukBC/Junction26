/**
 * Human-readable names for the dataset's merchant ids.
 *
 * The challenge data has no merchant names: a merchant is only a code such as `MRC-RES-0022`
 * (`docs/references/dataset.md`). The demo needs recognisable places ("Ravintola Kaarti",
 * "K-Market Töölö") so the AI overview can talk about a habit instead of "a restaurant".
 *
 * The names are synthetic demo labels, not claims about real businesses. Assignment is
 * deterministic: the same merchant id always gets the same name, and no two merchants share one.
 */

/** Hand-picked names for merchants the demo leans on. */
export const PINNED_MERCHANTS = {
  // The demo customer's lunch habit (see DEMO_HABITS in build-demo-db.mjs).
  "MRC-RES-0022": "Ravintola Kaarti",
  // Frequent shops of the demo customer.
  "MRC-GRO-0029": "K-Market Töölö",
  "MRC-GRO-0032": "S-Market Kamppi",
  "MRC-GRO-0049": "Alepa Punavuori",
};

const AREAS = [
  "Kamppi",
  "Kallio",
  "Töölö",
  "Punavuori",
  "Hakaniemi",
  "Pasila",
  "Ullanlinna",
  "Eira",
  "Vallila",
  "Arabianranta",
  "Tapiola",
  "Otaniemi",
  "Matinkylä",
  "Leppävaara",
  "Tikkurila",
  "Myyrmäki",
  "Itäkeskus",
  "Herttoniemi",
  "Munkkiniemi",
  "Kruununhaka",
];

const DESTINATIONS = [
  "Helsinki",
  "Tukholma",
  "Tallinna",
  "Kööpenhamina",
  "Berliini",
  "Lontoo",
  "Pariisi",
  "Rooma",
  "Barcelona",
  "Ateena",
  "Oslo",
  "Reykjavik",
  "Amsterdam",
  "Praha",
  "Wien",
  "Budapest",
  "Lissabon",
  "Madrid",
  "Milano",
  "Zürich",
];

/** Transportation MCCs mean different things: a taxi is not a bus and a car park is not fuel. */
const MCC_BRANDS = {
  "4121": ["Taksi Helsinki", "Uber", "Bolt", "Lähitaksi", "Menevä"],
  "4111": ["HSL", "VR", "Länsimetro", "HSL Bussi"],
  "5541": ["Neste", "Shell", "ABC", "Teboil", "ST1"],
  "5542": ["Neste", "Shell", "ABC", "Teboil", "ST1"],
  "7523": ["Q-Park", "EuroPark", "Citypark", "Finnpark", "Aimo Park"],
};

const BRANDS = {
  Restaurants: [
    "Ravintola Sea Horse",
    "Ravintola Kosmos",
    "Ravintola Nokka",
    "Ravintola Lappi",
    "Ravintola Savotta",
    "Ravintola Zetor",
    "Ravintola Manala",
    "Ravintola Elite",
    "Ravintola Sunn",
    "Ravintola Aino",
    "Ravintola Kolme Kruunua",
    "Ravintola Kuu",
    "Ravintola Messenius",
    "Ravintola Cella",
    "Ravintola Graniitti",
    "Hesburger",
    "McDonald's",
    "Burger King",
    "Subway",
    "Kotipizza",
    "Pizza Hut",
    "KFC",
    "Taco Bell",
    "Fafa's",
    "Naughty BRGR",
    "Luckiefun's",
    "Sushi Bar + Wine",
    "Wok Master",
    "Thai Orchid",
    "Nepalilainen Ravintola",
    "Pizzeria Via Tribunali",
    "Döner Harju",
    "Bistro Kronan",
    "Kaffebar Roasted",
    "Café Regatta",
  ],
  Groceries: [
    "K-Market",
    "K-Supermarket",
    "K-Citymarket",
    "S-Market",
    "Prisma",
    "Lidl",
    "Alepa",
    "Sale",
    "M-market",
    "Halpahalli",
    "Tokmanni",
    "R-kioski",
    "Reinon Liha",
    "Kalaherkku",
    "Juustoportti",
  ],
  Transportation: [
    "Neste",
    "Shell",
    "ABC",
    "Teboil",
    "ST1",
    "HSL",
    "Länsimetro",
    "Taksi Helsinki",
    "Uber",
    "Bolt",
    "Citypark",
    "EuroPark",
    "Q-Park",
    "Finnpark",
    "Autokeskus",
  ],
  Entertainment: [
    "Finnkino",
    "Tennispalatsi",
    "Bio Rex",
    "Kino Regina",
    "Cinema Orion",
    "SuperPark",
    "HopLop",
    "Escape Room",
    "Keilailu",
    "Karaoke",
    "Teatteri",
    "Ooppera",
    "Konserttitalo",
    "Museo",
    "Tivoli",
  ],
  Health: [
    "Yliopiston Apteekki",
    "Apteekki",
    "Mehiläinen",
    "Terveystalo",
    "Pihlajalinna",
    "Attendo",
    "Suunterveys",
    "Hammaslääkäri",
    "Fysioterapia",
    "Optikko",
    "Laboratorio",
    "Terveysasema",
  ],
  "Home & Tech": [
    "Gigantti",
    "Power",
    "Verkkokauppa.com",
    "IKEA",
    "Clas Ohlson",
    "Bauhaus",
    "K-Rauta",
    "Motonet",
    "Hong Kong",
    "Jula",
    "Tokmanni",
    "Kodinkonehuolto",
  ],
  Lifestyle: [
    "H&M",
    "Zara",
    "Uniqlo",
    "Lindex",
    "Marimekko",
    "Stadium",
    "Intersport",
    "Suomalainen Kirjakauppa",
    "Akateeminen Kirjakauppa",
    "Partioaitta",
    "Emotion",
    "Kicks",
    "Ginatricot",
    "Tiger",
    "Normal",
  ],
  Travel: [
    "Finnair",
    "SAS",
    "Norwegian",
    "VR",
    "Tallink Silja",
    "Viking Line",
    "Scandic",
    "Sokos Hotel",
    "Booking.com",
    "Airbnb",
    "TUI",
    "Apollo",
    "Aurinkomatkat",
    "Hertz",
    "Avis",
    "Europcar",
  ],
};

/** `MRC-RES-0022` → 22. */
function merchantNumber(merchantId) {
  const match = /(\d+)$/.exec(merchantId);
  return match ? Number(match[1]) : 0;
}

/**
 * Names for many merchants at once. A brand repeats with a different area (or destination for travel),
 * so merchant ids map to distinct places. Pinned names always win; generated names skip any pinned
 * name or one already taken, trying the next area. Sorting the ids keeps the result identical between
 * builds.
 */
export function assignMerchantNames(entries) {
  const reserved = new Set(Object.values(PINNED_MERCHANTS));
  const used = new Set();
  const names = new Map();
  for (const { merchantId, category, mccCode } of [...entries].sort((a, b) => a.merchantId.localeCompare(b.merchantId))) {
    let name = PINNED_MERCHANTS[merchantId];
    if (!name) {
      const brands = (mccCode && MCC_BRANDS[mccCode]) || BRANDS[category] || [category];
      const places = category === "Travel" ? DESTINATIONS : AREAS;
      const index = merchantNumber(merchantId);
      const brand = brands[index % brands.length];
      const start = Math.floor(index / brands.length);
      for (let offset = 0; offset < places.length && !name; offset += 1) {
        const candidate = `${brand} ${places[(start + offset) % places.length]}`;
        if (!reserved.has(candidate) && !used.has(candidate)) name = candidate;
      }
      if (!name) name = `${brand} ${places[start % places.length]} ${index}`;
    }
    used.add(name);
    names.set(merchantId + (mccCode ?? ""), name);
  }
  return names;
}

"""
Airport/city database for Sabre Flight Search autocomplete.
Covers the major international + European + Balkan destinations most
relevant to BidBlitz users (DE, AT, CH, Balkan, UAE, USA).
"""

AIRPORTS = [
    # Germany
    {"code": "FRA", "city": "Frankfurt", "country": "Deutschland", "name": "Frankfurt am Main"},
    {"code": "MUC", "city": "München", "country": "Deutschland", "name": "München Franz Josef Strauß"},
    {"code": "TXL", "city": "Berlin", "country": "Deutschland", "name": "Berlin Tegel"},
    {"code": "BER", "city": "Berlin", "country": "Deutschland", "name": "Berlin Brandenburg"},
    {"code": "HAM", "city": "Hamburg", "country": "Deutschland", "name": "Hamburg Airport"},
    {"code": "DUS", "city": "Düsseldorf", "country": "Deutschland", "name": "Düsseldorf International"},
    {"code": "CGN", "city": "Köln", "country": "Deutschland", "name": "Köln/Bonn"},
    {"code": "STR", "city": "Stuttgart", "country": "Deutschland", "name": "Stuttgart Airport"},
    {"code": "HAJ", "city": "Hannover", "country": "Deutschland", "name": "Hannover Airport"},
    {"code": "NUE", "city": "Nürnberg", "country": "Deutschland", "name": "Nürnberg Airport"},
    {"code": "BRE", "city": "Bremen", "country": "Deutschland", "name": "Bremen Airport"},
    {"code": "LEJ", "city": "Leipzig", "country": "Deutschland", "name": "Leipzig/Halle"},
    {"code": "DRS", "city": "Dresden", "country": "Deutschland", "name": "Dresden Airport"},
    {"code": "DTM", "city": "Dortmund", "country": "Deutschland", "name": "Dortmund Airport"},
    # Austria / Switzerland
    {"code": "VIE", "city": "Wien", "country": "Österreich", "name": "Wien Schwechat"},
    {"code": "SZG", "city": "Salzburg", "country": "Österreich", "name": "Salzburg Airport"},
    {"code": "INN", "city": "Innsbruck", "country": "Österreich", "name": "Innsbruck Airport"},
    {"code": "GRZ", "city": "Graz", "country": "Österreich", "name": "Graz Airport"},
    {"code": "ZRH", "city": "Zürich", "country": "Schweiz", "name": "Zürich Airport"},
    {"code": "GVA", "city": "Genf", "country": "Schweiz", "name": "Geneva Airport"},
    {"code": "BSL", "city": "Basel", "country": "Schweiz", "name": "EuroAirport Basel"},
    # Balkan
    {"code": "PRN", "city": "Prishtina", "country": "Kosovo", "name": "Prishtina International"},
    {"code": "TIA", "city": "Tirana", "country": "Albanien", "name": "Tirana Airport"},
    {"code": "SKP", "city": "Skopje", "country": "Nordmazedonien", "name": "Skopje International"},
    {"code": "BEG", "city": "Belgrad", "country": "Serbien", "name": "Belgrade Nikola Tesla"},
    {"code": "INI", "city": "Niš", "country": "Serbien", "name": "Niš Constantine the Great"},
    {"code": "SJJ", "city": "Sarajevo", "country": "Bosnien", "name": "Sarajevo International"},
    {"code": "TZL", "city": "Tuzla", "country": "Bosnien", "name": "Tuzla International"},
    {"code": "BNX", "city": "Banja Luka", "country": "Bosnien", "name": "Banja Luka Airport"},
    {"code": "ZAG", "city": "Zagreb", "country": "Kroatien", "name": "Zagreb Airport"},
    {"code": "SPU", "city": "Split", "country": "Kroatien", "name": "Split Airport"},
    {"code": "DBV", "city": "Dubrovnik", "country": "Kroatien", "name": "Dubrovnik Airport"},
    {"code": "PUY", "city": "Pula", "country": "Kroatien", "name": "Pula Airport"},
    {"code": "LJU", "city": "Ljubljana", "country": "Slowenien", "name": "Ljubljana Jože Pučnik"},
    {"code": "TGD", "city": "Podgorica", "country": "Montenegro", "name": "Podgorica Airport"},
    {"code": "TIV", "city": "Tivat", "country": "Montenegro", "name": "Tivat Airport"},
    {"code": "SOF", "city": "Sofia", "country": "Bulgarien", "name": "Sofia Airport"},
    {"code": "OTP", "city": "Bukarest", "country": "Rumänien", "name": "Henri Coandă International"},
    # Western & Southern Europe
    {"code": "CDG", "city": "Paris", "country": "Frankreich", "name": "Charles de Gaulle"},
    {"code": "ORY", "city": "Paris", "country": "Frankreich", "name": "Paris Orly"},
    {"code": "NCE", "city": "Nizza", "country": "Frankreich", "name": "Côte d'Azur"},
    {"code": "LYS", "city": "Lyon", "country": "Frankreich", "name": "Lyon Saint-Exupéry"},
    {"code": "MRS", "city": "Marseille", "country": "Frankreich", "name": "Marseille Provence"},
    {"code": "LHR", "city": "London", "country": "UK", "name": "London Heathrow"},
    {"code": "LGW", "city": "London", "country": "UK", "name": "London Gatwick"},
    {"code": "STN", "city": "London", "country": "UK", "name": "London Stansted"},
    {"code": "MAN", "city": "Manchester", "country": "UK", "name": "Manchester Airport"},
    {"code": "EDI", "city": "Edinburgh", "country": "UK", "name": "Edinburgh Airport"},
    {"code": "DUB", "city": "Dublin", "country": "Irland", "name": "Dublin Airport"},
    {"code": "AMS", "city": "Amsterdam", "country": "Niederlande", "name": "Amsterdam Schiphol"},
    {"code": "BRU", "city": "Brüssel", "country": "Belgien", "name": "Brussels Airport"},
    {"code": "LUX", "city": "Luxemburg", "country": "Luxemburg", "name": "Luxembourg Airport"},
    {"code": "CPH", "city": "Kopenhagen", "country": "Dänemark", "name": "Copenhagen Kastrup"},
    {"code": "ARN", "city": "Stockholm", "country": "Schweden", "name": "Stockholm Arlanda"},
    {"code": "OSL", "city": "Oslo", "country": "Norwegen", "name": "Oslo Gardermoen"},
    {"code": "HEL", "city": "Helsinki", "country": "Finnland", "name": "Helsinki-Vantaa"},
    {"code": "KEF", "city": "Reykjavik", "country": "Island", "name": "Keflavik International"},
    {"code": "MAD", "city": "Madrid", "country": "Spanien", "name": "Madrid Barajas"},
    {"code": "BCN", "city": "Barcelona", "country": "Spanien", "name": "Barcelona El Prat"},
    {"code": "PMI", "city": "Palma de Mallorca", "country": "Spanien", "name": "Palma Son Sant Joan"},
    {"code": "AGP", "city": "Málaga", "country": "Spanien", "name": "Málaga Costa del Sol"},
    {"code": "IBZ", "city": "Ibiza", "country": "Spanien", "name": "Ibiza Airport"},
    {"code": "TFS", "city": "Teneriffa", "country": "Spanien", "name": "Tenerife South"},
    {"code": "LPA", "city": "Gran Canaria", "country": "Spanien", "name": "Gran Canaria Airport"},
    {"code": "LIS", "city": "Lissabon", "country": "Portugal", "name": "Lisbon Humberto Delgado"},
    {"code": "OPO", "city": "Porto", "country": "Portugal", "name": "Porto Francisco Sá Carneiro"},
    {"code": "FAO", "city": "Faro", "country": "Portugal", "name": "Faro Airport"},
    {"code": "FCO", "city": "Rom", "country": "Italien", "name": "Rom Fiumicino"},
    {"code": "MXP", "city": "Mailand", "country": "Italien", "name": "Milan Malpensa"},
    {"code": "VCE", "city": "Venedig", "country": "Italien", "name": "Venezia Marco Polo"},
    {"code": "NAP", "city": "Neapel", "country": "Italien", "name": "Naples International"},
    {"code": "CTA", "city": "Catania", "country": "Italien", "name": "Catania Fontanarossa"},
    {"code": "ATH", "city": "Athen", "country": "Griechenland", "name": "Athens Eleftherios Venizelos"},
    {"code": "SKG", "city": "Thessaloniki", "country": "Griechenland", "name": "Thessaloniki Makedonia"},
    {"code": "HER", "city": "Heraklion", "country": "Griechenland", "name": "Heraklion Airport"},
    {"code": "IST", "city": "Istanbul", "country": "Türkei", "name": "Istanbul Airport"},
    {"code": "SAW", "city": "Istanbul", "country": "Türkei", "name": "Istanbul Sabiha Gökçen"},
    {"code": "AYT", "city": "Antalya", "country": "Türkei", "name": "Antalya Airport"},
    {"code": "ADB", "city": "Izmir", "country": "Türkei", "name": "Izmir Adnan Menderes"},
    # Eastern Europe
    {"code": "WAW", "city": "Warschau", "country": "Polen", "name": "Warsaw Chopin"},
    {"code": "KRK", "city": "Krakau", "country": "Polen", "name": "Kraków John Paul II"},
    {"code": "PRG", "city": "Prag", "country": "Tschechien", "name": "Prague Václav Havel"},
    {"code": "BUD", "city": "Budapest", "country": "Ungarn", "name": "Budapest Ferenc Liszt"},
    # USA
    {"code": "JFK", "city": "New York", "country": "USA", "name": "John F. Kennedy"},
    {"code": "EWR", "city": "New York", "country": "USA", "name": "Newark Liberty"},
    {"code": "LGA", "city": "New York", "country": "USA", "name": "LaGuardia"},
    {"code": "LAX", "city": "Los Angeles", "country": "USA", "name": "Los Angeles International"},
    {"code": "SFO", "city": "San Francisco", "country": "USA", "name": "San Francisco International"},
    {"code": "MIA", "city": "Miami", "country": "USA", "name": "Miami International"},
    {"code": "ORD", "city": "Chicago", "country": "USA", "name": "Chicago O'Hare"},
    {"code": "ATL", "city": "Atlanta", "country": "USA", "name": "Hartsfield-Jackson"},
    {"code": "DFW", "city": "Dallas", "country": "USA", "name": "Dallas/Fort Worth"},
    {"code": "BOS", "city": "Boston", "country": "USA", "name": "Logan International"},
    {"code": "LAS", "city": "Las Vegas", "country": "USA", "name": "Harry Reid International"},
    {"code": "SEA", "city": "Seattle", "country": "USA", "name": "Seattle-Tacoma"},
    # Middle East / Asia / Africa
    {"code": "DXB", "city": "Dubai", "country": "VAE", "name": "Dubai International"},
    {"code": "AUH", "city": "Abu Dhabi", "country": "VAE", "name": "Abu Dhabi International"},
    {"code": "DOH", "city": "Doha", "country": "Katar", "name": "Hamad International"},
    {"code": "IST", "city": "Istanbul", "country": "Türkei", "name": "Istanbul Airport"},
    {"code": "CAI", "city": "Kairo", "country": "Ägypten", "name": "Cairo International"},
    {"code": "HRG", "city": "Hurghada", "country": "Ägypten", "name": "Hurghada International"},
    {"code": "SSH", "city": "Sharm El Sheikh", "country": "Ägypten", "name": "Sharm El Sheikh"},
    {"code": "CMN", "city": "Casablanca", "country": "Marokko", "name": "Mohammed V International"},
    {"code": "RAK", "city": "Marrakesch", "country": "Marokko", "name": "Marrakech Menara"},
    {"code": "TLV", "city": "Tel Aviv", "country": "Israel", "name": "Ben Gurion International"},
    {"code": "BKK", "city": "Bangkok", "country": "Thailand", "name": "Suvarnabhumi Airport"},
    {"code": "SIN", "city": "Singapur", "country": "Singapur", "name": "Changi Airport"},
    {"code": "HKG", "city": "Hongkong", "country": "China", "name": "Hong Kong International"},
    {"code": "PEK", "city": "Peking", "country": "China", "name": "Beijing Capital"},
    {"code": "NRT", "city": "Tokio", "country": "Japan", "name": "Tokyo Narita"},
    {"code": "HND", "city": "Tokio", "country": "Japan", "name": "Tokyo Haneda"},
    {"code": "ICN", "city": "Seoul", "country": "Südkorea", "name": "Seoul Incheon"},
    {"code": "DEL", "city": "Delhi", "country": "Indien", "name": "Indira Gandhi International"},
    {"code": "BOM", "city": "Mumbai", "country": "Indien", "name": "Chhatrapati Shivaji"},
    {"code": "SYD", "city": "Sydney", "country": "Australien", "name": "Kingsford Smith"},
    # Latin America
    {"code": "GRU", "city": "São Paulo", "country": "Brasilien", "name": "Guarulhos International"},
    {"code": "GIG", "city": "Rio de Janeiro", "country": "Brasilien", "name": "Galeão International"},
    {"code": "EZE", "city": "Buenos Aires", "country": "Argentinien", "name": "Ezeiza International"},
    {"code": "MEX", "city": "Mexiko-Stadt", "country": "Mexiko", "name": "Benito Juárez International"},
]


def search_airports(query: str, limit: int = 12):
    """Case-insensitive substring search across code, city, name, country."""
    if not query or len(query.strip()) < 2:
        return []
    q = query.strip().lower()
    seen_codes = set()
    results = []
    # First pass: exact IATA code match
    for a in AIRPORTS:
        if a["code"].lower() == q and a["code"] not in seen_codes:
            seen_codes.add(a["code"])
            results.append(a)
    # Second pass: city starts with query
    for a in AIRPORTS:
        if a["code"] in seen_codes:
            continue
        if a["city"].lower().startswith(q):
            seen_codes.add(a["code"])
            results.append(a)
        if len(results) >= limit:
            return results
    # Third pass: any substring hit (city, name, country, code prefix)
    for a in AIRPORTS:
        if a["code"] in seen_codes:
            continue
        hay = f'{a["code"]} {a["city"]} {a["name"]} {a["country"]}'.lower()
        if q in hay:
            seen_codes.add(a["code"])
            results.append(a)
        if len(results) >= limit:
            return results
    return results[:limit]

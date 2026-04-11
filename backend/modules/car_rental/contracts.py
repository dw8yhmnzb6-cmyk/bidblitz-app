"""
BidBlitz V2 - Car Rental Contracts
Contract generation and management for car rentals.
"""

from datetime import datetime, timezone
from typing import Dict, Any, Optional


DEFAULT_CONTRACT_TEMPLATE = """
<h1>MIETVERTRAG FÜR KRAFTFAHRZEUGE</h1>

<h2>1. Vertragsparteien</h2>
<p>
<strong>Vermieter:</strong><br>
{{vendor_name}}<br>
{{vendor_address}}<br>
{{vendor_city}}
</p>
<p>
<strong>Mieter:</strong><br>
{{customer_name}}<br>
{{customer_address}}<br>
E-Mail: {{customer_email}}<br>
Führerschein-Nr.: {{customer_license}}
</p>

<h2>2. Mietgegenstand</h2>
<p>
Fahrzeug: {{vehicle_title}}<br>
Marke/Modell: {{vehicle_brand}} {{vehicle_model}}<br>
Kennzeichen: {{vehicle_registration}}<br>
Fahrgestellnummer: {{vehicle_vin}}
</p>

<h2>3. Mietdauer</h2>
<p>
Beginn: {{start_date}} um {{pickup_time}} Uhr<br>
Ende: {{end_date}} um {{return_time}} Uhr
</p>

<h2>4. Mietpreis und Kaution</h2>
<p>
Mietpreis gesamt: €{{price_total}}<br>
Kaution: €{{deposit}}<br>
Selbstbeteiligung im Schadensfall: €{{deductible}}
</p>

<h2>5. Fahrzeugübergabe</h2>
<p>
Kilometerstand bei Übergabe: {{mileage_out}} km<br>
Tankstand bei Übergabe: {{fuel_out}}%
</p>

<h2>6. Allgemeine Bedingungen</h2>
<ol>
<li>Der Mieter verpflichtet sich, das Fahrzeug pfleglich zu behandeln.</li>
<li>Das Fahrzeug darf nur vom Mieter oder von ihm benannten Personen geführt werden.</li>
<li>Der Mieter haftet für alle während der Mietzeit verursachten Schäden.</li>
<li>Bei Unfällen ist unverzüglich die Polizei zu rufen.</li>
<li>Das Fahrzeug ist mit dem gleichen Tankstand zurückzugeben.</li>
<li>Verspätete Rückgabe wird mit €15 pro Stunde berechnet.</li>
</ol>

<h2>7. Unterschriften</h2>
<p>
Mit der Unterschrift bestätigen beide Parteien, dass sie diesen Vertrag gelesen und verstanden haben.
</p>

<table style="width: 100%; margin-top: 30px;">
<tr>
<td style="width: 45%;">
<p>Vermieter:</p>
<br><br><br>
_______________________<br>
Datum, Unterschrift
</td>
<td style="width: 45%;">
<p>Mieter:</p>
<br><br><br>
_______________________<br>
Datum, Unterschrift
</td>
</tr>
</table>
"""


def fill_contract_placeholders(template: str, data: Dict[str, Any]) -> str:
    """Fill in contract template placeholders with actual data."""
    
    result = template
    
    placeholders = {
        "vendor_name": data.get("vendor_name", ""),
        "vendor_address": data.get("vendor_address", ""),
        "vendor_city": data.get("vendor_city", ""),
        
        "customer_name": data.get("customer_name", ""),
        "customer_email": data.get("customer_email", ""),
        "customer_address": data.get("customer_address", ""),
        "customer_license": data.get("customer_license", ""),
        
        "vehicle_title": data.get("vehicle_title", ""),
        "vehicle_brand": data.get("vehicle_brand", ""),
        "vehicle_model": data.get("vehicle_model", ""),
        "vehicle_registration": data.get("vehicle_registration", ""),
        "vehicle_vin": data.get("vehicle_vin", ""),
        
        "start_date": format_date(data.get("start_date", "")),
        "end_date": format_date(data.get("end_date", "")),
        "pickup_time": data.get("pickup_time", "10:00"),
        "return_time": data.get("return_time", "10:00"),
        
        "price_total": f"{data.get('price_total', 0):.2f}",
        "deposit": f"{data.get('deposit', 0):.2f}",
        "deductible": f"{data.get('deductible', 0):.2f}",
        
        "mileage_out": str(data.get("mileage_out", 0)),
        "mileage_in": str(data.get("mileage_in", "")),
        "fuel_out": str(data.get("fuel_out", 100)),
        "fuel_in": str(data.get("fuel_in", "")),
    }
    
    for key, value in placeholders.items():
        result = result.replace(f"{{{{{key}}}}}", str(value))
    
    return result


def format_date(date_str: str) -> str:
    """Format ISO date string for contract display."""
    if not date_str:
        return ""
    
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt.strftime("%d.%m.%Y")
    except:
        return date_str[:10] if len(date_str) >= 10 else date_str


def generate_handover_protocol(booking: Dict[str, Any], handover: Dict[str, Any]) -> str:
    """Generate vehicle handover protocol."""
    
    html = f"""
    <h1>ÜBERGABEPROTOKOLL</h1>
    
    <h2>Buchung: {booking.get('booking_id', '')}</h2>
    
    <h3>Fahrzeug</h3>
    <p>
    {booking.get('car_title', '')}<br>
    Kennzeichen: {booking.get('car_registration', '')}
    </p>
    
    <h3>Übergabe an Mieter</h3>
    <p>
    Datum/Zeit: {handover.get('recorded_at', '')}<br>
    Kilometerstand: {handover.get('mileage', '')} km<br>
    Tankstand: {handover.get('fuel_level', '')}%
    </p>
    
    <h3>Vorhandene Schäden</h3>
    <ul>
    """
    
    for damage in handover.get('existing_damages', []):
        html += f"<li>{damage}</li>"
    
    if not handover.get('existing_damages'):
        html += "<li>Keine vorhandenen Schäden</li>"
    
    html += """
    </ul>
    
    <h3>Zubehör-Checkliste</h3>
    <ul>
    """
    
    for item, present in handover.get('accessories_checklist', {}).items():
        status = "✓" if present else "✗"
        html += f"<li>{status} {item}</li>"
    
    html += """
    </ul>
    
    <h3>Unterschriften</h3>
    <table style="width: 100%;">
    <tr>
    <td>Vermieter: _________________</td>
    <td>Mieter: _________________</td>
    </tr>
    </table>
    """
    
    return html


def generate_return_protocol(booking: Dict[str, Any], return_data: Dict[str, Any], extra_charges: list) -> str:
    """Generate vehicle return protocol."""
    
    html = f"""
    <h1>RÜCKGABEPROTOKOLL</h1>
    
    <h2>Buchung: {booking.get('booking_id', '')}</h2>
    
    <h3>Fahrzeug</h3>
    <p>
    {booking.get('car_title', '')}<br>
    Kennzeichen: {booking.get('car_registration', '')}
    </p>
    
    <h3>Rückgabe</h3>
    <p>
    Datum/Zeit: {return_data.get('recorded_at', '')}<br>
    Kilometerstand: {return_data.get('mileage', '')} km<br>
    Tankstand: {return_data.get('fuel_level', '')}%<br>
    Gefahrene Kilometer: {return_data.get('mileage', 0) - booking.get('handover_record', {}).get('mileage', 0)} km
    </p>
    
    <h3>Neue Schäden</h3>
    <ul>
    """
    
    for damage in return_data.get('new_damages', []):
        html += f"<li>{damage}</li>"
    
    if not return_data.get('new_damages'):
        html += "<li>Keine neuen Schäden</li>"
    
    html += """
    </ul>
    
    <h3>Zusätzliche Kosten</h3>
    <table style="width: 100%; border-collapse: collapse;">
    <tr style="background: #f5f5f5;">
    <th style="padding: 8px; text-align: left;">Beschreibung</th>
    <th style="padding: 8px; text-align: right;">Betrag</th>
    </tr>
    """
    
    total_charges = 0
    for charge in extra_charges:
        html += f"""
        <tr>
        <td style="padding: 8px;">{charge['description']}</td>
        <td style="padding: 8px; text-align: right;">€{charge['amount']:.2f}</td>
        </tr>
        """
        total_charges += charge['amount']
    
    if not extra_charges:
        html += """
        <tr>
        <td style="padding: 8px;" colspan="2">Keine zusätzlichen Kosten</td>
        </tr>
        """
    
    html += f"""
    <tr style="font-weight: bold; border-top: 2px solid #333;">
    <td style="padding: 8px;">Gesamt</td>
    <td style="padding: 8px; text-align: right;">€{total_charges:.2f}</td>
    </tr>
    </table>
    
    <h3>Kaution</h3>
    <p>
    Hinterlegte Kaution: €{booking.get('deposit_amount', 0):.2f}<br>
    Einbehalten: €{total_charges:.2f}<br>
    <strong>Rückerstattung: €{max(0, booking.get('deposit_amount', 0) - total_charges):.2f}</strong>
    </p>
    
    <h3>Unterschriften</h3>
    <table style="width: 100%;">
    <tr>
    <td>Vermieter: _________________</td>
    <td>Mieter: _________________</td>
    </tr>
    </table>
    """
    
    return html

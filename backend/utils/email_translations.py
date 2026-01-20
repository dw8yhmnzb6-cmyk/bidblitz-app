"""Email translations and templates for multi-language support"""

# Email translations for all supported languages
EMAIL_TRANSLATIONS = {
    "de": {
        "welcome_back": {
            "subject": "Wir vermissen dich bei BidBlitz! 🎁",
            "greeting": "Hallo {name}!",
            "body": "Es ist schon eine Weile her, seit wir dich bei BidBlitz gesehen haben. Wir haben viele neue Auktionen für dich!",
            "cta": "Jetzt entdecken",
            "free_bids": "Als Willkommensgeschenk: {bids} Gratis-Gebote warten auf dich!",
            "footer": "Mit freundlichen Grüßen,\nDein BidBlitz Team"
        },
        "special_offer": {
            "subject": "Nur heute: 50% mehr Gebote! 🔥",
            "greeting": "Hallo {name}!",
            "body": "Nur für kurze Zeit: Bei deinem nächsten Gebot-Paket erhältst du 50% Extra-Gebote!",
            "cta": "Jetzt Gebote kaufen",
            "footer": "Mit freundlichen Grüßen,\nDein BidBlitz Team"
        },
        "new_auctions": {
            "subject": "Neue Produkte warten auf dich! 🛍️",
            "greeting": "Hallo {name}!",
            "body": "Wir haben {count} neue Auktionen gestartet! Darunter Top-Produkte wie {products}.",
            "cta": "Auktionen ansehen",
            "footer": "Mit freundlichen Grüßen,\nDein BidBlitz Team"
        },
        "winner_congrats": {
            "subject": "Herzlichen Glückwunsch zum Gewinn! 🏆",
            "greeting": "Herzlichen Glückwunsch, {name}!",
            "body": "Du hast die Auktion für {product} gewonnen! Endpreis: nur €{price}",
            "cta": "Zur Bestellung",
            "footer": "Mit freundlichen Grüßen,\nDein BidBlitz Team"
        },
        "daily_reward": {
            "subject": "Dein täglicher Bonus wartet! 🎁",
            "greeting": "Hallo {name}!",
            "body": "Vergiss nicht, deinen täglichen Bonus abzuholen! Heute wartest {bids} Gratis-Gebote auf dich.",
            "cta": "Bonus abholen",
            "footer": "Mit freundlichen Grüßen,\nDein BidBlitz Team"
        }
    },
    "en": {
        "welcome_back": {
            "subject": "We miss you at BidBlitz! 🎁",
            "greeting": "Hello {name}!",
            "body": "It's been a while since we've seen you at BidBlitz. We have many new auctions for you!",
            "cta": "Discover now",
            "free_bids": "As a welcome gift: {bids} free bids are waiting for you!",
            "footer": "Best regards,\nYour BidBlitz Team"
        },
        "special_offer": {
            "subject": "Today only: 50% more bids! 🔥",
            "greeting": "Hello {name}!",
            "body": "For a limited time: Get 50% extra bids on your next bid package!",
            "cta": "Buy bids now",
            "footer": "Best regards,\nYour BidBlitz Team"
        },
        "new_auctions": {
            "subject": "New products are waiting for you! 🛍️",
            "greeting": "Hello {name}!",
            "body": "We've started {count} new auctions! Including top products like {products}.",
            "cta": "View auctions",
            "footer": "Best regards,\nYour BidBlitz Team"
        },
        "winner_congrats": {
            "subject": "Congratulations on your win! 🏆",
            "greeting": "Congratulations, {name}!",
            "body": "You won the auction for {product}! Final price: only €{price}",
            "cta": "Go to order",
            "footer": "Best regards,\nYour BidBlitz Team"
        },
        "daily_reward": {
            "subject": "Your daily bonus is waiting! 🎁",
            "greeting": "Hello {name}!",
            "body": "Don't forget to claim your daily bonus! Today {bids} free bids are waiting for you.",
            "cta": "Claim bonus",
            "footer": "Best regards,\nYour BidBlitz Team"
        }
    },
    "sq": {  # Albanian
        "welcome_back": {
            "subject": "Na mungon në BidBlitz! 🎁",
            "greeting": "Përshëndetje {name}!",
            "body": "Ka kohë që nuk të kemi parë në BidBlitz. Kemi shumë ankande të reja për ty!",
            "cta": "Zbulo tani",
            "free_bids": "Si dhuratë mirëseardhje: {bids} oferta falas po të presin!",
            "footer": "Me respekt,\nEkipi yt BidBlitz"
        },
        "special_offer": {
            "subject": "Vetëm sot: 50% më shumë oferta! 🔥",
            "greeting": "Përshëndetje {name}!",
            "body": "Për kohë të kufizuar: Merr 50% oferta ekstra në paketën tënde të ardhshme!",
            "cta": "Bli oferta tani",
            "footer": "Me respekt,\nEkipi yt BidBlitz"
        },
        "new_auctions": {
            "subject": "Produkte të reja po të presin! 🛍️",
            "greeting": "Përshëndetje {name}!",
            "body": "Kemi filluar {count} ankande të reja! Duke përfshirë produkte top si {products}.",
            "cta": "Shiko ankandat",
            "footer": "Me respekt,\nEkipi yt BidBlitz"
        },
        "winner_congrats": {
            "subject": "Urime për fitoren! 🏆",
            "greeting": "Urime, {name}!",
            "body": "Fitove ankandin për {product}! Çmimi final: vetëm €{price}",
            "cta": "Shko te porosia",
            "footer": "Me respekt,\nEkipi yt BidBlitz"
        },
        "daily_reward": {
            "subject": "Bonusi yt ditor po pret! 🎁",
            "greeting": "Përshëndetje {name}!",
            "body": "Mos harro të marrësh bonusin tënd ditor! Sot {bids} oferta falas po të presin.",
            "cta": "Merr bonusin",
            "footer": "Me respekt,\nEkipi yt BidBlitz"
        }
    },
    "el": {  # Greek
        "welcome_back": {
            "subject": "Μας λείπεις στο BidBlitz! 🎁",
            "greeting": "Γεια σου {name}!",
            "body": "Έχει περάσει καιρός από τότε που σε είδαμε στο BidBlitz. Έχουμε πολλές νέες δημοπρασίες για σένα!",
            "cta": "Ανακάλυψε τώρα",
            "free_bids": "Ως δώρο καλωσορίσματος: {bids} δωρεάν προσφορές σε περιμένουν!",
            "footer": "Με εκτίμηση,\nΗ ομάδα BidBlitz"
        },
        "special_offer": {
            "subject": "Μόνο σήμερα: 50% περισσότερες προσφορές! 🔥",
            "greeting": "Γεια σου {name}!",
            "body": "Για περιορισμένο χρονικό διάστημα: Πάρε 50% επιπλέον προσφορές στο επόμενο πακέτο σου!",
            "cta": "Αγόρασε προσφορές τώρα",
            "footer": "Με εκτίμηση,\nΗ ομάδα BidBlitz"
        },
        "new_auctions": {
            "subject": "Νέα προϊόντα σε περιμένουν! 🛍️",
            "greeting": "Γεια σου {name}!",
            "body": "Ξεκινήσαμε {count} νέες δημοπρασίες! Συμπεριλαμβανομένων κορυφαίων προϊόντων όπως {products}.",
            "cta": "Δες τις δημοπρασίες",
            "footer": "Με εκτίμηση,\nΗ ομάδα BidBlitz"
        },
        "winner_congrats": {
            "subject": "Συγχαρητήρια για τη νίκη σου! 🏆",
            "greeting": "Συγχαρητήρια, {name}!",
            "body": "Κέρδισες τη δημοπρασία για {product}! Τελική τιμή: μόνο €{price}",
            "cta": "Πήγαινε στην παραγγελία",
            "footer": "Με εκτίμηση,\nΗ ομάδα BidBlitz"
        },
        "daily_reward": {
            "subject": "Το καθημερινό σου μπόνους περιμένει! 🎁",
            "greeting": "Γεια σου {name}!",
            "body": "Μην ξεχάσεις να διεκδικήσεις το καθημερινό σου μπόνους! Σήμερα {bids} δωρεάν προσφορές σε περιμένουν.",
            "cta": "Διεκδίκησε το μπόνους",
            "footer": "Με εκτίμηση,\nΗ ομάδα BidBlitz"
        }
    },
    "tr": {  # Turkish
        "welcome_back": {
            "subject": "BidBlitz'te seni özledik! 🎁",
            "greeting": "Merhaba {name}!",
            "body": "Seni BidBlitz'te görmeyeli epey oldu. Senin için birçok yeni açık artırmamız var!",
            "cta": "Şimdi keşfet",
            "free_bids": "Hoş geldin hediyesi olarak: {bids} ücretsiz teklif seni bekliyor!",
            "footer": "Saygılarımızla,\nBidBlitz Ekibi"
        },
        "special_offer": {
            "subject": "Sadece bugün: %50 daha fazla teklif! 🔥",
            "greeting": "Merhaba {name}!",
            "body": "Sınırlı süre için: Bir sonraki teklif paketinde %50 ekstra teklif kazan!",
            "cta": "Şimdi teklif satın al",
            "footer": "Saygılarımızla,\nBidBlitz Ekibi"
        },
        "new_auctions": {
            "subject": "Yeni ürünler seni bekliyor! 🛍️",
            "greeting": "Merhaba {name}!",
            "body": "{count} yeni açık artırma başlattık! {products} gibi en iyi ürünler dahil.",
            "cta": "Açık artırmaları gör",
            "footer": "Saygılarımızla,\nBidBlitz Ekibi"
        },
        "winner_congrats": {
            "subject": "Kazandığın için tebrikler! 🏆",
            "greeting": "Tebrikler, {name}!",
            "body": "{product} için açık artırmayı kazandın! Son fiyat: sadece €{price}",
            "cta": "Siparişe git",
            "footer": "Saygılarımızla,\nBidBlitz Ekibi"
        },
        "daily_reward": {
            "subject": "Günlük bonusun bekliyor! 🎁",
            "greeting": "Merhaba {name}!",
            "body": "Günlük bonusunu almayı unutma! Bugün {bids} ücretsiz teklif seni bekliyor.",
            "cta": "Bonusu al",
            "footer": "Saygılarımızla,\nBidBlitz Ekibi"
        }
    },
    "fr": {  # French
        "welcome_back": {
            "subject": "Tu nous manques chez BidBlitz ! 🎁",
            "greeting": "Bonjour {name} !",
            "body": "Ça fait un moment qu'on ne t'a pas vu chez BidBlitz. Nous avons plein de nouvelles enchères pour toi !",
            "cta": "Découvrir maintenant",
            "free_bids": "En cadeau de bienvenue : {bids} enchères gratuites t'attendent !",
            "footer": "Cordialement,\nL'équipe BidBlitz"
        },
        "special_offer": {
            "subject": "Aujourd'hui seulement : 50% d'enchères en plus ! 🔥",
            "greeting": "Bonjour {name} !",
            "body": "Pour une durée limitée : Obtiens 50% d'enchères supplémentaires sur ton prochain pack !",
            "cta": "Acheter des enchères",
            "footer": "Cordialement,\nL'équipe BidBlitz"
        },
        "winner_congrats": {
            "subject": "Félicitations pour ta victoire ! 🏆",
            "greeting": "Félicitations, {name} !",
            "body": "Tu as gagné l'enchère pour {product} ! Prix final : seulement €{price}",
            "cta": "Voir la commande",
            "footer": "Cordialement,\nL'équipe BidBlitz"
        }
    },
    "es": {  # Spanish
        "welcome_back": {
            "subject": "¡Te extrañamos en BidBlitz! 🎁",
            "greeting": "¡Hola {name}!",
            "body": "Ha pasado tiempo desde que te vimos en BidBlitz. ¡Tenemos muchas subastas nuevas para ti!",
            "cta": "Descubrir ahora",
            "free_bids": "Como regalo de bienvenida: ¡{bids} pujas gratis te esperan!",
            "footer": "Saludos cordiales,\nEl equipo de BidBlitz"
        },
        "special_offer": {
            "subject": "¡Solo hoy: 50% más pujas! 🔥",
            "greeting": "¡Hola {name}!",
            "body": "¡Por tiempo limitado: Obtén 50% de pujas extra en tu próximo paquete!",
            "cta": "Comprar pujas ahora",
            "footer": "Saludos cordiales,\nEl equipo de BidBlitz"
        },
        "winner_congrats": {
            "subject": "¡Felicidades por tu victoria! 🏆",
            "greeting": "¡Felicidades, {name}!",
            "body": "¡Ganaste la subasta de {product}! Precio final: solo €{price}",
            "cta": "Ir al pedido",
            "footer": "Saludos cordiales,\nEl equipo de BidBlitz"
        }
    },
    "it": {  # Italian
        "welcome_back": {
            "subject": "Ci manchi su BidBlitz! 🎁",
            "greeting": "Ciao {name}!",
            "body": "È passato un po' di tempo da quando ti abbiamo visto su BidBlitz. Abbiamo molte nuove aste per te!",
            "cta": "Scopri ora",
            "free_bids": "Come regalo di benvenuto: {bids} offerte gratuite ti aspettano!",
            "footer": "Cordiali saluti,\nIl team di BidBlitz"
        },
        "winner_congrats": {
            "subject": "Congratulazioni per la tua vittoria! 🏆",
            "greeting": "Congratulazioni, {name}!",
            "body": "Hai vinto l'asta per {product}! Prezzo finale: solo €{price}",
            "cta": "Vai all'ordine",
            "footer": "Cordiali saluti,\nIl team di BidBlitz"
        }
    }
}

# Default to German if language not found
DEFAULT_LANGUAGE = "de"

def get_email_template(template_id: str, language: str, **kwargs) -> dict:
    """Get localized email template with filled placeholders"""
    # Get language translations or fall back to German
    lang_templates = EMAIL_TRANSLATIONS.get(language, EMAIL_TRANSLATIONS.get(DEFAULT_LANGUAGE, {}))
    
    # Get specific template or fall back to German
    template = lang_templates.get(template_id)
    if not template:
        template = EMAIL_TRANSLATIONS[DEFAULT_LANGUAGE].get(template_id, {})
    
    # Fill in placeholders
    result = {}
    for key, value in template.items():
        try:
            result[key] = value.format(**kwargs) if kwargs else value
        except KeyError:
            result[key] = value  # Keep original if placeholder missing
    
    return result


def generate_email_html(template: dict, cta_url: str = "https://bidblitz.de") -> str:
    """Generate HTML email from template"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }}
            .header {{ background: linear-gradient(135deg, #FFD700, #FF4D4D); padding: 30px; text-align: center; }}
            .header h1 {{ color: white; margin: 0; font-size: 28px; }}
            .content {{ padding: 30px; }}
            .greeting {{ font-size: 20px; color: #333; margin-bottom: 15px; }}
            .body-text {{ color: #666; line-height: 1.6; margin-bottom: 25px; }}
            .cta-button {{ display: inline-block; background: linear-gradient(135deg, #FFD700, #FF4D4D); color: white; padding: 15px 30px; border-radius: 25px; text-decoration: none; font-weight: bold; }}
            .cta-button:hover {{ opacity: 0.9; }}
            .footer {{ padding: 20px 30px; background: #f8f9fa; color: #888; font-size: 12px; white-space: pre-line; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>⚡ BidBlitz</h1>
            </div>
            <div class="content">
                <p class="greeting">{template.get('greeting', 'Hallo!')}</p>
                <p class="body-text">{template.get('body', '')}</p>
                {f'<p class="body-text" style="color: #10B981; font-weight: bold;">{template.get("free_bids", "")}</p>' if template.get('free_bids') else ''}
                <p style="text-align: center;">
                    <a href="{cta_url}" class="cta-button">{template.get('cta', 'Jetzt ansehen')}</a>
                </p>
            </div>
            <div class="footer">
                {template.get('footer', 'Dein BidBlitz Team')}
            </div>
        </div>
    </body>
    </html>
    """


# List of supported languages for the email system
SUPPORTED_EMAIL_LANGUAGES = list(EMAIL_TRANSLATIONS.keys())

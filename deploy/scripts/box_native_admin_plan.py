"""Pure, guarded plans for native BOX publication. Never executes a build or restart."""
import ast
import hashlib
import re

BASELINE_INDEX_SHA256 = "9d2b6733e5484640ed6ccaf387c308ab8867dd9755c518b384379e0f29080969"
NATIVE_PATH = "/v1/internal/bidblitz-admin/box/partner-applications"
HTML_MARKER = "BIDBLITZ_NATIVE_BOX_INBOX_V1"
NGINX_BEGIN = "# BOX_NATIVE_ADMIN_INBOX_V1_BEGIN"
NGINX_END = "# BOX_NATIVE_ADMIN_INBOX_V1_END"

def plan_registry(source):
    ast.parse(source)
    added = '        ("routes.admin_box_native", "router"),'
    if source.count(added) == 1:
        return source
    if "routes.admin_box_native" in source:
        raise ValueError("Unknown native BOX registration")
    anchor = '        ("routes.admin_projects", "router"),'
    if source.count(anchor) != 1 or "def register_all_routers(app):" not in source:
        raise ValueError("Existing central router registry required")
    candidate = source.replace(anchor, anchor + "\n" + added, 1)
    ast.parse(candidate)
    return candidate

def plan_html(source, asset):
    if not isinstance(source, bytes) or len(source) > 131072 or not isinstance(asset, bytes):
        raise ValueError("Bounded exact HTML and asset bytes required")
    if HTML_MARKER.encode() in source:
        raise ValueError("Native UI already planned; verify before replacing")
    clean, count = re.subn(
        rb"\n<!-- BIDBLITZ_ADMIN_BOX_LINK_V3 -->.*?</script>\n",
        b"", source, flags=re.S)
    if count != 1 or hashlib.sha256(clean).hexdigest() != BASELINE_INDEX_SHA256:
        raise ValueError("Current website differs; no replacement permitted")
    if clean.count(b"</body>") != 1:
        raise ValueError("Unexpected HTML structure")
    digest = hashlib.sha256(asset).hexdigest()
    filename = "admin-box-native." + digest[:16] + ".js"
    bootstrap = """
<!-- BIDBLITZ_NATIVE_BOX_INBOX_V1 -->
<script src="/ASSET_NAME"></script>
<script>
(function(){
  let active = null;
  function sync(){
    const heading = Array.from(document.querySelectorAll("h1,h2"))
      .find(node => node.textContent.trim() === "Alle Projekte");
    const onPage = /^\\/admin\\/projects\\/?$/.test(location.pathname);
    if(active && (!onPage || !heading || !active.card.isConnected)){
      active.handle.destroy();active.card.remove();active=null;
    }
    if(active || !onPage || !heading || !window.BidBlitzBoxInbox)return;
    const main = Array.from(document.querySelectorAll("main"))
      .find(node=>node.querySelector(".project-owner")) || document.querySelector("main");
    if(!main)return;
    const card=document.createElement("section");
    card.id="bidblitz-admin-box-link";
    card.style.cssText="margin:0 0 20px;padding:20px;border:1px solid #ccd8d1;border-radius:16px;background:#fff;color:#17382d";
    main.prepend(card);
    active={card:card,handle:window.BidBlitzBoxInbox.mount(card)};
  }
  sync();setInterval(sync,500);addEventListener("popstate",sync);
})();
</script>
""".replace("ASSET_NAME", filename).encode()
    return filename, clean.replace(b"</body>", bootstrap + b"</body>", 1)

def plan_box_proxy(source):
    if not isinstance(source, str) or len(source) > 262144:
        raise ValueError("Bounded BOX proxy required")
    block = """# BOX_NATIVE_ADMIN_INBOX_V1_BEGIN
    location = /v1/internal/bidblitz-admin/box/partner-applications {
        if ($request_method != GET) { return 405; }
        access_log off;
        error_log /var/log/nginx/box-auth-error.log crit;
        proxy_pass http://127.0.0.1:5198;
        proxy_set_header Host box.bidblitz.ae;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-BidBlitz-Box-Delegation $http_x_bidblitz_box_delegation;
        proxy_set_header Cookie "";
        proxy_set_header Authorization "";
        proxy_set_header Origin "";
        proxy_redirect off;
        proxy_cache off;
        proxy_connect_timeout 3s;
        proxy_read_timeout 15s;
        proxy_send_timeout 15s;
    }
    # BOX_NATIVE_ADMIN_INBOX_V1_END"""
    if NATIVE_PATH in source or NGINX_BEGIN in source or NGINX_END in source:
        if source.count(block) == 1 and source.count(NATIVE_PATH) == 1:
            return source
        raise ValueError("Unknown native BOX proxy")
    anchor = "# BOX_PARTNER_APPLICATIONS_V1_END"
    if source.count(anchor) != 1:
        raise ValueError("Existing BOX application proxy required")
    return source.replace(anchor, anchor + "\n    " + block, 1)

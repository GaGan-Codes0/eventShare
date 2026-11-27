"""Builds ../APP_STORE_CONNECT_MASTER_GUIDE.html from guide.template.html + listing.json."""
import json, os
H = os.path.dirname(os.path.abspath(__file__))
data = json.dumps(json.load(open(os.path.join(H, 'listing.json'))), ensure_ascii=False).replace('</', '<\\/')
html = open(os.path.join(H, 'guide.template.html')).read().replace('/*__DATA__*/', data)
open(os.path.join(os.path.dirname(H), 'APP_STORE_CONNECT_MASTER_GUIDE.html'), 'w').write(html)
print('ok', len(html))

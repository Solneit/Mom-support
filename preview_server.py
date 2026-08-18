import http.server, socketserver, json, os

PORT = 8765
os.chdir("/home/claude/momsupport/public")

SERVICES = {
  "count": 2,
  "results": [
    {"id":"rec1","name":"O Saltitão_Creche","institution":"O Saltitão","type":"Creche","ageMin":18,"ageMax":36,
     "ageRangeLabel":"1 ano e 6 meses – 3 anos","vacancyStatus":"Vagas disponíveis","waitingList":"Unknown",
     "applicationsOpen":"Unknown","schedule":"07:00–19:00","priceMonth":None,"lastVerified":"8/17/2026",
     "verificationMethod":"Website","phone":"212 301 005","email":"creche-saltitao@sapo.pt","website":"",
     "facebook":"","instagram":"","address":"Tv. António Rodrigues Pimentel 18"},
    {"id":"rec2","name":"Mini Milkies_Creche","institution":"Mini Milkies","type":"Creche","ageMin":3,"ageMax":36,
     "ageRangeLabel":"3 meses – 3 anos","vacancyStatus":"Unknown","waitingList":"Unknown",
     "applicationsOpen":"Unknown","schedule":"07:30–19:00","priceMonth":None,"lastVerified":"8/13/2026",
     "verificationMethod":"Other","phone":"211 805 063","email":"educa.minimilkies@gmail.com","website":"",
     "facebook":"","instagram":"","address":"Rua Serpa Pinto 102, 2870-363"},
  ]
}
REVIEWS = {"count": 1, "geral": 5.0, "comunicacao": 5.0, "processo": 5.0}

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/.netlify/functions/services"):
            self.send_response(200); self.send_header("Content-Type","application/json"); self.end_headers()
            self.wfile.write(json.dumps(SERVICES).encode()); return
        if self.path.startswith("/.netlify/functions/reviews"):
            self.send_response(200); self.send_header("Content-Type","application/json"); self.end_headers()
            self.wfile.write(json.dumps(REVIEWS).encode()); return
        return super().do_GET()
    def do_POST(self):
        if self.path.startswith("/.netlify/functions/reviews"):
            length = int(self.headers.get('Content-Length', 0))
            self.rfile.read(length)
            self.send_response(200); self.send_header("Content-Type","application/json"); self.end_headers()
            self.wfile.write(json.dumps({"ok": True}).encode()); return
        self.send_response(404); self.end_headers()

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from uuid import uuid4
from datetime import datetime
from sqlalchemy import create_engine, text

app = Flask(__name__)
CORS(app)

DB_DIR = os.environ.get('DB_DIR', os.path.dirname(__file__))
DEFAULT_SQLITE_URL = f"sqlite:///{os.path.join(DB_DIR, 'data.db')}"
DATABASE_URL = os.environ.get('DATABASE_URL', DEFAULT_SQLITE_URL)
engine = create_engine(DATABASE_URL, future=True)

def init_db():
    with engine.begin() as c:
        c.execute(text('''CREATE TABLE IF NOT EXISTS listings (
            id TEXT PRIMARY KEY,
            type TEXT,
            name TEXT,
            desc TEXT,
            img TEXT,
            contact TEXT,
            lat REAL,
            lng REAL,
            created_at TEXT
        )'''))
        c.execute(text('''CREATE TABLE IF NOT EXISTS requests (
            id TEXT PRIMARY KEY,
            listing_id TEXT,
            message TEXT,
            contact TEXT,
            lat REAL,
            lng REAL,
            created_at TEXT
        )'''))
        c.execute(text('''CREATE TABLE IF NOT EXISTS pickups (
            id TEXT PRIMARY KEY,
            request_id TEXT,
            date TEXT,
            time TEXT,
            contact TEXT,
            lat REAL,
            lng REAL,
            created_at TEXT
        )'''))
        c.execute(text('''CREATE TABLE IF NOT EXISTS food_requests (
            id TEXT PRIMARY KEY,
            animal TEXT,
            kind TEXT,
            qty TEXT,
            contact TEXT,
            lat REAL,
            lng REAL,
            created_at TEXT
        )'''))
        c.execute(text('''CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_contact TEXT,
            message TEXT,
            created_at TEXT,
            read INTEGER DEFAULT 0
        )'''))

# Cebu-only location validation
CENTER_CEBU = (10.3157, 123.8854)
CEBU_RADIUS_KM = 110

def haversine_km(a_lat, a_lng, b_lat, b_lng):
    from math import radians, sin, cos, asin, sqrt
    R = 6371
    dLat = radians(b_lat - a_lat)
    dLng = radians(b_lng - a_lng)
    lat1 = radians(a_lat)
    lat2 = radians(b_lat)
    h = sin(dLat/2)**2 + cos(lat1) * cos(lat2) * sin(dLng/2)**2
    return 2 * R * asin(min(1, sqrt(h)))

def in_cebu(lat, lng):
    return haversine_km(CENTER_CEBU[0], CENTER_CEBU[1], lat, lng) <= CEBU_RADIUS_KM

def rows(result):
    return [dict(r) for r in result.mappings().all()]

def nowstr():
    return datetime.utcnow().isoformat()

@app.route('/listings', methods=['GET', 'POST'])
def listings():
    if request.method == 'GET':
        with engine.connect() as c:
            result = c.execute(text('SELECT * FROM listings'))
            return jsonify(rows(result))
    data = request.get_json(force=True)
    item = (
        data.get('id') or uuid4().hex,
        data['type'],
        data['name'],
        data.get('desc',''),
        data.get('img',''),
        data['contact'],
        float(data['location']['lat']),
        float(data['location']['lng']),
        nowstr()
    )
    if not in_cebu(item[6], item[7]):
        return jsonify({'error': 'Location must be within Cebu'}), 400
    with engine.begin() as c:
        c.execute(text('INSERT INTO listings (id,type,name,desc,img,contact,lat,lng,created_at) VALUES (:id,:type,:name,:desc,:img,:contact,:lat,:lng,:created_at)') , {
            'id': item[0], 'type': item[1], 'name': item[2], 'desc': item[3], 'img': item[4], 'contact': item[5], 'lat': item[6], 'lng': item[7], 'created_at': item[8]
        })
    return jsonify({'id': item[0]})

@app.route('/requests', methods=['GET', 'POST'])
def adoption_requests():
    if request.method == 'GET':
        with engine.connect() as c:
            result = c.execute(text('SELECT * FROM requests'))
            return jsonify(rows(result))
    data = request.get_json(force=True)
    item = (
        data.get('id') or uuid4().hex,
        data['listingId'],
        data['message'],
        data['contact'],
        float(data['location']['lat']),
        float(data['location']['lng']),
        nowstr()
    )
    if not in_cebu(item[4], item[5]):
        return jsonify({'error': 'Location must be within Cebu'}), 400
    with engine.begin() as c:
        c.execute(text('INSERT INTO requests (id,listing_id,message,contact,lat,lng,created_at) VALUES (:id,:listing_id,:message,:contact,:lat,:lng,:created_at)'), {
            'id': item[0], 'listing_id': item[1], 'message': item[2], 'contact': item[3], 'lat': item[4], 'lng': item[5], 'created_at': item[6]
        })
        res = c.execute(text('SELECT contact, type, name FROM listings WHERE id=:id'), { 'id': data['listingId'] })
        row = res.fetchone()
        if row:
            owner_contact, ltype, lname = row
            msg = f"New adoption request for {ltype} • {lname} from {data['contact']}"
            c.execute(text('INSERT INTO notifications (id, user_contact, message, created_at, read) VALUES (:id,:user_contact,:message,:created_at,0)'), {
                'id': uuid4().hex, 'user_contact': owner_contact, 'message': msg, 'created_at': nowstr()
            })
    return jsonify({'id': item[0]})

@app.route('/pickups', methods=['GET', 'POST'])
def pickups():
    if request.method == 'GET':
        with engine.connect() as c:
            result = c.execute(text('SELECT * FROM pickups'))
            return jsonify(rows(result))
    data = request.get_json(force=True)
    item = (
        data.get('id') or uuid4().hex,
        data['requestId'],
        data['date'],
        data['time'],
        data['contact'],
        float(data['location']['lat']),
        float(data['location']['lng']),
        nowstr()
    )
    if not in_cebu(item[5], item[6]):
        return jsonify({'error': 'Location must be within Cebu'}), 400
    with engine.begin() as c:
        c.execute(text('INSERT INTO pickups (id,request_id,date,time,contact,lat,lng,created_at) VALUES (:id,:request_id,:date,:time,:contact,:lat,:lng,:created_at)'), {
            'id': item[0], 'request_id': item[1], 'date': item[2], 'time': item[3], 'contact': item[4], 'lat': item[5], 'lng': item[6], 'created_at': item[7]
        })
    return jsonify({'id': item[0]})

@app.route('/food_requests', methods=['GET', 'POST'])
def food_requests():
    if request.method == 'GET':
        with engine.connect() as c:
            result = c.execute(text('SELECT * FROM food_requests'))
            return jsonify(rows(result))
    data = request.get_json(force=True)
    item = (
        data.get('id') or uuid4().hex,
        data['animal'],
        data['kind'],
        data['qty'],
        data['contact'],
        float(data['location']['lat']),
        float(data['location']['lng']),
        nowstr()
    )
    if not in_cebu(item[5], item[6]):
        return jsonify({'error': 'Location must be within Cebu'}), 400
    with engine.begin() as c:
        c.execute(text('INSERT INTO food_requests (id,animal,kind,qty,contact,lat,lng,created_at) VALUES (:id,:animal,:kind,:qty,:contact,:lat,:lng,:created_at)'), {
            'id': item[0], 'animal': item[1], 'kind': item[2], 'qty': item[3], 'contact': item[4], 'lat': item[5], 'lng': item[6], 'created_at': item[7]
        })
    return jsonify({'id': item[0]})

@app.route('/notifications', methods=['GET'])
def notifications():
    contact = request.args.get('contact')
    with engine.connect() as c:
        if contact:
            result = c.execute(text('SELECT * FROM notifications WHERE user_contact=:c ORDER BY created_at DESC'), { 'c': contact })
        else:
            result = c.execute(text('SELECT * FROM notifications ORDER BY created_at DESC'))
        return jsonify(rows(result))

@app.route('/notifications/read', methods=['POST'])
def notifications_read():
    data = request.get_json(force=True)
    ids = data.get('ids', [])
    with engine.begin() as c:
        for nid in ids:
            c.execute(text('UPDATE notifications SET read=1 WHERE id=:id'), { 'id': nid })
    return jsonify({'updated': len(ids)})

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

@app.route('/', methods=['GET'])
def root():
    return jsonify({'service': 'CebuAnimalAdoption API', 'endpoints': ['/listings','/requests','/pickups','/food_requests','/notifications','/health']})

init_db()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)


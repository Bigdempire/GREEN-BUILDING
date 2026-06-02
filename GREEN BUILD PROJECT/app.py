from flask import Flask, request, jsonify, send_from_directory, abort, session
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import sqlite3
import os
from functools import wraps
from pathlib import Path
import json
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "ecobuild.db"
MATERIALS_PATH = BASE_DIR / "data" / "materials.json"
UPLOAD_FOLDER = BASE_DIR / "uploads"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}

app = Flask(__name__, static_folder='.', template_folder='.')
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'change-me-please')
app.config.update({
    'SESSION_COOKIE_HTTPONLY': True,
    'SESSION_COOKIE_SAMESITE': 'Lax',
    'SESSION_COOKIE_SECURE': False,  # set True in production behind HTTPS
})


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None
    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return user


def auth_response(user):
    return {
        'user_id': user['id'],
        'full_name': user['full_name'] or user['company'],
        'role': user['role'],
        'email': user['email']
    }


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_user():
            return jsonify({'error': 'Authentication required.'}), 401
        return fn(*args, **kwargs)
    return wrapper


def require_role(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = current_user()
            if not user:
                return jsonify({'error': 'Authentication required.'}), 401
            if user['role'] not in roles:
                return jsonify({'error': 'Permission denied.'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def has_column(conn, table, column):
    columns = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return any(col['name'] == column for col in columns)


def init_db():
    created = False
    if not DB_PATH.exists():
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        created = True

    UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            phone TEXT,
            organization TEXT,
            company TEXT,
            location TEXT,
            created_at TEXT NOT NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id INTEGER,
            name TEXT NOT NULL,
            supplier TEXT NOT NULL,
            type TEXT NOT NULL,
            price REAL NOT NULL,
            strength REAL,
            durability REAL,
            carbon REAL NOT NULL,
            unit TEXT NOT NULL,
            image_url TEXT,
            contact_info TEXT,
            status TEXT NOT NULL DEFAULT 'approved',
            created_at TEXT NOT NULL
        )
        """
    )

    conn.commit()

    if not has_column(conn, 'products', 'supplier_id'):
        cursor.execute("ALTER TABLE products ADD COLUMN supplier_id INTEGER")
        conn.commit()
    if not has_column(conn, 'products', 'contact_info'):
        try:
            cursor.execute("ALTER TABLE products ADD COLUMN contact_info TEXT")
            conn.commit()
        except Exception:
            pass
    if not has_column(conn, 'products', 'status'):
        try:
            cursor.execute("ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'")
            conn.commit()
        except Exception:
            # best-effort: ignore if ALTER fails on older sqlite versions
            pass

    cursor.execute("SELECT COUNT(*) FROM products")
    count = cursor.fetchone()[0]
    if count == 0 and MATERIALS_PATH.exists():
        with open(MATERIALS_PATH, 'r', encoding='utf-8') as fh:
            materials = json.load(fh)
        for material in materials:
            cursor.execute(
                "INSERT OR IGNORE INTO products (id, supplier_id, name, supplier, type, price, strength, durability, carbon, unit, image_url, contact_info, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    material.get('id'),
                    None,
                    material.get('name'),
                    material.get('supplier', 'EcoBuild'),
                    material.get('type', 'Unknown'),
                    material.get('price', 0),
                    material.get('strength', 0),
                    material.get('durability', 0),
                    material.get('carbon', 0),
                    material.get('unit', 'ton'),
                    material.get('image_url', ''),
                    '',
                    'approved',
                    datetime.utcnow().isoformat()
                )
            )
        conn.commit()

    cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
    admin_count = cursor.fetchone()[0]
    if admin_count == 0:
        cursor.execute(
            "INSERT OR IGNORE INTO users (full_name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
            ("EcoBuild Admin", "admin@ecobuild.local", generate_password_hash("Admin123!"), "admin", datetime.utcnow().isoformat())
        )
        conn.commit()

    conn.close()
    return created


# Ensure the database is initialized when the application starts.
init_db()


@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


@app.route('/<path:path>')
def static_proxy(path):
    if Path(BASE_DIR / path).exists():
        return send_from_directory('.', path)
    abort(404)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No file was uploaded.'}), 400

    image = request.files['image']
    if image.filename == '':
        return jsonify({'error': 'No selected file.'}), 400

    if not allowed_file(image.filename):
        return jsonify({'error': 'Unsupported file type.'}), 400

    filename = secure_filename(image.filename)
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S%f')
    filename = f"{timestamp}_{filename}"
    UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
    destination = UPLOAD_FOLDER / filename
    image.save(destination)

    return jsonify({'image_url': f'uploads/{filename}'})


def verify_csrf():
    token = request.headers.get('X-CSRF-Token')
    if not token:
        token = request.form.get('csrf_token') or request.args.get('csrf_token')
    if not token or token != session.get('csrf_token'):
        return False
    return True


@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}
    role = data.get('role', 'buyer')
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    full_name = data.get('full_name', '').strip() if role in ('buyer', 'admin') else ''
    company = data.get('company', '').strip() if role == 'supplier' else ''
    phone = data.get('phone', '').strip()
    organization = data.get('organization', '').strip() if role == 'buyer' else ''
    location = data.get('location', '').strip() if role == 'supplier' else ''

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (full_name, email, password_hash, role, phone, organization, company, location, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (full_name, email, generate_password_hash(password), role, phone, organization, company, location, datetime.utcnow().isoformat())
        )
        conn.commit()
        user_id = cursor.lastrowid
        return jsonify({'message': 'Account created successfully.', 'user_id': user_id})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'A user with that email already exists.'}), 409
    finally:
        conn.close()


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    role = data.get('role', 'buyer')

    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ? AND role = ?", (email, role))
    user = cursor.fetchone()
    conn.close()

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Invalid credentials.'}), 401

    session['user_id'] = user['id']
    session['role'] = user['role']

    # generate CSRF token for the session
    import secrets
    session['csrf_token'] = secrets.token_urlsafe(32)

    data = auth_response(user)
    data['csrf_token'] = session.get('csrf_token')
    return jsonify(data)


@app.route('/api/logout', methods=['POST'])
def logout():
    if not verify_csrf():
        return jsonify({'error': 'Invalid CSRF token.'}), 400
    session.clear()
    return jsonify({'message': 'Logged out successfully.'})


@app.route('/api/session', methods=['GET'])
def session_info():
    user = current_user()
    if not user:
        return jsonify({'error': 'Not authenticated.'}), 401
    data = auth_response(user)
    data['csrf_token'] = session.get('csrf_token')
    return jsonify(data)


@app.route('/api/products', methods=['GET'])
def get_products():
    user = current_user()
    conn = get_db_connection()
    cursor = conn.cursor()

    # server-side filtering / search / pagination
    q = request.args.get('q', '').strip()
    ptype = request.args.get('type')
    status = request.args.get('status')
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 100))
    except ValueError:
        page = 1
        per_page = 100
    sort = request.args.get('sort') or 'name'

    where = []
    params = []
    if user and user['role'] == 'supplier':
        where.append('supplier_id = ?')
        params.append(user['id'])
    if q:
        where.append("(name LIKE ? OR supplier LIKE ? OR type LIKE ?)")
        likeq = f"%{q}%"
        params.extend([likeq, likeq, likeq])
    if ptype:
        where.append('type = ?')
        params.append(ptype)
    if status:
        where.append('status = ?')
        params.append(status)
    else:
        # by default, non-admins and non-suppliers should only see approved products
        if not user or user['role'] not in ('admin', 'supplier'):
            where.append("status = 'approved'")

    where_sql = ('WHERE ' + ' AND '.join(where)) if where else ''
    # simple sort mapping
    if sort not in ('name', 'price', 'carbon'):
        sort = 'name'
    order_sql = f"ORDER BY {sort}"

    offset = (page - 1) * per_page
    sql = f"SELECT * FROM products {where_sql} {order_sql} LIMIT ? OFFSET ?"
    params.extend([per_page, offset])
    cursor.execute(sql, tuple(params))
    products = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(products)


@app.route('/api/products', methods=['POST'])
@login_required
def create_product():
    user = current_user()
    if user['role'] not in ('supplier', 'admin'):
        return jsonify({'error': 'Only suppliers may add products.'}), 403
    # require csrf for mutating requests
    if not verify_csrf():
        return jsonify({'error': 'Invalid CSRF token.'}), 400

    data = request.get_json() or {}
    required_fields = ['name', 'supplier', 'type', 'price', 'carbon', 'unit']
    if not all(data.get(field) for field in required_fields):
        return jsonify({'error': 'Missing required product fields.'}), 400

    supplier_id = user['id'] if user['role'] == 'supplier' else None
    # new products from suppliers are pending approval
    initial_status = 'approved' if user['role'] == 'admin' else 'pending'

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO products (supplier_id, name, supplier, type, price, strength, durability, carbon, unit, image_url, contact_info, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            supplier_id,
            data.get('name').strip(),
            data.get('supplier').strip(),
            data.get('type').strip(),
            float(data.get('price', 0)),
            float(data.get('strength', 0)),
            float(data.get('durability', 0)),
            float(data.get('carbon', 0)),
            data.get('unit').strip(),
            data.get('image_url', '').strip(),
            data.get('contact_info', '').strip(),
            initial_status,
            datetime.utcnow().isoformat()
        )
    )
    conn.commit()
    product_id = cursor.lastrowid
    conn.close()
    return jsonify({'message': 'Product saved successfully.', 'product_id': product_id}), 201


@app.route('/api/products/<int:product_id>', methods=['PUT'])
@login_required
def update_product(product_id):
    user = current_user()
    # require csrf
    if not verify_csrf():
        return jsonify({'error': 'Invalid CSRF token.'}), 400
    data = request.get_json() or {}
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT supplier_id FROM products WHERE id = ?", (product_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Product not found.'}), 404
    if user['role'] == 'supplier' and row['supplier_id'] != user['id']:
        conn.close()
        return jsonify({'error': 'Permission denied.'}), 403

    cursor.execute(
        "UPDATE products SET name=?, supplier=?, type=?, price=?, strength=?, durability=?, carbon=?, unit=?, image_url=?, contact_info=? WHERE id=?",
        (
            data.get('name', '').strip(),
            data.get('supplier', '').strip(),
            data.get('type', '').strip(),
            float(data.get('price', 0)),
            float(data.get('strength', 0)),
            float(data.get('durability', 0)),
            float(data.get('carbon', 0)),
            data.get('unit', '').strip(),
            data.get('image_url', '').strip(),
            data.get('contact_info', '').strip(),
            product_id
        )
    )
    conn.commit()
    conn.close()
    return jsonify({'message': 'Product updated successfully.'})


@app.route('/api/products/<int:product_id>', methods=['DELETE'])
@login_required
def delete_product(product_id):
    user = current_user()
    # require csrf for delete
    if not verify_csrf():
        return jsonify({'error': 'Invalid CSRF token.'}), 400
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT supplier_id FROM products WHERE id = ?", (product_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Product not found.'}), 404
    if user['role'] == 'supplier' and row['supplier_id'] != user['id']:
        conn.close()
        return jsonify({'error': 'Permission denied.'}), 403

    cursor.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Product deleted successfully.'})


@app.route('/api/metrics', methods=['GET'])
def metrics():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) AS total_products, AVG(carbon) AS average_carbon FROM products")
    product_metrics = cursor.fetchone()
    cursor.execute("SELECT COUNT(*) AS total_suppliers FROM users WHERE role = 'supplier'")
    supplier_metrics = cursor.fetchone()
    conn.close()

    return jsonify({
        'total_products': product_metrics['total_products'],
        'average_carbon': round(product_metrics['average_carbon'] or 0, 1),
        'total_suppliers': supplier_metrics['total_suppliers']
    })


@app.route('/api/products/pending', methods=['GET'])
@require_role('admin')
def pending_products():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 100))
    except ValueError:
        page = 1
        per_page = 100
    offset = (page - 1) * per_page
    cursor.execute("SELECT * FROM products WHERE status = 'pending' ORDER BY created_at LIMIT ? OFFSET ?", (per_page, offset))
    products = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(products)


@app.route('/api/products/<int:product_id>/approve', methods=['POST'])
@require_role('admin')
def approve_product(product_id):
    if not verify_csrf():
        return jsonify({'error': 'Invalid CSRF token.'}), 400
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE products SET status = 'approved' WHERE id = ?", (product_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Product approved.'})


@app.route('/api/products/<int:product_id>/reject', methods=['POST'])
@require_role('admin')
def reject_product(product_id):
    if not verify_csrf():
        return jsonify({'error': 'Invalid CSRF token.'}), 400
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE products SET status = 'rejected' WHERE id = ?", (product_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Product rejected.'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

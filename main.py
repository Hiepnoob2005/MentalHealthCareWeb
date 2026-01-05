import eventlet
eventlet.monkey_patch()
# -------------------------
# 🔹 Standard Library
# -------------------------
import os
import json
import uuid
import base64
import logging
import threading
import datetime
from datetime import datetime
from threading import RLock
file_lock = RLock()

# -------------------------
# 🔹 Third-party Libraries
# -------------------------
from dotenv import load_dotenv
import requests
import google.generativeai as genai
from werkzeug.utils import secure_filename
from matching import MatchingSystem, TagExtractor #thêm dòng này cho cái tính năng matching
# ... (các import hiện có) ...
from matching import MatchingSystem, TagExtractor #thêm dòng này cho cái tính năng matching
from werkzeug.utils import secure_filename # <-- THÊM DÒNG NÀY
import uuid
from datetime import datetime
from google import generativeai as genai
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import shutil
# Cấu hình cơ bản
load_dotenv()
logging.basicConfig(level=logging.INFO)

from flask import (
    Flask, jsonify, request, render_template,
    session, send_from_directory
)
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_login import (
    LoginManager, UserMixin, login_user,
    logout_user, current_user, login_required
)
from flask_socketio import (
    SocketIO, emit, join_room, leave_room
)

# -------------------------
# 🔹 Internal Modules
# -------------------------
from matching import MatchingSystem, TagExtractor

# -------------------------------------------------
# Load environment variables and initialize app
# -------------------------------------------------
load_dotenv()

app = Flask(__name__)
CORS(app)

# -------------------------------------------------
# Load Zoom API credentials
# -------------------------------------------------
ZOOM_ACCOUNT_ID = os.getenv("ZOOM_ACCOUNT_ID")
ZOOM_CLIENT_ID = os.getenv("ZOOM_CLIENT_ID")
ZOOM_CLIENT_SECRET = os.getenv("ZOOM_CLIENT_SECRET")

if not ZOOM_ACCOUNT_ID or not ZOOM_CLIENT_ID or not ZOOM_CLIENT_SECRET:
    logging.error("❌ Missing Zoom environment variables in .env")
else:
    logging.info("✅ Zoom credentials loaded successfully")

# -------------------------------------------------
# Get Zoom OAuth access token
# -------------------------------------------------
def get_zoom_token():
    try:
        url = "https://zoom.us/oauth/token"
        params = {
            "grant_type": "account_credentials",
            "account_id": ZOOM_ACCOUNT_ID,
        }

        credentials = f"{ZOOM_CLIENT_ID}:{ZOOM_CLIENT_SECRET}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()

        headers = {
            "Authorization": f"Basic {encoded_credentials}",
            "Content-Type": "application/x-www-form-urlencoded",
        }

        response = requests.post(url, params=params, headers=headers)

        if response.status_code == 200:
            return response.json().get("access_token")

        logging.error(f"❌ Zoom Token Error {response.status_code}: {response.text}")
        return None

    except Exception as e:
        logging.error(f"❌ Token Exception: {e}")
        return None

AVAILABILITY_FILE = "counselor_availability.txt"
AVAILABILITY_LOGS_FILE = "availability_logs.txt"
APPOINTMENTS_FILE = "appointments.txt"

# -------------------------------------------------
# Class xử lý sự kiện file
class UploadFolderHandler(FileSystemEventHandler):
    def on_any_event(self, event):
        # Chỉ quan tâm đến tạo mới (created) hoặc xóa (deleted)
        if event.event_type in ['created', 'deleted']:
            if not event.is_directory:
                logging.info(f"File change detected: {event.event_type} - {event.src_path}")
                # Bắn tín hiệu xuống Client để reload
                # namespace='/' là mặc định
                socketio.emit('admin_refresh_signal', {'type': event.event_type})

def start_file_watcher():
    """Khởi chạy tiến trình theo dõi file"""
    path = app.config["UPLOAD_FOLDER"]
    
    # Đảm bảo folder tồn tại trước khi theo dõi
    if not os.path.exists(path):
        os.makedirs(path)

    event_handler = UploadFolderHandler()
    observer = Observer()
    observer.schedule(event_handler, path, recursive=False)
    observer.start()
    logging.info(f"👀 Started watching folder: {path}")


PAPERWORKS_FOLDER = "paperworks"
if not os.path.exists(PAPERWORKS_FOLDER):
    os.makedirs(PAPERWORKS_FOLDER)
    logging.info(f"📁 Created paperworks folder: {PAPERWORKS_FOLDER}")

app.config["PAPERWORKS_FOLDER"] = PAPERWORKS_FOLDER

def move_verification_files_to_paperworks(username):
    """Di chuyển ảnh xác thực sang thư mục paperworks khi duyệt"""
    moved_files = []
    try:
        if not os.path.exists(UPLOAD_FOLDER):
            return []

        files = os.listdir(UPLOAD_FOLDER)
        for f in files:
            # Tìm file bắt đầu bằng username_ (ví dụ: nvan_degree.jpg)
            if f.startswith(f"{username}_"):
                src_path = os.path.join(UPLOAD_FOLDER, f)
                dst_path = os.path.join(PAPERWORKS_FOLDER, f)
                
                # Di chuyển file
                shutil.move(src_path, dst_path)
                logging.info(f"Moved file: {src_path} -> {dst_path}")
                
                # Chỉ lấy file ảnh để hiển thị (bỏ qua file json meta nếu không muốn hiện)
                if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                    moved_files.append(f)
                    
        return moved_files
    except Exception as e:
        logging.error(f"Error moving files for {username}: {e}")
        return []
# -------------------------------------------------
# Routes
# -------------------------------------------------
# --- CÁC HÀM TIỆN ÍCH MỚI (Đọc/Ghi file) ---
USER_DETAILS_FILE = 'user_details.json'
TEST_RESULTS_FILE = 'test_results.txt'

if not os.path.exists(TEST_RESULTS_FILE):
    with open(TEST_RESULTS_FILE, "w", encoding="utf-8") as f:
        f.write("Time;Username;Scores;Tags;RawAnswers\n")

def read_user_details():
    """Đọc file user_details.json"""
    try:
        with open(USER_DETAILS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def write_user_details(data):
    """Ghi đè file user_details.json"""
    with open(USER_DETAILS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
if not os.path.exists(TEST_RESULTS_FILE):
    with open(TEST_RESULTS_FILE, "w", encoding="utf-8") as f:
        f.write("Time;Username;Scores;Tags;RawAnswers\n")

@app.route('/api/save-dass21-results', methods=['POST'])
@login_required # Yêu cầu đăng nhập mới lưu được
def save_dass21_results():
    try:
        data = request.json
        answers = data.get('answers', [])
        tags = data.get('problem_tags', [])
        scores = data.get('scores', {}) # {D: ..., A: ..., S: ...}
        
        # Lấy thời gian hiện tại
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        username = current_user.username
        
        # Format dữ liệu để lưu vào file text
        # Cấu trúc: Thời gian;User;Điểm(D-A-S);Tags;Answers
        scores_str = f"D:{scores.get('D',0)}-A:{scores.get('A',0)}-S:{scores.get('S',0)}"
        tags_str = ",".join(tags)
        answers_str = ",".join(map(str, answers))
        
        log_line = f"{now};{username};{scores_str};{tags_str};{answers_str}\n"
        
        # Ghi vào file (mode 'a' để nối thêm vào cuối file)
        with open(TEST_RESULTS_FILE, "a", encoding="utf-8") as f:
            f.write(log_line)
            
        return jsonify({"message": "Kết quả đã được lưu thành công."}), 200
        
    except Exception as e:
        logging.error(f"Lỗi khi lưu kết quả test: {e}")
        return jsonify({"message": "Lỗi server khi lưu kết quả."}), 500

def get_latest_tags(user_id):
    """Lấy tags từ bài test mới nhất của user"""
    latest_tags = "none" # Mặc định
    try:
        with open(TEST_RESULTS_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith(user_id):
                    parts = line.strip().split(';')
                    # Giả định cột ProblemTags là cột thứ 5 (index 4)
                    if len(parts) >= 5:
                        latest_tags = parts[4]
            # Sau khi duyệt hết file, latest_tags sẽ là dòng cuối cùng
            return latest_tags.split(',')
    except Exception as e:
        print(f"Lỗi đọc file test_results: {e}")
        return ["none"]

# --- CÁC ROUTE MỚI CHO TRANG PROFILE ---

@app.route('/profile')
@login_required
def user_profile_page():
    """Route để hiển thị trang profile.html"""
    return render_template('profile.html')

@app.route('/api/profile', methods=['GET'])
@login_required
def get_profile_data():
    """API để JS lấy dữ liệu của user (Support cả Student & Counselor)"""
    user_id = str(current_user.id) # user.id của counselor là username
    
    # 1. Lấy thông tin liên lạc (Email/Phone) từ file JSON (dữ liệu động)
    details = read_user_details().get(user_id, {})
    
    response_data = {
        "username": current_user.username,
        "email": details.get("email", current_user.email), # Ưu tiên lấy từ file JSON, nếu không có lấy từ object User
        "phone": details.get("phone", ""),
        "is_counselor": current_user.is_counselor
    }

    # 2. Nếu là Counselor: Lấy thêm thông tin chuyên môn
    if current_user.is_counselor:
        counselor_info = {}
        try:
            if os.path.exists(COUNSELOR_FILE):
                with open(COUNSELOR_FILE, "r", encoding="utf-8") as f:
                    lines = f.readlines()[1:]
                    for line in lines:
                        parts = line.strip().split(";")
                        # Format: ID;Username;Name;Email;Pass;Specialties;Rating;Status;Experience;Verified
                        if len(parts) >= 10 and parts[1] == current_user.username:
                            counselor_info = {
                                "name": parts[2],
                                "specialties": parts[5],
                                "rating": parts[6],
                                "experience": parts[8],
                                "verified": parts[9]
                            }
                            break
        except Exception as e:
            logging.error(f"Lỗi đọc counselor info: {e}")
        
        response_data["counselor_info"] = counselor_info

    # 3. Nếu là Student: Lấy tags từ bài test
    else:
        tags = get_latest_tags(user_id)
        response_data["latest_tags"] = tags

    return jsonify(response_data), 200

@app.route('/api/profile/update', methods=['POST'])
@login_required
def update_profile_data():
    """API để user cập nhật thông tin"""
    user_id = str(current_user.id)
    data = request.get_json()
    
    new_email = data.get('email')
    new_phone = data.get('phone')
    
    # Đọc toàn bộ file, cập nhật, và ghi đè
    all_details = read_user_details()
    
    if user_id not in all_details:
        all_details[user_id] = {}
        
    all_details[user_id]['email'] = new_email
    all_details[user_id]['phone'] = new_phone
    
    write_user_details(all_details)
    
    return jsonify({"message": "Cập nhật thông tin thành công!"}), 200

@app.route("/")
def home():
    return render_template("index.html")

# Lưu danh sách username đang online: {'username': 'socket_id'}
online_counselors = set() 
# Map socket_id ngược lại username để xử lý khi disconnect: {'socket_id': 'username'}
socket_id_to_user = {} 

# --- Thêm vào main.py ---

# --- THÊM VÀO main.py ---

@app.route("/api/counselor/create-manual-appointment", methods=["POST"])
@login_required
def create_manual_appointment():
    """API để chuyên gia tự tạo lịch hẹn với sinh viên"""
    if not current_user.is_counselor:
        return jsonify({"message": "Unauthorized"}), 403

    data = request.get_json()
    student_username = data.get("student_name")
    date = data.get("date")
    time = data.get("time")

    if not all([student_username, date, time]):
        return jsonify({"message": "Thiếu thông tin (Tên SV, Ngày hoặc Giờ)"}), 400

    try:
        # 1. Tạo ID cuộc hẹn
        appt_id = str(uuid.uuid4())[:8]
        
        # 2. Format dòng dữ liệu: ID;Student;Counselor;Date;Time;Status
        # Status mặc định là 'confirmed' vì do chuyên gia tạo
        line = f"{appt_id};{student_username};{current_user.username};{date};{time};confirmed\n"

        # 3. Lưu vào file appointments.txt
        # Đảm bảo file tồn tại
        if not os.path.exists(APPOINTMENTS_FILE):
            with open(APPOINTMENTS_FILE, "w", encoding="utf-8") as f:
                f.write("ApptID;UserID;CounselorID;Date;Time;Status\n")

        with open(APPOINTMENTS_FILE, "a", encoding="utf-8") as f:
            f.write(line)

        return jsonify({"message": "Tạo lịch thành công"}), 200

    except Exception as e:
        logging.error(f"Lỗi tạo lịch thủ công: {e}")
        return jsonify({"message": "Lỗi server"}), 500

@app.route("/create_meeting")
def create_meeting():
    """Create a Scheduled Meeting (Type 2) to force Join Before Host working"""
    try:
        # 1. Auth (Giữ nguyên)
        if not all([ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET]):
            return jsonify({"error": "Credential error"}), 500
        token = get_zoom_token()
        if not token: return jsonify({"error": "Auth failed"}), 500
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        # 2. Lấy thời gian hiện tại (UTC)
        # Zoom yêu cầu format: 'yyyy-MM-ddTHH:mm:ssZ'
        now_utc = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')

        # 3. Payload ĐÃ SỬA ĐỔI
        payload = {
            "topic": "Mental Health Consultation",
            
            # QUAN TRỌNG 1: Chuyển thành Type 2 (Scheduled)
            "type": 2, 
            
            # Đặt thời gian là ngay bây giờ
            "start_time": now_utc,
            "duration": 60, # Mặc định 60 phút (không ảnh hưởng việc join)
            
            "settings": {
                # QUAN TRỌNG 2: Cho phép vào trước Host
                "join_before_host": True,
                
                # QUAN TRỌNG 3: Cho phép vào trước bao lâu? 
                # 0 = Vào bất cứ lúc nào (Anytime)
                # 5 = Vào trước 5 phút, 10 = 10 phút...
                "jbh_time": 0, 

                # QUAN TRỌNG 4: Tắt phòng chờ
                "waiting_room": False,

                # Các setting phụ trợ để vào nhanh
                "approval_type": 2, # Tự động duyệt
                "meeting_authentication": False, # Không cần login
                "participant_video": True,
                "host_video": True,
                "mute_upon_entry": False
            },
        }

        response = requests.post(
            "https://api.zoom.us/v2/users/me/meetings",
            headers=headers,
            json=payload,
            timeout=30,
        )

        if response.status_code == 201:
            data = response.json()
            return jsonify({
                "join_url": data.get("join_url"),
                "meeting_id": data.get("id"),
            })
        
        return jsonify({"error": response.text}), response.status_code

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/check_credentials")
def check_credentials():
    """Verify Zoom credentials"""
    ok = all([ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET])
    return jsonify({
        "credentials_configured": ok,
        "account_id": ZOOM_ACCOUNT_ID or "MISSING",
        "client_id": (ZOOM_CLIENT_ID[:10] + "...") if ZOOM_CLIENT_ID else "MISSING",
        "client_secret": (ZOOM_CLIENT_SECRET[:10] + "...") if ZOOM_CLIENT_SECRET else "MISSING",
    })


# -------------------------------------------------
# Gemini Config
# -------------------------------------------------
api_key_value = os.environ.get("GEMINI_API_KEY")
if not api_key_value:
    logging.error("❌ GEMINI_API_KEY missing in .env")
else:
    genai.configure(api_key=api_key_value)
    logging.info("✅ Gemini API key loaded")


# -------------------------------------------------
# Flask Secret Key
# -------------------------------------------------
app.config["SECRET_KEY"] = os.getenv(
    "FLASK_SECRET_KEY", "mot-chuoi-bi-mat-rat-kho-doan-12345"
)

# -------------------------------------------------
# SocketIO
# -------------------------------------------------
socketio = SocketIO(app, cors_allowed_origins="*")


# -------------------------------------------------
# Upload Folder Config
# -------------------------------------------------
UPLOAD_FOLDER = "verification_uploads"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg"}
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
    logging.info(f"📁 Created upload folder: {UPLOAD_FOLDER}")


CHAT_HISTORY_DIR = "chat_history"
if not os.path.exists(CHAT_HISTORY_DIR):
    os.makedirs(CHAT_HISTORY_DIR)
    logging.info(f"Đã tạo thư mục {CHAT_HISTORY_DIR}")

bcrypt = Bcrypt(app)
USER_FILE = "user_accounts.txt"  # File lưu tài khoản

# Cấu hình cho việc tạo nội dung (cho Chatbot)
GENERATION_CONFIG = {
    "temperature": 0.7,
    "top_p": 0.8,
    "top_k": 40,
    "max_output_tokens": 1000,
}

# Hướng dẫn hệ thống (cho Chatbot)
SYSTEM_INSTRUCTION = (
    "Bạn là StudentMind Connect AI, một trợ lý hỗ trợ sức khỏe tâm lý cho sinh viên. "
    "Chỉ trả lời nhưng câu hỏi liên quan đến sức khỏe tâm lý, tinh thần."
    "Mục tiêu của bạn là lắng nghe, thấu hiểu và đưa ra các phản hồi đồng cảm, hỗ trợ. "
    "Tuyệt đối không đưa ra lời khuyên y tế, chẩn đoán, hoặc cam kết thay thế chuyên gia. "
    "Nếu gặp tình huống khẩn cấp, hãy đề nghị tìm kiếm sự trợ giúp chuyên nghiệp."
    "Hãy trả lời ngắn gọn."
)

# Cấu hình an toàn (cho Chatbot)
SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {
        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE",
    },
]
# Thêm constants cho Quick Test
TEST_RESULTS_FILE = "test_results.txt"

# Khởi tạo model Chatbot một lần
try:
    chatbot_model = genai.GenerativeModel(
        model_name="gemini-flash-latest",
        generation_config=GENERATION_CONFIG,
        system_instruction=SYSTEM_INSTRUCTION,
        safety_settings=SAFETY_SETTINGS,
    )
    logging.info("Khởi tạo Chatbot Model thành công với System Instruction.")
except Exception as e:
    logging.error(f"Lỗi nghiêm trọng khi khởi tạo Chatbot Model: {e}")
    chatbot_model = None

# --- Khởi tạo Matching System ---
matching_system = MatchingSystem()
logging.info("Khởi tạo Matching System thành công.")

# --- Quản lý Phiên Chat (Chatbot) ---
chat_sessions = {}


def get_or_create_chat_session(conversation_id):
    if conversation_id not in chat_sessions:
        if not chatbot_model:
            logging.error("Model chưa được khởi tạo, không thể tạo chat session.")
            return None

        logging.info(f"Tạo phiên chat mới: {conversation_id}")
        chat_sessions[conversation_id] = chatbot_model.start_chat(history=[])

    return chat_sessions[conversation_id]


def summarize_chat_with_ai(history_messages):
    """
    Sử dụng Gemini để tóm tắt lịch sử chat theo các key.
    history_messages: Một list các dict [{"role": "user", "text": "..."}, ...]
    """

    # 1. Chuyển list lịch sử thành một chuỗi văn bản
    formatted_history = ""
    for msg in history_messages:
        role = "Sinh viên" if msg["role"] == "user" else "AI Hỗ trợ"
        formatted_history += f"{role}: {msg['text']}\n"

    # 2. Tạo "Mệnh Lệnh Tóm Tắt" (Meta-Prompt)
    META_PROMPT = f"""
    Bạn là một trợ lý phân tích hội thoại. Dưới đây là lịch sử chat giữa một 'Sinh viên' và 'AI Hỗ trợ' tâm lý.
    Dựa vào nội dung, hãy phân tích và trích xuất 'topic' (chủ đề chính), 'issue' (vấn đề cốt lõi người dùng gặp phải), và 'symptoms' (các triệu chứng được đề cập).

    QUY TẮC:
    1. HÃY CHỈ TRẢ LỜI BẰNG MỘT ĐỐI TƯỢNG JSON HỢP LỆ.
    2. Nếu không đủ thông tin để xác định một trường, hãy dùng giá trị "Chưa xác định".
    3. Giữ nội dung tóm tắt ngắn gọn.

    Ví dụ JSON đầu ra:
    {{
      "topic": "Stress thi cử",
      "issue": "Người dùng lo lắng và áp lực về kỳ thi sắp tới.",
      "symptoms": "Mất ngủ, khó tập trung."
    }}

    --- LỊCH SỬ CHAT ĐỂ PHÂN TÍCH ---
    {formatted_history}
    --- KẾT THÚC LỊCH SỬ CHAT ---

    JSON PHÂN TÍCH:
    """

    try:
        # 3. Gọi API (dùng 'generate_content' cho tác vụ một lần)
        # Chúng ta tái sử dụng 'gemini_model' đã khởi tạo
        response = chatbot_model.generate_content(
            META_PROMPT,
            # Dùng config riêng cho việc tóm tắt, nhiệt độ thấp để chính xác
            generation_config=genai.types.GenerationConfig(temperature=0.2),
            safety_settings=SAFETY_SETTINGS,
        )

        # 4. Xử lý và Parse JSON từ phản hồi của AI
        raw_response_text = response.text.strip()

        # AI có thể trả về JSON trong khối '```json ... ```'
        if raw_response_text.startswith("```json"):
            raw_response_text = raw_response_text[7:-3].strip()

        summary_data = json.loads(raw_response_text)

        # Đảm bảo các key luôn tồn tại
        return {
            "topic": summary_data.get("topic", "Chưa xác định"),
            "issue": summary_data.get("issue", "Chưa xác định"),
            "symptoms": summary_data.get("symptoms", "Chưa xác định"),
        }

    except json.JSONDecodeError as e:
        logging.error(f"Lỗi JSONDecodeError khi tóm tắt: {e}")
        logging.error(f"Phản hồi thô từ AI (lỗi JSON): {raw_response_text}")
        return {"topic": "Lỗi định dạng JSON", "issue": "Lỗi", "symptoms": "Lỗi"}
    except Exception as e:
        logging.error(f"Lỗi nghiêm trọng khi gọi API tóm tắt: {e}")
        # Ghi lại traceback để debug
        import traceback

        traceback.print_exc()
        return {"topic": "Lỗi API tóm tắt", "issue": "Lỗi", "symptoms": "Lỗi"}


def allowed_file(filename):
    """Kiểm tra file có đuôi mở rộng cho phép không"""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def save_chat_history_and_summarize(conversation_id, history):
    """
    Lưu lịch sử chat VÀ gọi AI để tóm tắt.
    (Hàm này nên được chạy trong một thread riêng)
    """
    try:
        now = datetime.now()
        file_path = os.path.join(CHAT_HISTORY_DIR, f"{conversation_id}.json")

        # 1. Chuyển đổi history sang list dictionary
        messages = []
        for msg in history:
            if msg.parts:
                messages.append({"role": msg.role, "text": msg.parts[0].text})

        # 2. [MỚI] Gọi AI để lấy tóm tắt
        summary_data = {
            "topic": "Chưa xác định",
            "issue": "Chưa xác định",
            "symptoms": "Chưa xác định",
        }

        # Chỉ tóm tắt nếu cuộc chat có ý nghĩa (ví dụ: hơn 2 tin nhắn)
        if len(messages) > 2:
            logging.info(f"Đang gọi AI để tóm tắt (ConvID: {conversation_id})...")
            summary_data = summarize_chat_with_ai(messages)

        # 3. [MỚI] Đọc file cũ để không ghi đè tóm tắt cũ nếu AI thất bại
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    existing_data = json.load(f)

                # Chỉ cập nhật nếu AI trả về kết quả mới
                if summary_data["topic"] == "Chưa xác định":
                    summary_data["topic"] = existing_data.get("topic", "Chưa xác định")
                if summary_data["issue"] == "Chưa xác định":
                    summary_data["issue"] = existing_data.get("issue", "Chưa xác định")
                if summary_data["symptoms"] == "Chưa xác định":
                    summary_data["symptoms"] = existing_data.get(
                        "symptoms", "Chưa xác định"
                    )
            except json.JSONDecodeError:
                logging.warning(f"File {file_path} bị lỗi, sẽ ghi đè.")

        # 4. Chuẩn bị dữ liệu cuối cùng
        data_to_save = {
            "conversation_id": conversation_id,
            "last_updated_date": now.strftime("%Y-%m-%d"),
            "last_updated_time": now.strftime("%H:%M:%S"),
            "topic": summary_data.get("topic"),
            "issue": summary_data.get("issue"),
            "symptoms": summary_data.get("symptoms"),
            "messages": messages,
        }

        # 5. Ghi file
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data_to_save, f, ensure_ascii=False, indent=4)

        logging.info(f"Đã cập nhật và tóm tắt lịch sử chat vào {file_path}")

    except Exception as e:
        logging.error(f"Lỗi nghiêm trọng khi lưu/tóm tắt: {e}")
        import traceback

        traceback.print_exc()


# --- CẤU HÌNH FLASK-LOGIN ---
login_manager = LoginManager()
login_manager.init_app(app)

# ----------------------------------------------------
# --- II. USER CLASS VÀ HÀM QUẢN LÝ NGƯỜI DÙNG ---
# ----------------------------------------------------
# --- CẬP NHẬT: Class User hỗ trợ Admin và Counselor ---
ADMIN_FILE = "admin_accounts.txt"
COUNSELOR_FILE = "counselor_accounts.txt"  # Đảm bảo biến này đã được khai báo

class User(UserMixin):
    # Hàm khởi tạo PHẢI có is_counselor và verified
    def __init__(
        self,
        id,
        username,
        email,
        password_hash,
        is_admin=False,
        is_counselor=False,
        verified=False,
    ):
        self.id = id
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.is_admin = is_admin
        self.is_counselor = is_counselor  # <-- Dòng này thiếu nên gây lỗi
        self.verified = verified  # <-- Dòng này cũng cần thêm

    @staticmethod
    def get_by_id(user_id):
        # 1. Tìm trong Admin
        try:
            if os.path.exists(ADMIN_FILE):
                with open(ADMIN_FILE, "r", encoding="utf-8") as f:
                    for line in f.readlines()[1:]:
                        parts = line.strip().split(";")
                        if len(parts) >= 3 and parts[0] == user_id:
                            return User(
                                parts[0], parts[0], parts[1], parts[2], is_admin=True
                            )
        except Exception:
            pass

        # 2. Tìm trong Counselor (Quan trọng: Cần đọc đúng file cấu trúc mới)
        try:
            if os.path.exists(COUNSELOR_FILE):
                with open(COUNSELOR_FILE, "r", encoding="utf-8") as f:
                    for line in f.readlines()[1:]:  # Bỏ qua header nếu có
                        parts = line.strip().split(";")
                        # Cấu trúc: ID(0);Username(1);Name(2);Email(3);Pass(4)...
                        if len(parts) >= 10 and parts[1] == user_id:
                            is_verified = parts[9].strip().lower() == "yes"
                            # TRUYỀN ĐỦ THAM SỐ is_counselor VÀ verified
                            return User(
                                parts[1],
                                parts[1],
                                parts[3],
                                parts[4],
                                is_counselor=True,
                                verified=is_verified,
                            )
        except Exception as e:
            logging.error(f"Lỗi đọc file counselor: {e}")

        # 3. Tìm trong User thường
        try:
            with open(USER_FILE, "r", encoding="utf-8") as f:
                for line in f.readlines()[1:]:
                    parts = line.strip().split(";")
                    if len(parts) >= 3 and parts[0] == user_id:
                        return User(parts[0], parts[0], parts[1], parts[2])
        except FileNotFoundError:
            pass

        return None

    @staticmethod
    def get_by_username(username):
        return User.get_by_id(username)
    
    @staticmethod
    def get_by_email(email):
        """
        Kiểm tra xem email đã tồn tại trong hệ thống (Admin, Counselor, User) hay chưa.
        Trả về object User nếu tìm thấy, ngược lại trả về None.
        """
        # Chuẩn hóa email đầu vào để so sánh (thường email không phân biệt hoa thường)
        target_email = email.strip().lower()

        # 1. Tìm trong Admin
        # Cấu trúc Admin: Username(0);Email(1);Pass(2)...
        try:
            if os.path.exists(ADMIN_FILE):
                with open(ADMIN_FILE, "r", encoding="utf-8") as f:
                    # Bỏ qua dòng header
                    lines = f.readlines()[1:]
                    for line in lines:
                        parts = line.strip().split(";")
                        # Kiểm tra độ dài và so sánh email ở vị trí [1]
                        if len(parts) >= 3 and parts[1].strip().lower() == target_email:
                            return User(
                                id=parts[0],
                                username=parts[0],
                                email=parts[1],
                                password_hash=parts[2],
                                is_admin=True
                            )
        except Exception as e:
            logging.error(f"Lỗi kiểm tra email Admin: {e}")

        # 2. Tìm trong Counselor
        # Cấu trúc Counselor: ID(0);Username(1);Name(2);Email(3);Pass(4)...;Verified(9)
        try:
            if os.path.exists(COUNSELOR_FILE):
                with open(COUNSELOR_FILE, "r", encoding="utf-8") as f:
                    lines = f.readlines()[1:]
                    for line in lines:
                        parts = line.strip().split(";")
                        # Kiểm tra độ dài và so sánh email ở vị trí [3]
                        if len(parts) >= 10 and parts[3].strip().lower() == target_email:
                            is_verified = parts[9].strip().lower() == "yes"
                            return User(
                                id=parts[1],        # Dùng username làm ID cho thống nhất
                                username=parts[1],
                                email=parts[3],     # Email nằm ở index 3
                                password_hash=parts[4],
                                is_counselor=True,
                                verified=is_verified
                            )
        except Exception as e:
            logging.error(f"Lỗi kiểm tra email Counselor: {e}")

        # 3. Tìm trong User thường
        # Cấu trúc User: Username(0);Email(1);Pass(2)...
        try:
            if os.path.exists(USER_FILE):
                with open(USER_FILE, "r", encoding="utf-8") as f:
                    lines = f.readlines()[1:]
                    for line in lines:
                        parts = line.strip().split(";")
                        # Kiểm tra độ dài và so sánh email ở vị trí [1]
                        if len(parts) >= 3 and parts[1].strip().lower() == target_email:
                            return User(
                                id=parts[0],
                                username=parts[0],
                                email=parts[1],
                                password_hash=parts[2]
                            )
        except Exception as e:
            logging.error(f"Lỗi kiểm tra email User: {e}")

        # Không tìm thấy trong cả 3 file
        return None


@login_manager.user_loader
def load_user(user_id):
    return User.get_by_id(user_id)


# Thêm class xử lý Quick Test
# thêm vào ngày 10/11/2025
class QuickTestProcessor:
    """Xử lý kết quả Quick Test và gán Problem Tags"""

    @staticmethod
    def calculate_score_and_tags(answers):
        """
        Tính điểm và trích xuất problem tags từ câu trả lời
        Returns: (score, problem_tags)
        """
        score = 0
        problem_tags = []

        # Câu 1: Lo lắng/căng thẳng
        q1_mapping = {
            "Không bao giờ": 0,
            "Đôi khi": 1,
            "Thường xuyên": 2,
            "Luôn luôn": 3,
        }

        # Câu 2: Khó khăn tập trung
        q2_mapping = {
            "Không gặp khó khăn": 0,
            "Ít khi": 1,
            "Thỉnh thoảng": 2,
            "Rất thường xuyên": 3,
        }

        # Câu 3: Giấc ngủ
        q3_mapping = {
            "Rất tốt": 0,
            "Bình thường": 1,
            "Không tốt": 2,
            "Rất tệ, thường mất ngủ": 3,
        }

        # Tính điểm cho từng câu
        q1_score = q1_mapping.get(answers.get("q1", ""), 0)
        q2_score = q2_mapping.get(answers.get("q2", ""), 0)
        q3_score = q3_mapping.get(answers.get("q3", ""), 0)

        total_score = q1_score + q2_score + q3_score

        # Gán problem tags dựa trên điểm từng câu
        if q1_score >= 2:
            problem_tags.extend(["stress", "lo_au"])

        if q2_score >= 2:
            problem_tags.append("hoc_tap")

        if q3_score >= 2:
            problem_tags.append("roi_loan_giac_ngu")

        # Thêm tags dựa trên tổng điểm
        if total_score >= 7:
            problem_tags.append("tram_cam")  # Nguy cơ cao

        # Loại bỏ duplicates
        problem_tags = list(set(problem_tags))

        return total_score, problem_tags

    @staticmethod
    def save_test_result(user_id, answers, problem_tags, score):
        """Lưu kết quả test vào file"""
        try:
            # Tạo file nếu chưa tồn tại
            if not os.path.exists(TEST_RESULTS_FILE):
                with open(TEST_RESULTS_FILE, "w", encoding="utf-8") as f:
                    f.write("UserID;TestDate;TestTime;Answers;ProblemTags;Score\n")

            # Chuẩn bị dữ liệu
            now = datetime.now()
            test_date = now.strftime("%Y-%m-%d")
            test_time = now.strftime("%H:%M:%S")
            answers_str = json.dumps(answers)
            tags_str = ",".join(problem_tags) if problem_tags else "none"

            # Ghi vào file
            with open(TEST_RESULTS_FILE, "a", encoding="utf-8") as f:
                f.write(
                    f"{user_id};{test_date};{test_time};{answers_str};{tags_str};{score}\n"
                )

            return True

        except Exception as e:
            logging.error(f"Error saving test result: {e}")
            return False


# ----------------------------------------------------
# --- III. CÁC API ROUTE (ĐIỂM CUỐI) ---
# ----------------------------------------------------


# --- API cho Chatbot (ĐÃ SỬA LỖI AN TOÀN) ---
@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_message = data.get("message", "").strip()
    conversation_id = data.get("conversationId")

    if current_user.is_authenticated:
        # Thêm tiền tố "user_" để tránh trùng với các ID khác
        conversation_id = f"user_{current_user.username}" 
        logging.info(f"User đã đăng nhập. Sử dụng ID cố định: {conversation_id}")

    if not user_message or not conversation_id:
        return jsonify({"error": "Message and conversationId are required"}), 400

    if not chatbot_model:
        return jsonify({"reply": "Xin lỗi, model AI chưa được khởi tạo đúng."}), 500

    try:
        chat_session = get_or_create_chat_session(conversation_id)
        if not chat_session:
            return jsonify({"reply": "Xin lỗi, không thể tạo phiên chat."}), 500

        response = chat_session.send_message(user_message)

        # Kiểm tra nếu PHẢN HỒI bị chặn
        if not response.candidates:
            return jsonify({"reply": "Xin lỗi, AI không đưa ra được phản hồi."}), 500

        if response.candidates[0].finish_reason == "SAFETY":
            logging.warning("Phản hồi của AI bị chặn vì SAFETY.")
            return (
                jsonify(
                    {
                        "reply": "Xin lỗi, phản hồi của AI cho chủ đề này đã bị chặn vì lý do an toàn. Bạn có thể thử diễn đạt lại câu hỏi của mình không?"
                    }
                ),
                200,
            )

        reply = (
            response.text.strip()
            if hasattr(response, "text") and response.text
            else "Xin lỗi, AI chưa thể phản hồi."
        )
        current_history = list(chat_session.history)

        # 2. Tạo và chạy thread
        save_thread = threading.Thread(
            target=save_chat_history_and_summarize,  # Gọi hàm mới
            args=(conversation_id, current_history),
        )
        save_thread.start()
        return jsonify({"reply": reply})

    except Exception as e:
        import traceback

        traceback.print_exc()

        # Kiểm tra nếu YÊU CẦU (prompt) bị chặn
        prompt_feedback = None
        try:
            if e.response.prompt_feedback:
                prompt_feedback = e.response.prompt_feedback
        except AttributeError:
            pass

        if prompt_feedback and prompt_feedback.block_reason:
            logging.warning(
                f"Yêu cầu của người dùng bị chặn: {prompt_feedback.block_reason}"
            )
            return (
                jsonify(
                    {
                        "reply": "Xin lỗi, tin nhắn của bạn đã bị chặn vì lý do an toàn. Vui lòng thử lại."
                    }
                ),
                400,
            )

        # Lỗi 500 chung
        return (
            jsonify(
                {
                    "reply": "Xin lỗi, hệ thống AI đang gặp sự cố. Vui lòng thử lại hoặc kiểm tra server backend."
                }
            ),
            500,
        )

@app.route("/api/chat/history", methods=["GET"])
def get_ai_chat_history():
    """
    API trả về lịch sử chat của User (nếu đã đăng nhập) 
    hoặc theo conversationId (nếu là khách)
    """
    # 1. Xác định ID cần lấy
    conversation_id = request.args.get("conversationId")
    
    if current_user.is_authenticated:
        conversation_id = f"user_{current_user.username}"
    
    if not conversation_id:
        return jsonify({"messages": []})

    # 2. Tìm file lịch sử
    file_path = os.path.join(CHAT_HISTORY_DIR, f"{conversation_id}.json")
    
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Trả về danh sách tin nhắn
                return jsonify({"messages": data.get("messages", [])})
        except Exception as e:
            logging.error(f"Lỗi đọc history: {e}")
            return jsonify({"messages": []})
    
    return jsonify({"messages": []})

# --- API cho Đăng ký ---
@app.route("/api/register", methods=["POST"])
def register_secure():
    data = request.get_json()
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if not username or not email or not password:
        return jsonify({"message": "Vui lòng nhập đầy đủ thông tin!"}), 400

    # Tự động tạo file nếu chưa có
    if not os.path.exists(USER_FILE):
        User.get_by_id("dummy_check_to_create_file")

    if User.get_by_username(username) or User.get_by_email(email):
        return jsonify({"message": "Tên đăng nhập hoặc Email đã tồn tại!"}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")

    try:
        with open(USER_FILE, "a", encoding="utf-8") as f:
            f.write(f"{username};{email};{hashed_password}\n")
        return jsonify({"message": "Tạo tài khoản thành công!"}), 201
    except Exception as e:
        return jsonify({"message": f"Lỗi khi lưu tài khoản: {e}"}), 500

# --- CẬP NHẬT: API Đăng nhập ---
@app.route("/api/login", methods=["POST"])
def login_secure():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"message": "Vui lòng nhập tài khoản và mật khẩu"}), 400

    user = User.get_by_id(username)  # Dùng get_by_id vì nó quét cả 3 file

    if user and bcrypt.check_password_hash(user.password_hash, password):
        # Logic riêng cho Counselor
        if user.is_counselor and not user.verified:
            return (
                jsonify(
                    {
                        "message": "Tài khoản chuyên gia của bạn đang chờ Admin phê duyệt."
                    }
                ),
                403,
            )

        # Đăng nhập bằng Flask-Login (chỉ lưu user.id)
        login_user(user, remember=True)

        # --- 2. THÊM CODE SỬA LỖI TẠI ĐÂY ---
        # Gán thông tin vào Flask session để Socket.IO có thể đọc được
        session["user_id"] = user.id
        session["username"] = user.username

        # Xác định 'role' và gán vào session
        if user.is_admin:
            session["role"] = "admin"
        elif user.is_counselor:
            session["role"] = "counselor"
        else:
            session["role"] = "user"
        # --- KẾT THÚC SỬA LỖI ---

        return (
            jsonify(
                {
                    "message": "Đăng nhập thành công!",
                    "username": user.username,
                    "is_admin": user.is_admin,
                    "is_counselor": user.is_counselor,
                    "user_id": user.id,
                    "user_role": session["role"],
                }
            ),
            200,
        )

    return jsonify({"message": "Tên đăng nhập hoặc mật khẩu không đúng"}), 401


# --- API cho Đăng xuất ---
@app.route("/api/logout", methods=["POST"])
@login_required  # Chỉ người đã đăng nhập mới có thể đăng xuất
def logout():
    logout_user()  # Xóa session
    return jsonify({"message": "Đăng xuất thành công!"}), 200


# --- API để kiểm tra trạng thái ---
@app.route("/api/status")
def get_status():
    if current_user.is_authenticated:
        # Trả về đầy đủ role để JS xử lý
        return jsonify({
            "logged_in": True, 
            "username": current_user.username,
            "is_admin": getattr(current_user, 'is_admin', False),
            "is_counselor": getattr(current_user, 'is_counselor', False)
        })
    else:
        return jsonify({"logged_in": False})


# Thêm API endpoints cho Quick Test
# 10/11/2025
@app.route("/api/test/submit", methods=["POST"])
def submit_quick_test():
    """
    API xử lý kết quả Quick Test
    Body: {
        "answers": {
            "q1": "Thường xuyên",
            "q2": "Thỉnh thoảng",
            "q3": "Không tốt"
        }
    }
    """
    data = request.get_json()
    answers = data.get("answers", {})

    if not answers or len(answers) < 3:
        return jsonify({"error": "Please answer all questions"}), 400

    try:
        # Tính điểm và trích xuất tags
        score, problem_tags = QuickTestProcessor.calculate_score_and_tags(answers)

        # Lấy user_id (nếu đã đăng nhập)
        user_id = (
            current_user.username if current_user.is_authenticated else "anonymous"
        )

        # Lưu kết quả
        QuickTestProcessor.save_test_result(user_id, answers, problem_tags, score)

        # Lưu problem_tags vào session để sử dụng sau
        from flask import session

        session["last_test_tags"] = problem_tags
        session["last_test_score"] = score

        # Phân loại mức độ
        if score <= 3:
            level = "Tốt"
            message = "Sức khỏe tâm lý của bạn đang ở mức tốt. Hãy duy trì!"
        elif score <= 6:
            level = "Trung bình"
            message = "Bạn đang có một số dấu hiệu stress. Nên tìm hiểu các phương pháp thư giãn."
        else:
            level = "Cần hỗ trợ"
            message = "Bạn nên tìm kiếm sự hỗ trợ từ chuyên gia tâm lý."

        return (
            jsonify(
                {
                    "success": True,
                    "score": score,
                    "level": level,
                    "message": message,
                    "problem_tags": problem_tags,
                    "should_find_counselor": len(problem_tags) > 0,
                }
            ),
            200,
        )

    except Exception as e:
        logging.error(f"Error processing test: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/test/history", methods=["GET"])
@login_required
def get_test_history():
    """Lấy lịch sử làm test của user"""
    try:
        user_id = current_user.username
        history = []

        if os.path.exists(TEST_RESULTS_FILE):
            with open(TEST_RESULTS_FILE, "r", encoding="utf-8") as f:
                lines = f.readlines()[1:]  # Skip header

                for line in lines:
                    parts = line.strip().split(";")
                    if len(parts) >= 6 and parts[0] == user_id:
                        history.append(
                            {
                                "date": parts[1],
                                "time": parts[2],
                                "score": int(parts[5]),
                                "tags": (
                                    parts[4].split(",") if parts[4] != "none" else []
                                ),
                            }
                        )

        # Sắp xếp theo ngày giờ mới nhất
        history.sort(key=lambda x: f"{x['date']} {x['time']}", reverse=True)

        return jsonify({"history": history[:10]}), 200  # Trả về 10 kết quả gần nhất

    except Exception as e:
        logging.error(f"Error getting test history: {e}")
        return jsonify({"error": "Internal server error"}), 500


# --- API Matching Endpoints --- Thêm ngày 10/11/2025
@app.route("/api/match/find", methods=["POST"])
def find_matching_counselors():
    """
    API tìm chuyên gia phù hợp
    Body: {
        "problem_tags": ["stress", "lo_au"],
        "only_online": true,
        "min_rating": 4.0
    }
    """
    data = request.get_json()
    problem_tags = data.get("problem_tags", [])
    only_online = data.get("only_online", False)
    min_rating = data.get("min_rating", 0.0)

    if not problem_tags:
        return jsonify({"error": "problem_tags is required"}), 400

    try:
        matches = matching_system.find_matches(
            problem_tags=problem_tags, only_online=only_online, min_rating=min_rating
        )

        # Convert to JSON-serializable format
        results = []
        for counselor in matches:
            status = "online" if counselor.user_name in online_counselors else "offline"
            results.append(
                {
                    "id": counselor.id,
                    "username": counselor.user_name,
                    "name": counselor.name,
                    "specialties": counselor.specialties,
                    "rating": counselor.rating,
                    "status": status,
                    "experience": counselor.experience,
                    "match_score": round(counselor.match_score, 1),
                }
            )

        return (
            jsonify(
                {"matches": results, "total": len(results), "search_tags": problem_tags}
            ),
            200,
        )

    except Exception as e:
        logging.error(f"Error in matching: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/match/from-test", methods=["POST"])
def match_from_test_results():
    """
    API matching từ kết quả Quick Test
    Body: {
        "answers": {
            "q1": "Thường xuyên",
            "q2": "Thỉnh thoảng",
            "q3": "Không tốt"
        }
    }
    """
    data = request.get_json()
    answers = data.get("answers", {})

    if not answers:
        return jsonify({"error": "answers is required"}), 400

    try:
        # Extract tags từ test results
        tags = TagExtractor.extract_from_test_results(answers)

        if not tags:
            return (
                jsonify(
                    {"message": "No issues detected from test results", "matches": []}
                ),
                200,
            )

        # Find matching counselors
        matches = matching_system.find_matches(problem_tags=tags)

        results = []
        for counselor in matches:
            results.append(
                {
                    "id": counselor.id,
                    "name": counselor.name,
                    "specialties": counselor.specialties,
                    "rating": counselor.rating,
                    "status": counselor.status,
                    "experience": counselor.experience,
                    "match_score": round(counselor.match_score, 1),
                }
            )

        return (
            jsonify({"detected_tags": tags, "matches": results, "total": len(results)}),
            200,
        )

    except Exception as e:
        logging.error(f"Error in test matching: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/match/from-chat/<conversation_id>", methods=["GET"])
def match_from_chat(conversation_id):
    """
    API matching từ lịch sử chat
    """
    try:
        # Extract tags từ chat history
        tags = TagExtractor.extract_from_chat_history(conversation_id)

        if not tags:
            return (
                jsonify(
                    {"message": "No issues detected from chat history", "matches": []}
                ),
                200,
            )

        # Find matching counselors
        matches = matching_system.find_matches(problem_tags=tags)

        results = []
        for counselor in matches:
            results.append(
                {
                    "id": counselor.id,
                    "name": counselor.name,
                    "specialties": counselor.specialties,
                    "rating": counselor.rating,
                    "status": counselor.status,
                    "experience": counselor.experience,
                    "match_score": round(counselor.match_score, 1),
                }
            )

        return (
            jsonify(
                {
                    "conversation_id": conversation_id,
                    "detected_tags": tags,
                    "matches": results,
                    "total": len(results),
                }
            ),
            200,
        )

    except Exception as e:
        logging.error(f"Error in chat matching: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/counselors/all", methods=["GET"])
def get_all_counselors():
    try:
        counselors = []
        # (Giả sử bạn đang load từ matching_system hoặc file text)
        for c in matching_system.counselors:
            
            # [MỚI] Kiểm tra trạng thái thực tế từ RAM
            real_status = "online" if c.user_name in online_counselors else "offline"
            
            counselors.append({
                "id": c.user_name,
                "name": c.name,
                "specialties": c.specialties,
                "rating": c.rating,
                "status": real_status, # Ghi đè status từ file bằng status thực
                "experience": c.experience,
            })
        return jsonify({"counselors": counselors}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Thêm vào main.py ---

@app.route("/api/counselor/appointments", methods=["GET"])
@login_required
def get_counselor_appointments():
    """
    API lấy danh sách cuộc hẹn dành riêng cho Chuyên gia
    (Thay thế cho history-logs cũ để hiển thị đúng thông tin người đặt)
    """
    if not current_user.is_counselor:
        return jsonify({"error": "Unauthorized"}), 403

    appointments = []
    
    # Kiểm tra file tồn tại
    if os.path.exists(APPOINTMENTS_FILE):
        try:
            with open(APPOINTMENTS_FILE, "r", encoding="utf-8") as f:
                lines = f.readlines()
                
                # Bỏ qua header
                if len(lines) > 0 and "ApptID" in lines[0]:
                    lines = lines[1:]

                for line in lines:
                    parts = line.strip().split(";")
                    # Format: ApptID(0);UserID(1);CounselorID(2);Date(3);Time(4);Status(5)
                    if len(parts) >= 6:
                        # Chỉ lấy lịch của chính chuyên gia đang đăng nhập
                        if parts[2] == current_user.username:
                            appointments.append({
                                "id": parts[0],
                                "student_name": parts[1], # UserID của sinh viên
                                "date": parts[3],
                                "time": parts[4],
                                "status": parts[5]
                            })
                            
            # Sắp xếp: Mới nhất lên đầu (theo ngày + giờ)
            appointments.sort(key=lambda x: f"{x['date']} {x['time']}", reverse=True)
            
            return jsonify({"appointments": appointments}), 200

        except Exception as e:
            logging.error(f"Lỗi đọc file appointments: {e}")
            return jsonify({"appointments": []}), 500
             
    # Nếu chưa có file thì trả về rỗng
    return jsonify({"appointments": []}), 200

    # Sắp xếp: Ngày giờ mới nhất lên đầu
    history.sort(key=lambda x: f"{x['date']} {x['time']}", reverse=True)

    return jsonify({"appointments": history}), 200

@app.route("/api/user/chat-partners", methods=["GET"])
@login_required
def get_chat_partners():
    """
    API lấy danh sách chuyên gia mà User hiện tại ĐÃ TỪNG chat.
    Sử dụng hàm load_Chatted_Counselors từ MatchingSystem.
    """
    try:
        user_username = current_user.username
        
        # 1. Gọi hàm xử lý logic từ matching_system
        counselor_objects = matching_system.load_Chatted_Counselors(user_username)
        
        # 2. Serialize dữ liệu
        partners_data = []
        
        for c in counselor_objects:
            # --- [SỬA LỖI TẠI ĐÂY] ---
            # Kiểm tra trong RAM xem người này có đang online không
            # Lưu ý: c.user_name là ID dùng để định danh
            real_status = "online" if c.user_name in online_counselors else "offline"
            # -------------------------

            partners_data.append({
                "id": c.user_name,       
                "real_id": c.id,         
                "name": c.name,          
                "specialties": c.specialties,
                "rating": c.rating,
                "status": real_status,   # <--- Dùng real_status thay vì c.status
                "experience": c.experience
            })
            
        return jsonify({"counselors": partners_data}), 200

    except Exception as e:
        logging.error(f"Error getting chat partners: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/register_page.html")
def register_page():
    return render_template("register_page.html")


@app.route("/login_page.html")
def login_page():
    return render_template("login_page.html")


# --- API MỚI CHO VIỆC XÁC THỰC CỐ VẤN ---


@app.route("/verify_counselor", methods=["GET"])
@login_required  # Yêu cầu đăng nhập để thấy trang này
def verify_counselor_page():
    """Hiển thị trang HTML cho form upload"""
    return render_template("counselor_verification.html")

@app.route("/verify_counselor", methods=["POST"])
@login_required 
def handle_verification_upload():
    # 1. Kiểm tra file
    if "id_card" not in request.files or "degree" not in request.files:
        return jsonify({"success": False, "message": "Thiếu tệp tin."}), 400

    id_card_file = request.files["id_card"]
    degree_file = request.files["degree"]
    
    # 2. Lấy dữ liệu text (Kinh nghiệm và Tags)
    experience = request.form.get("experience", "0")
    specialties = request.form.get("specialties", "tu_van_chung")

    if id_card_file.filename == "" or degree_file.filename == "":
        return jsonify({"success": False, "message": "Vui lòng chọn cả hai tệp."}), 400

    if not (allowed_file(id_card_file.filename) and allowed_file(degree_file.filename)):
        return jsonify({"success": False, "message": "Định dạng file không hỗ trợ."}), 400

    try:
        # 3. Lưu file ảnh
        ext1 = os.path.splitext(id_card_file.filename)[1]
        ext2 = os.path.splitext(degree_file.filename)[1]

        id_filename = secure_filename(f"{current_user.username}_id_card{ext1}")
        degree_filename = secure_filename(f"{current_user.username}_degree{ext2}")

        id_path = os.path.join(app.config["UPLOAD_FOLDER"], id_filename)
        degree_path = os.path.join(app.config["UPLOAD_FOLDER"], degree_filename)

        id_card_file.save(id_path)
        degree_file.save(degree_path)

        # 4. [MỚI] Lưu Metadata (Tags & Kinh nghiệm) vào file JSON
        # File này sẽ có tên: username_meta.json trong cùng thư mục upload
        meta_filename = f"{current_user.username}_meta.json"
        meta_path = os.path.join(app.config["UPLOAD_FOLDER"], meta_filename)
        
        meta_data = {
            "username": current_user.username,
            "experience": f"{experience} năm",
            "specialties": specialties, # Chuỗi tags phân cách bởi dấu phẩy
            "submission_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta_data, f, ensure_ascii=False, indent=4)

        logging.info(f"Đã lưu hồ sơ + metadata cho user: {current_user.username}")

        return jsonify({
            "success": True, 
            "message": "Nộp hồ sơ thành công!"
        }), 200

    except Exception as e:
        logging.error(f"Lỗi xử lý upload: {e}")
        return jsonify({"success": False, "message": "Lỗi hệ thống."}), 500


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "model": "gemini-flash-latest"})


# --- CÁC ROUTE CHO ADMIN ---


@app.route("/admin/dashboard")
@login_required
def admin_dashboard():
    # Kiểm tra quyền Admin
    if not current_user.is_admin:
        return "Access Denied: Bạn không có quyền truy cập trang này.", 403

    # Quét thư mục upload để lấy danh sách hồ sơ
    profiles = []
    if os.path.exists(app.config["UPLOAD_FOLDER"]):
        files = os.listdir(app.config["UPLOAD_FOLDER"])
        # Gom nhóm file theo username (dựa vào tên file: username_id_card.jpg)
        user_files = {}
        for f in files:
            if "_" in f:
                username = f.split("_")[0]
                if username not in user_files:
                    user_files[username] = {"id_card": None, "degree": None}

                if "id_card" in f:
                    user_files[username]["id_card"] = f
                elif "degree" in f:
                    user_files[username]["degree"] = f

        # Chuyển thành list để render
        for username, doc in user_files.items():
            profiles.append(
                {
                    "username": username,
                    "id_card": doc["id_card"],
                    "degree": doc["degree"],
                }
            )

    return render_template("admin_dashboard.html", profiles=profiles)


# Route để xem ảnh (vì thư mục upload nằm ngoài static)
@app.route("/uploads/<filename>")
@login_required
def uploaded_file(filename):
    if not current_user.is_admin:
        return "Access Denied", 403
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


# --- BOOKING SYSTEM ---

# --- Tìm và thay thế hàm này trong main.py ---

@app.route("/api/counselors/availability", methods=["GET"])
def update_availability():
    """Lấy danh sách Counselor ĐANG CÓ LỊCH TRỐNG (kèm trạng thái Online/Offline)"""
    
    # 1. Lấy tất cả counselor có lịch trong tương lai
    active_counselors_with_schedule = set()
    today = datetime.now().strftime("%Y-%m-%d")

    if os.path.exists(AVAILABILITY_FILE):
        with open(AVAILABILITY_FILE, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split(";")
                # Check ngày >= hôm nay
                if len(parts) >= 3 and parts[1] >= today:
                    active_counselors_with_schedule.add(parts[0])  # Username

    # 2. Lấy thông tin chi tiết và CHECK ONLINE
    results = []
    if os.path.exists(COUNSELOR_FILE):
        with open(COUNSELOR_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()[1:]
            for line in lines:
                parts = line.strip().split(";")
                
                # Username ở cột 1. Kiểm tra xem có lịch rảnh không
                if len(parts) >= 10 and parts[1] in active_counselors_with_schedule and parts[9].strip().lower() == "yes":
                    
                    # [MỚI] Kiểm tra trạng thái thực tế từ RAM (online_counselors)
                    # Biến online_counselors đã được khai báo toàn cục ở phần SocketIO
                    real_status = "online" if parts[1] in online_counselors else "offline"

                    results.append({
                        "id": parts[1],
                        "username": parts[1], 
                        "name": parts[2],
                        "specialties": parts[5],
                        "rating": parts[6],
                        "status": real_status, # Trả về status thực tế
                    })

    return jsonify({"counselors": results}), 200


@app.route("/api/counselor/history-logs", methods=["GET"])
@login_required
def get_availability_logs():
    if not current_user.is_counselor:
        return jsonify({"error": "Unauthorized"}), 403

    logs = []

    # Kiểm tra file tồn tại chưa
    if not os.path.exists(AVAILABILITY_LOGS_FILE):
        return jsonify({"logs": []}), 200  # Trả về mảng rỗng ngay nếu chưa có file

    try:
        with open(AVAILABILITY_LOGS_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()

            # Bỏ qua dòng header (dòng đầu tiên)
            if len(lines) > 0 and "LogID" in lines[0]:
                lines = lines[1:]

            for line in lines:
                line = line.strip()
                if not line:
                    continue  # Bỏ qua dòng trống

                parts = line.split(";")

                # Cấu trúc chuẩn: LogID;Username;ActionTime;TargetDate;Slots
                # Cần ít nhất 5 phần tử
                if len(parts) >= 5 and parts[1] == current_user.username:
                    logs.append(
                        {
                            "log_id": parts[0],
                            "action_time": parts[2],
                            "target_date": parts[3],
                            "slots": parts[4].split(",") if parts[4] else [],
                        }
                    )

        # Sắp xếp: Mới nhất lên đầu
        logs.sort(key=lambda x: x["action_time"], reverse=True)

        return jsonify({"logs": logs}), 200

    except Exception as e:
        logging.error(f"Lỗi đọc log: {e}")
        return jsonify({"error": "Lỗi server khi đọc log"}), 500

@app.route("/api/booking/check-existing", methods=["GET"])
@login_required
def check_existing_booking():
    """Kiểm tra xem User này đã có lịch hẹn nào confirmed chưa"""
    existing_appt = None
    # 1. Kiểm tra file tồn tại chưa. Nếu chưa -> Trả về None luôn (Không lỗi)
    if not os.path.exists(APPOINTMENTS_FILE):
        return jsonify({"existing": None}), 200

    try:
        with open(APPOINTMENTS_FILE, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split(";")
                # Cấu trúc: ApptID;UserID;CounselorUsername;Date;Time;Status
                # Kiểm tra đủ độ dài và đúng user
                if (
                    len(parts) >= 6
                    and parts[1] == current_user.username
                    and parts[5] == "confirmed"
                ):
                    existing_appt = {
                        "id": parts[0],
                        "counselor": parts[2],
                        "date": parts[3],
                        "time": parts[4],
                    }
                    break

        return jsonify({"existing": existing_appt}), 200

    except Exception as e:
        logging.error(f"Lỗi đọc file appointment: {e}")
        # Trả về None thay vì lỗi 500 để App không bị crash
        return jsonify({"existing": None}), 200

@app.route("/api/booking/cancel", methods=["POST"])
@login_required
def cancel_booking():
    """Hủy lịch hẹn (Cho phép cả Sinh viên và Chuyên gia hủy)"""
    data = request.get_json()
    if not data or "id" not in data:
        return jsonify({"error": "Thiếu ID lịch hẹn"}), 400

    appt_id = data.get("id")
    lines = []
    found = False

    # Đọc file hiện tại
    if os.path.exists(APPOINTMENTS_FILE):
        with open(APPOINTMENTS_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()

    new_lines = []
    for line in lines:
        parts = line.strip().split(";")
        # Cấu trúc: ApptID;UserID;CounselorID;Date;Time;Status
        if len(parts) >= 6 and parts[0] == appt_id:
            # SỬA LỖI TẠI ĐÂY:
            # Kiểm tra nếu người dùng hiện tại là Sinh viên (cột 1) HOẶC là Chuyên gia (cột 2)
            if parts[1] == current_user.username or parts[2] == current_user.username:
                # Đổi trạng thái thành cancelled
                parts[5] = "cancelled"
                new_lines.append(";".join(parts) + "\n")
                found = True
            else:
                # Tìm thấy ID nhưng người dùng không có quyền hủy (không phải chủ lịch hẹn)
                new_lines.append(line) 
        else:
            # Không phải dòng cần tìm, giữ nguyên
            new_lines.append(line)

    if found:
        # Ghi lại file
        with open(APPOINTMENTS_FILE, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
        return jsonify({"message": "Đã hủy lịch hẹn."}), 200
    else:
        return jsonify({"error": "Không tìm thấy lịch hẹn hoặc bạn không có quyền hủy."}), 404
    
@app.route("/api/user/appointments", methods=["GET"])
@login_required
def get_user_appointments():
    """Lấy lịch sử hẹn của User (cả confirmed và cancelled)"""
    history = []

    if os.path.exists(APPOINTMENTS_FILE):
        with open(APPOINTMENTS_FILE, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split(";")
                if len(parts) >= 6 and parts[1] == current_user.username:
                    history.append(
                        {
                            "id": parts[0],
                            "counselor": parts[2],  # Username của counselor
                            "date": parts[3],
                            "time": parts[4],
                            "status": parts[5],
                        }
                    )

    # Sắp xếp mới nhất lên đầu
    history.sort(key=lambda x: f"{x['date']} {x['time']}", reverse=True)
    return jsonify({"appointments": history}), 200

@app.route("/api/counselors/available", methods=["GET"])
def get_available_counselors():
    """Lấy danh sách Counselor ĐANG CÓ LỊCH TRỐNG (cho tab Lịch hẹn)"""
    # 1. Lấy tất cả counselor có lịch trong tương lai
    active_counselors = set()
    today = datetime.now().strftime("%Y-%m-%d")

    if os.path.exists(AVAILABILITY_FILE):
        with open(AVAILABILITY_FILE, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split(";")
                # Check ngày >= hôm nay
                if len(parts) >= 3 and parts[1] >= today:
                    active_counselors.add(parts[0])  # Username

    # 2. Lấy thông tin chi tiết của họ
    results = []
    if os.path.exists(COUNSELOR_FILE):
        with open(COUNSELOR_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()[1:]
            for line in lines:
                parts = line.strip().split(";")
                # Username ở cột 1
                if (
                    len(parts) >= 10
                    and parts[1] in active_counselors
                    and parts[9].strip().lower() == "yes"
                ):
                    results.append(
                        {
                            "username": parts[1],  # Quan trọng: Dùng username làm ID
                            "name": parts[2],
                            "specialties": parts[5],
                            "rating": parts[6],
                            "status": parts[7],
                        }
                    )

    return jsonify({"counselors": results}), 200


# --- SỬA LOGIC LẤY LỊCH (Để hiển thị đúng những gì Counselor đã đăng ký) ---


@app.route("/api/counselor/get-dates", methods=["GET"])
def get_counselor_dates():
    """
    Lấy danh sách các ngày Counselor ĐÃ ĐĂNG KÝ RẢNH.
    Logic đúng: Quét file availability -> Lọc theo username -> Trả về list ngày.
    """
    counselor_username = request.args.get("username")
    available_dates = set()
    today = datetime.now().strftime("%Y-%m-%d")

    if not os.path.exists(AVAILABILITY_FILE):
        return jsonify({"dates": []}), 200

    try:
        with open(AVAILABILITY_FILE, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split(";")
                # Cấu trúc: Username;Date;Slots
                if len(parts) >= 3 and parts[0] == counselor_username:
                    # Chỉ lấy ngày tương lai hoặc hôm nay
                    if parts[1] >= today:
                        available_dates.add(parts[1])
        # Sắp xếp ngày tăng dần để hiển thị đẹp
        sorted_dates = sorted(list(available_dates))
        return jsonify({"dates": sorted_dates}), 200
    except Exception as e:
        logging.error(f"Lỗi lấy ngày: {e}")
        return jsonify({"dates": []}), 500

@app.route("/api/counselor/get-slots", methods=["GET"])
def get_counselor_slots():
    """
    Lấy giờ rảnh của Counselor trong ngày cụ thể (Đã trừ giờ bị đặt).
    """
    counselor_username = request.args.get("username")
    date = request.args.get("date")
    if not counselor_username or not date:
        return jsonify({"slots": []}), 400

    all_slots = []
    booked_info = {}

    try:
        # 1. Lấy slot gốc từ file availability (Của Counselor)
        if os.path.exists(AVAILABILITY_FILE):
            with open(AVAILABILITY_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    parts = line.strip().split(";")
                    if (
                        len(parts) >= 3
                        and parts[0] == counselor_username
                        and parts[1] == date
                    ):
                        # Lấy dòng cuối cùng (cập nhật mới nhất)
                        all_slots = parts[2].split(",")

        # 2. Lấy slot đã bị đặt (từ file appointments)
        if os.path.exists(APPOINTMENTS_FILE):
            with open(APPOINTMENTS_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    parts = line.strip().split(";")
                    # Cấu trúc: ApptID;UserID;CounselorID;Date;Time;Status
                    if len(parts) >= 6:
                        # Chỉ chặn nếu đúng Counselor, đúng ngày và trạng thái 'confirmed'
                        if (
                            parts[2] == counselor_username
                            and parts[3] == date
                            and parts[5].strip() == "confirmed"):
    
                            time_slot = parts[4]
                            student_id = parts[1]
                            booked_info[time_slot] = student_id # Lưu tên SV vào giờ đó

        return jsonify({
        "slots": all_slots,   # Những giờ Counselor đã đánh dấu rảnh
        "booked": booked_info # Những giờ đã bị User đặt mất
        }), 200

    except Exception as e:
        logging.error(f"Lỗi lấy slot: {e}")
        return jsonify({"slots": [], "booked": {}}), 500


# --- SỬA LOGIC GHI FILE (Khắc phục lỗi không lưu được) ---


@app.route("/api/booking/book", methods=["POST"])
@login_required
def book_appointment():
    data = request.get_json()
    counselor_username = data.get("counselor_username")
    date = data.get("date")
    time = data.get("time")
    if not counselor_username or not date or not time:
        return jsonify({"message": "Thiếu thông tin"}), 400

    try:
        # Tạo file và header nếu chưa có
        if not os.path.exists(APPOINTMENTS_FILE):
            with open(APPOINTMENTS_FILE, "w", encoding="utf-8") as f:
                f.write("ApptID;UserID;CounselorID;Date;Time;Status\n")

        appt_id = str(uuid.uuid4())[:8]

        # QUAN TRỌNG: Mở file với encoding='utf-8' và mode 'a' (append)
        with open(APPOINTMENTS_FILE, "a", encoding="utf-8") as f:
            # Đảm bảo xuống dòng (\n) ở cuối
            line = f"{appt_id};{current_user.username};{counselor_username};{date};{time};confirmed\n"
            f.write(line)
            
            socketio.emit('booking_confirmed', {
            'counselor_username': counselor_username,
            'date': date,
            'time': time
        })
        return jsonify({"message": "OK", "id": appt_id}), 200
    except Exception as e:
        logging.error(f"Lỗi ghi file: {e}")
        return jsonify({"message": "Lỗi server"}), 500


# --- TRONG FILE app.py ---


# API Route (Giữ nguyên)
@app.route("/api/chat/check-expert-status")
def check_expert_status():
    username = request.args.get("username")
    # TODO: Cần có logic để lấy tên thật (Full Name) từ username
    # user = User.query.filter_by(username=username).first()
    # expert_name = user.full_name if user else username
    expert_name = f"TS. {username}"  # Tạm thời

    # TODO: Logic kiểm tra online (ví dụ: CSDL hoặc 1 danh sách)
    is_online = True
    if is_online:
        return jsonify({"status": "online", "expert_name": expert_name})
    else:
        return jsonify({"status": "offline"})


# --- CÁC HÀM XỬ LÝ SOCKET ĐÃ KHÔI PHỤC LOGIC ROLE ---


# --- [TÌM VÀ THAY THẾ ĐOẠN CUỐI CỦA main.py] ---

# Map để biết socket_id này thuộc về user nào: {'sid_123': 'nvan'}
# Dùng để xử lý khi disconnect (biết ai vừa thoát)
socket_id_to_user = {}

@socketio.on('connect')
def handle_connect():
    # Lấy socket id của kết nối hiện tại
    sid = request.sid
    print(f"⚡ Kết nối mới: {sid}")

    if current_user.is_authenticated:
        username = current_user.username
        
        # 1. Lưu ánh xạ SID -> Username
        socket_id_to_user[sid] = username

        # 2. Nếu là Chuyên gia -> Xử lý trạng thái Online
        is_counselor = getattr(current_user, 'is_counselor', False)
        
        if is_counselor:
            # Thêm vào danh sách online
            online_counselors.add(username)
            
            print(f"🟢 CHUYÊN GIA ONLINE: {username} (SID: {sid})")
            
            # Bắn tín hiệu cho TOÀN BỘ client biết
            emit('expert_status_change', {
                'username': username,
                'status': 'online'
            }, broadcast=True)
        else:
            print(f"👤 User connected: {username}")


@socketio.on("counselor_join_room")
def handle_counselor_join(data):
    if "role" not in session or session["role"] != "counselor":
        return False

    username = session["username"]
    room = data["room"]
    
    join_room(room)
    
    # --- [MỚI] Đánh dấu Online ---
    online_counselors.add(username)
    socket_id_to_user[request.sid] = username
    
    # Bắn sự kiện cho TOÀN BỘ client biết ông này vừa Online
    emit("expert_status_change", {"username": username, "status": "online"}, broadcast=True)
    logging.info(f"Counselor {username} is ONLINE")
    # -----------------------------

    # (Giữ nguyên logic load lịch sử cũ của bạn)
    try:
        if os.path.exists(CHAT_DB_FILE):
            with open(CHAT_DB_FILE, 'r', encoding='utf-8') as f:
                all_history = json.load(f)
                my_room_history = [msg for msg in all_history if msg.get('room') == username]
                emit('load_history', my_room_history, to=request.sid)
    except Exception:
        pass
    
    emit("receive_message", {"text": "Hệ thống đã kết nối.", "sender_type": "system"}, to=request.sid)


@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    
    # 1. Tìm xem ai vừa thoát dựa trên SID
    username = socket_id_to_user.get(sid)
    
    if username:
        # Xóa SID này khỏi map
        del socket_id_to_user[sid]
        print(f"❌ Ngắt kết nối: {username} (SID: {sid})")

        # 2. Kiểm tra xem user này còn kết nối nào khác không? (Mở nhiều tab)
        # Nếu user vẫn còn sid khác trong socket_id_to_user -> Vẫn tính là Online
        user_still_connected = False
        if username in socket_id_to_user.values():
            user_still_connected = True
        
        # 3. Nếu thực sự đã thoát hết tab -> Báo Offline
        if not user_still_connected:
            # Nếu là chuyên gia thì xóa khỏi danh sách và báo offline
            if username in online_counselors:
                online_counselors.remove(username)
                
                print(f"🔴 CHUYÊN GIA OFFLINE HOÀN TOÀN: {username}")
                
                # Bắn tín hiệu Offline
                emit('expert_status_change', {
                    'username': username,
                    'status': 'offline'
                }, broadcast=True)

# Khi CHUYÊN GIA từ chối chat
@socketio.on("reject_chat")
def handle_reject_chat(data):
    if "role" not in session or session["role"] != "counselor":
        return False

    room = data["room"]
    print(f"--- HOST ĐÃ TỪ CHỐI PHÒNG: {room} ---")

    emit(
        "receive_message",
        {
            "text": "Chuyên gia hiện đang bận và không thể kết nối. Vui lòng đặt lịch hẹn.",
            "sender_type": "system",
        },
        to=room,
    )


# Khi NGƯỜI DÙNG đóng cửa sổ chat
@socketio.on("leave_room")
def handle_leave_room(data):
    if "user_id" not in session or "role" not in session:
        return False

    room = data["room"]
    username = session.get("username", "User")

    leave_room(room)
    print(f"User {username} đã rời phòng: {room}")

    emit(
        "receive_message",
        {"text": f"Người dùng {username} đã rời đi.", "sender_type": "system"},
        to=room,
        skip_sid=request.sid,
    )

@app.route("/user/chat")
@login_required
def user_chat_page():
    """
    Route để hiển thị trang chat riêng cho User (Giao diện Messenger)
    """
    # Nếu là counselor thì chặn lại (hoặc chuyển hướng sang dashboard của họ)
    if current_user.is_counselor:
        return "Trang này chỉ dành cho sinh viên. Vui lòng dùng Dashboard chuyên gia.", 403
        
    return render_template("user_chat.html")


# --- Thêm vào phần import ---
import json
from datetime import datetime

# --- CẤU HÌNH FILE LƯU CHAT ---
CHAT_DB_FILE = 'chat_history.json'

# 1. Hàm hỗ trợ: Đọc lịch sử từ file
def load_chat_history():
    if not os.path.exists(CHAT_DB_FILE):
        return []
    try:
        with open(CHAT_DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        print(f"❌ LỖI KHÁC KHI ĐỌC HISTORY: {e}")
        return []

# 2. Hàm hỗ trợ: Lưu tin nhắn mới
def save_chat_message(room, sender_id, sender_type, text, target_student_id=None):
    with file_lock:  # <--- Thêm dòng này để khóa file khi đang ghi
        history = load_chat_history()
        
        new_msg = {
            "room": room,
            "sender_id": sender_id,
            "sender_type": sender_type,
            "text": text,
            "target_student_id": target_student_id,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        history.append(new_msg)
        
        with open(CHAT_DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=4, ensure_ascii=False)
            
        return new_msg

# 3. Hàm hỗ trợ: Lọc lịch sử cho User (Chỉ lấy tin của User này với Expert này)
def get_history_for_user(expert_username, student_username):
    all_history = load_chat_history()
    filtered = []
    
    for msg in all_history:
        # Chỉ xét tin nhắn trong phòng của Expert này
        if msg.get('room') == expert_username:
            # Case 1: User gửi
            if msg.get('sender_type') == 'user' and msg.get('sender_id') == student_username:
                filtered.append(msg)
            # Case 2: Expert gửi CHO User này
            elif msg.get('sender_type') == 'counselor' and msg.get('target_student_id') == student_username:
                filtered.append(msg)
                
    return filtered

# ---------------------------------------------------------
# --- CẬP NHẬT CÁC SỰ KIỆN SOCKET (Thay thế code cũ) ---
# ---------------------------------------------------------

@socketio.on("join_expert_chat")
def handle_join_room(data):
    # (Giữ nguyên logic kiểm tra session cũ...)
    if "role" not in session or session["role"] != "user":
        return False

    room = data["room"] # Expert username
    user_username = session.get("username")

    join_room(room)
    
    # [MỚI] Tải và gửi lại lịch sử chat riêng của User này
    history = get_history_for_user(room, user_username)
    emit('load_history', history, to=request.sid) # Chỉ gửi cho người mới vào
    
    # (Giữ nguyên các thông báo system...)
    emit("receive_message", {"text": "Đã kết nối, vui lòng chờ chuyên gia chấp nhận.", "sender_type": "system"}, to=request.sid)
    emit("show_chat_notification", {"user_id": session["user_id"], "username": user_username}, to=room, skip_sid=request.sid)


@socketio.on("send_expert_message")
def handle_send_message(data):
    if "user_id" not in session:
        return False

    room = data["room"]
    message = data["message"]
    sender_type = session.get("role", "user")
    sender_username = session.get("username")
    target_student_id = data.get('target_student_id', None)

    # [MỚI] Lưu vào file JSON
    saved_msg = save_chat_message(room, sender_username, sender_type, message, target_student_id)

    print(f"--- TIN NHẮN: {message} (Từ: {sender_username} -> Phòng: {room}) ---")

    # Gửi cho mọi người trong phòng (Client sẽ tự lọc hiển thị)
    emit("receive_message", saved_msg, to=room)


# --- Thêm vào main.py (khu vực Admin Routes) ---
def delete_user_files(username):
    try:
        if not os.path.exists(UPLOAD_FOLDER):
            return

        files = os.listdir(UPLOAD_FOLDER)
        for f in files:
            # Xóa tất cả file bắt đầu bằng username_ (bao gồm ảnh và json)
            if f.startswith(f"{username}_"):
                file_path = os.path.join(UPLOAD_FOLDER, f)
                os.remove(file_path)
                logging.info(f"Deleted file: {file_path}")
    except Exception as e:
        logging.error(f"Error deleting files for {username}: {e}")


# --- Thêm mới Route Reject (Từ chối) ---
@app.route("/api/admin/reject-expert", methods=["POST"])
@login_required
def reject_expert():
    if not current_user.is_admin:
        return jsonify({"message": "Access Denied"}), 403

    data = request.get_json()
    username = data.get("username")
    reason = data.get("reason", "Không đạt yêu cầu")

    if not username:
        return jsonify({"message": "Missing username"}), 400

    try:
        # 1. Xóa ảnh bằng chứng
        delete_user_files(username)

        # 2. (Tùy chọn) Có thể gửi email thông báo lý do ở đây
        logging.info(f"Rejected expert {username}. Reason: {reason}")

        # 3. Lưu ý: User vẫn giữ nguyên trong user_accounts.txt
        # Họ có thể nộp lại hồ sơ sau (upload file mới)

        return jsonify({"message": f"Đã từ chối {username} và xóa hồ sơ ảnh."}), 200

    except Exception as e:
        logging.error(f"Error rejecting expert: {e}")
        return jsonify({"message": "Lỗi server"}), 500

@app.route("/api/admin/approve-expert", methods=["POST"])
@login_required
def approve_expert():
    if not current_user.is_admin:
        return jsonify({"message": "Bạn không có quyền thực hiện thao tác này"}), 403

    data = request.get_json()
    username_to_approve = data.get("username")

    if not username_to_approve:
        return jsonify({"message": "Thiếu username"}), 400

    target_user_data = None
    remaining_users = []

    try:
        if os.path.exists(USER_FILE):
            with open(USER_FILE, "r", encoding="utf-8") as f:
                lines = f.readlines()
                
            for line in lines:
                parts = line.strip().split(";")
                if len(parts) >= 3 and parts[0] == username_to_approve:
                    target_user_data = {
                        "username": parts[0],
                        "email": parts[1],
                        "password_hash": parts[2]
                    }
                else:
                    remaining_users.append(line)
                    
        if not target_user_data:
            return jsonify({"message": "Không tìm thấy người dùng này trong danh sách User"}), 404

        new_counselor_id = f"C{str(uuid.uuid4())[:4].upper()}"
    
        experience_val = "Chưa cập nhật"
        specialties_val = "Tu_van_chung"
        
        meta_filename = f"{username_to_approve}_meta.json"
        meta_path = os.path.join(app.config["UPLOAD_FOLDER"], meta_filename)
        
        if os.path.exists(meta_path):
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                    experience_val = meta.get("experience", "Chưa cập nhật")
                    specialties_val = meta.get("specialties", "Tu_van_chung")
            except Exception:
                pass # Nếu lỗi đọc file meta thì dùng mặc định

            name_placeholder = f"Chuyên gia {target_user_data['username']}"
            rating_default = "0"
            status_default = "offline"
            verified_status = "yes"

            new_counselor_line = (
                f"{new_counselor_id};"
                f"{target_user_data['username']};"
                f"{name_placeholder};"
                f"{target_user_data['email']};"
                f"{target_user_data['password_hash']};"
                f"{specialties_val};" 
                f"{rating_default};"
                f"{status_default};"
                f"{experience_val};"
                f"{verified_status}\n"
            )

        move_verification_files_to_paperworks(username_to_approve)
        if not os.path.exists(COUNSELOR_FILE):
            with open(COUNSELOR_FILE, "w", encoding="utf-8") as f:
                f.write("CounselorID;Username;Name;Email;PasswordHash;Specialties;Rating;Status;Experience;verified\n")

        with open(COUNSELOR_FILE, "a", encoding="utf-8") as f:
            f.write(new_counselor_line)

        with open(USER_FILE, "w", encoding="utf-8") as f:
            f.writelines(remaining_users)

        return jsonify({"message": f"Đã duyệt {username_to_approve} thành chuyên gia!"}), 200

    except Exception as e:
        logging.error(f"Lỗi khi duyệt chuyên gia: {e}")
        return jsonify({"message": "Lỗi server khi xử lý file"}), 500
    
# API để xoá quyền chuyên gia (Admin only)
@app.route("/api/admin/stats", methods=["GET"])
@login_required
def get_admin_stats():
    if not current_user.is_admin:
        return jsonify({"error": "Forbidden"}), 403
    
    users = []
    counselors = []
    
    # Đọc User
    if os.path.exists(USER_FILE):
        with open(USER_FILE, "r", encoding="utf-8") as f:
            for line in f.readlines()[1:]:
                parts = line.strip().split(";")
                if len(parts) >= 2:
                    users.append({"username": parts[0], "email": parts[1]})
                    
    # Đọc Counselor
    if os.path.exists(COUNSELOR_FILE):
        with open(COUNSELOR_FILE, "r", encoding="utf-8") as f:
            for line in f.readlines()[1:]:
                parts = line.strip().split(";")
                if len(parts) >= 10:
                    counselors.append({
                        "username": parts[1],
                        "name": parts[2],
                        "email": parts[3],
                        "specialties": parts[5]
                    })
                    
    return jsonify({"users": users, "counselors": counselors})

@app.route("/api/admin/revoke-counselor", methods=["POST"])
@login_required
def revoke_counselor():
    if not current_user.is_admin:
        return jsonify({"message": "Forbidden"}), 403
        
    data = request.get_json()
    username = data.get("username")
    
    target_counselor = None
    remaining_counselors = []
    
    # 1. Tìm và xóa khỏi file Counselor
    if os.path.exists(COUNSELOR_FILE):
        with open(COUNSELOR_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()
            header = lines[0]
            for line in lines[1:]:
                parts = line.strip().split(";")
                if parts[1] == username:
                    target_counselor = {
                        "username": parts[1],
                        "email": parts[3],
                        "password_hash": parts[4]
                    }
                else:
                    remaining_counselors.append(line)
                    
    if not target_counselor:
        return jsonify({"message": "Không tìm thấy chuyên gia"}), 404

    # 2. Ghi lại file Counselor
    with open(COUNSELOR_FILE, "w", encoding="utf-8") as f:
        f.write(header)
        f.writelines(remaining_counselors)

    # 3. Thêm vào file User (Duy trì format 3 cột: Username;Email;PasswordHash)
    with open(USER_FILE, "a", encoding="utf-8") as f:
        f.write(f"{target_counselor['username']};{target_counselor['email']};{target_counselor['password_hash']}\n")
        
    return jsonify({"message": f"Đã hủy quyền chuyên gia của {username}"})


@app.route('/experts')
def all_experts():
    return render_template('all_experts.html')

# API để truy cập ảnh trong thư mục paperworks
@app.route("/paperworks/<filename>")
def get_paperwork_image(filename):
    return send_from_directory(app.config["PAPERWORKS_FOLDER"], filename)

# API lấy thông tin chi tiết chuyên gia (bao gồm danh sách ảnh bằng cấp)
@app.route("/api/counselor/<username>/profile", methods=["GET"])
def get_counselor_public_profile(username):
    profile_data = {}
    
    # 1. Tìm thông tin trong file text
    found = False
    if os.path.exists(COUNSELOR_FILE):
        with open(COUNSELOR_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()[1:]
            for line in lines:
                parts = line.strip().split(";")
                if len(parts) >= 10 and parts[1] == username:
                    profile_data = {
                        "id": parts[0],
                        "username": parts[1],
                        "name": parts[2],
                        "email": parts[3],
                        "specialties": parts[5],
                        "rating": parts[6],
                        "experience": parts[8],
                    }
                    found = True
                    break
    
    if not found:
        return jsonify({"error": "Counselor not found"}), 404

    # 2. Quét thư mục paperworks để lấy ảnh bằng cấp của user này
    images = []
    if os.path.exists(PAPERWORKS_FOLDER):
        files = os.listdir(PAPERWORKS_FOLDER)
        for f in files:
            # Lọc file bắt đầu bằng username và là ảnh
            if f.startswith(f"{username}_degree") and f.lower().endswith(('.png', '.jpg', '.jpeg')):
                images.append(f)
    
    profile_data["cert_images"] = images
    return jsonify(profile_data), 200

@app.route('/api/user/latest-test-result', methods=['GET'])
@login_required
def get_user_latest_test_result():
    TEST_RESULTS_FILE = "test_results.txt"
    
    if not os.path.exists(TEST_RESULTS_FILE):
        return jsonify({"found": False, "tags": []}), 200

    try:
        # Đọc file
        with open(TEST_RESULTS_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
            # Duyệt ngược từ cuối lên đầu để lấy bài mới nhất
            for line in reversed(lines):
                parts = line.strip().split(";")
                
                # Cấu trúc dữ liệu: [0]Time; [1]User; [2]Scores; [3]Tags; [4]Answers
                if len(parts) >= 4:
                    log_username = parts[1] # Cột 1 là Username
                    
                    if log_username == current_user.username:
                        date_time = parts[0] # Cột 0 là Thời gian
                        tags_str = parts[3]  # Cột 3 là Tags (tram_cam,lo_au...)
                        
                        # Xử lý tags
                        tags_list = []
                        if tags_str and tags_str.lower() != "none":
                            tags_list = tags_str.split(',')
                            
                        return jsonify({
                            "found": True,
                            "date": date_time,
                            "tags": tags_list
                        }), 200
        
        # Nếu chạy hết vòng lặp mà không thấy
        return jsonify({"found": False}), 200

    except Exception as e:
        logging.error(f"Lỗi đọc lịch sử test: {e}")
        return jsonify({"error": "Lỗi server"}), 500
    
# --- [THÊM VÀO main.py] ---
# --- HỆ THỐNG ĐÁNH GIÁ (EVALUATION SYSTEM) ---

EVALUATIONS_FILE = "evaluations.txt"

@app.route("/api/counselor/write-evaluation", methods=["POST"])
@login_required
def write_evaluation():
    """Chuyên gia viết đánh giá cho sinh viên"""
    if not current_user.is_counselor:
        return jsonify({"message": "Bạn không có quyền thực hiện thao tác này"}), 403

    data = request.get_json()
    student_username = data.get("student_username")
    content = data.get("content")

    if not student_username or not content:
        return jsonify({"message": "Vui lòng nhập tên sinh viên và nội dung"}), 400

    try:
        # Tạo file nếu chưa có
        if not os.path.exists(EVALUATIONS_FILE):
            with open(EVALUATIONS_FILE, "w", encoding="utf-8") as f:
                f.write("EvalID;StudentUser;CounselorUser;Content;Date\n")

        eval_id = str(uuid.uuid4())[:8]
        date_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        
        # Xóa ký tự xuống dòng trong content để tránh lỗi file
        clean_content = content.replace("\n", " ").replace(";", ",")

        line = f"{eval_id};{student_username};{current_user.username};{clean_content};{date_str}\n"

        with open(EVALUATIONS_FILE, "a", encoding="utf-8") as f:
            f.write(line)

        return jsonify({"message": "Đã lưu đánh giá thành công!"}), 200

    except Exception as e:
        logging.error(f"Lỗi lưu đánh giá: {e}")
        return jsonify({"message": "Lỗi server"}), 500

@app.route("/api/user/evaluations", methods=["GET"])
@login_required
def get_evaluations():
    """Lấy danh sách đánh giá (User xem của mình, Counselor xem các bài đã viết)"""
    results = []
    
    if not os.path.exists(EVALUATIONS_FILE):
        return jsonify({"evaluations": []}), 200

    try:
        with open(EVALUATIONS_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()[1:] # Bỏ header

        for line in lines:
            parts = line.strip().split(";")
            if len(parts) >= 5:
                # Nếu là User thường: Lấy bài viết VỀ mình (cột 1)
                if not current_user.is_counselor and parts[1] == current_user.username:
                    results.append({
                        "id": parts[0],
                        "author": parts[2], # Tên chuyên gia
                        "content": parts[3],
                        "date": parts[4]
                    })
                # Nếu là Counselor: Lấy bài viết DO mình viết (cột 2)
                elif current_user.is_counselor and parts[2] == current_user.username:
                    results.append({
                        "id": parts[0],
                        "student": parts[1], # Tên sinh viên
                        "content": parts[3],
                        "date": parts[4]
                    })
        
        # Sắp xếp mới nhất
        results.sort(key=lambda x: x['date'], reverse=True)
        return jsonify({"evaluations": results}), 200

    except Exception as e:
        logging.error(f"Lỗi đọc file đánh giá: {e}")
        return jsonify({"message": "Lỗi server"}), 500
    
@app.route("/articles")
def articles_page():
    return render_template("articles.html")

if __name__ == "__main__":
    start_file_watcher()
    socketio.run(app)
    print("🚀 Starting Flask Server with REAL Zoom API")
    print("🔍 Checking credentials...")
    if not all([ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET]):
        print("❌ MISSING Zoom credentials in .env file!")
        print("   Please make sure you have:")
        print("   - ZOOM_ACCOUNT_ID=your_account_id")
        print("   - ZOOM_CLIENT_ID=your_client_id")
        print("   - ZOOM_CLIENT_SECRET=your_client_secret")
    else:
        print("✅ Zoom credentials loaded successfully")

    print("📝 Visit: http://127.0.0.1:5000")
    print("🔧 Check credentials: http://127.0.0.1:5000/check_credentials")

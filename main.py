import google.generativeai as genai
from flask_bcrypt import Bcrypt
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, logout_user, current_user, login_required
from flask import send_from_directory
import webbrowser
import threading
import os
import logging
import uuid # Thư viện để tạo ID duy nhất cho phiên chat
from dotenv import load_dotenv
from flask import render_template

# Cấu hình cơ bản
load_dotenv()
logging.basicConfig(level=logging.INFO)

# --- Cấu hình Gemini ---
load_dotenv()
api_key_value = os.getenv("GEMINI_API_KEY")
if not api_key_value:
    logging.error("Lỗi: Không tìm thấy GEMINI_API_KEY trong file .env")
else:
    genai.configure(api_key=api_key_value)

app = Flask(__name__)
# RẤT QUAN TRỌNG: Cần có Secret Key cho Flask-Login
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'mot-chuoi-bi-mat-rat-kho-doan-12345')
CORS(app)

bcrypt = Bcrypt(app) 
USER_FILE = "user_accounts.txt" # File lưu tài khoản

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
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]

# Khởi tạo model Chatbot một lần
try:
    gemini_model = genai.GenerativeModel(
        model_name="gemini-2.5-flash", 
        generation_config=GENERATION_CONFIG,
        system_instruction=SYSTEM_INSTRUCTION,
        safety_settings=SAFETY_SETTINGS
    )
    logging.info("Khởi tạo Gemini Model thành công với System Instruction.")
except Exception as e:
    logging.error(f"Lỗi nghiêm trọng khi khởi tạo Gemini Model: {e}")
    gemini_model = None

# --- Quản lý Phiên Chat (Chatbot) ---
chat_sessions = {}

def get_or_create_chat_session(conversation_id):
    if conversation_id not in chat_sessions:
        if not gemini_model:
            logging.error("Model chưa được khởi tạo, không thể tạo chat session.")
            return None
        
        logging.info(f"Tạo phiên chat mới: {conversation_id}")
        chat_sessions[conversation_id] = gemini_model.start_chat(history=[]) 
        
    return chat_sessions[conversation_id]


# --- CẤU HÌNH FLASK-LOGIN ---
login_manager = LoginManager()
login_manager.init_app(app)

# ----------------------------------------------------
# --- II. USER CLASS VÀ HÀM QUẢN LÝ NGƯỜI DÙNG ---
# ----------------------------------------------------

class User(UserMixin):
    def __init__(self, id, username, email, password_hash):
        self.id = id # trong Flask-Login, id phải là self.id
        self.username = username
        self.email = email
        self.password_hash = password_hash

    @staticmethod
    def get_by_id(user_id):
        try:
            with open(USER_FILE, "r", encoding="utf-8") as f:
                for line in f.readlines()[1:]: # Bỏ qua dòng tiêu đề
                    parts = line.strip().split(';')
                    if len(parts) == 3 and parts[0] == user_id: 
                        return User(parts[0], parts[0], parts[1], parts[2])
        except FileNotFoundError:
            # Tự động tạo file nếu chưa tồn tại
            logging.info(f"File {USER_FILE} không tìm thấy, đang tạo file mới...")
            try:
                with open(USER_FILE, "w", encoding="utf-8") as f:
                    f.write("Username;Email;PasswordHash\n")
            except Exception as e:
                logging.error(f"Không thể tạo file {USER_FILE}: {e}")
            return None
        except Exception as e:
            logging.error(f"Lỗi khi đọc file user: {e}")
            return None
        return None

    @staticmethod
    def get_by_username(username):
        """Tìm kiếm người dùng bằng Username (mà cũng là ID)."""
        return User.get_by_id(username)

    @staticmethod
    def get_by_email(email):
        try:
            with open(USER_FILE, "r", encoding="utf-8") as f:
                for line in f.readlines()[1:]:
                    parts = line.strip().split(';')
                    if len(parts) == 3 and parts[1].lower() == email.lower():
                        return User(parts[0], parts[0], parts[1], parts[2])
        except FileNotFoundError:
            logging.warn(f"{USER_FILE} không tìm thấy khi tìm email.")
            return None
        return None

@login_manager.user_loader
def load_user(user_id):
    """Callback được Flask-Login sử dụng để tải user từ session."""
    return User.get_by_id(user_id)

# ----------------------------------------------------
# --- III. CÁC API ROUTE (ĐIỂM CUỐI) ---
# ----------------------------------------------------

# --- API cho Chatbot (ĐÃ SỬA LỖI AN TOÀN) ---
@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_message = data.get("message", "").strip()
    conversation_id = data.get("conversationId")

    if not user_message or not conversation_id:
        return jsonify({"error": "Message and conversationId are required"}), 400

    if not gemini_model:
         return jsonify({"reply": "Xin lỗi, model AI chưa được khởi tạo đúng."}), 500

    try:
        chat_session = get_or_create_chat_session(conversation_id)
        if not chat_session:
            return jsonify({"reply": "Xin lỗi, không thể tạo phiên chat."}), 500

        response = chat_session.send_message(user_message)

        # Kiểm tra nếu PHẢN HỒI bị chặn
        if not response.candidates:
             return jsonify({"reply": "Xin lỗi, AI không đưa ra được phản hồi."}), 500

        if response.candidates[0].finish_reason == 'SAFETY':
            logging.warning("Phản hồi của AI bị chặn vì SAFETY.")
            return jsonify({"reply": "Xin lỗi, phản hồi của AI cho chủ đề này đã bị chặn vì lý do an toàn. Bạn có thể thử diễn đạt lại câu hỏi của mình không?"}), 200

        reply = response.text.strip() if hasattr(response, "text") and response.text else "Xin lỗi, AI chưa thể phản hồi."
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
             logging.warning(f"Yêu cầu của người dùng bị chặn: {prompt_feedback.block_reason}")
             return jsonify({"reply": "Xin lỗi, tin nhắn của bạn đã bị chặn vì lý do an toàn. Vui lòng thử lại."}), 400
        
        # Lỗi 500 chung
        return jsonify({"reply": "Xin lỗi, hệ thống AI đang gặp sự cố. Vui lòng thử lại hoặc kiểm tra server backend."}), 500

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

# --- API cho Đăng nhập ---
@app.route("/api/login", methods=["POST"])
def login_secure():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        return jsonify({"message": "Vui lòng nhập tài khoản và mật khẩu"}), 400
        
    user = User.get_by_username(username)
    if user and bcrypt.check_password_hash(user.password_hash, password):
        login_user(user, remember=True) # Tạo session
        return jsonify({"message": "Đăng nhập thành công!", "username": user.username}), 200
        
    return jsonify({"message": "Tên đăng nhập hoặc mật khẩu không đúng"}), 401

# --- API cho Đăng xuất ---
@app.route("/api/logout", methods=["POST"])
@login_required # Chỉ người đã đăng nhập mới có thể đăng xuất
def logout():
    logout_user() # Xóa session
    return jsonify({"message": "Đăng xuất thành công!"}), 200

# --- API để kiểm tra trạng thái ---
@app.route("/api/status")
def get_status():
    if current_user.is_authenticated:
        return jsonify({"logged_in": True, "username": current_user.username})
    else:
        return jsonify({"logged_in": False})

# --- Route phục vụ file HTML ---
@app.route("/")
def home():
    return render_template("index.html")

@app.route('/register_page.html')
def register_page():
    return render_template('register_page.html')

@app.route('/login_page.html')
def login_page():
    return render_template('login_page.html')

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "model": "gemini-2.5-flash"})

if __name__ == "__main__":
    app.run(debug=True, port=5000)

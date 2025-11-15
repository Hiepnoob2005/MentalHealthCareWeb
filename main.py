import google.generativeai as genai
from flask_bcrypt import Bcrypt
from flask import Flask, request, jsonify, session
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
from flask_socketio import SocketIO, emit, join_room, leave_room
import json
import datetime #xử lý quicktest dể làm problem tags
from datetime import datetime
from matching import MatchingSystem, TagExtractor #thêm dòng này cho cái tính năng matching
# ... (các import hiện có) ...
from matching import MatchingSystem, TagExtractor #thêm dòng này cho cái tính năng matching
from werkzeug.utils import secure_filename # <-- THÊM DÒNG NÀY
import uuid
from datetime import datetime
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
socketio = SocketIO(app, cors_allowed_origins="*")

# --- THÊM CẤU HÌNH UPLOAD ---
UPLOAD_FOLDER = 'verification_uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
    logging.info(f"Đã tạo thư mục {UPLOAD_FOLDER}")
# --- KẾT THÚC THÊM CẤU HÌNH UPLOAD ---

CORS(app)

CHAT_HISTORY_DIR = "chat_history"
if not os.path.exists(CHAT_HISTORY_DIR):
    os.makedirs(CHAT_HISTORY_DIR)
    logging.info(f"Đã tạo thư mục {CHAT_HISTORY_DIR}")

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
# Thêm constants cho Quick Test 
TEST_RESULTS_FILE = "test_results.txt"

# Khởi tạo model Chatbot một lần
try:
    chatbot_model = genai.GenerativeModel(
        model_name="gemini-1.0-pro", 
        generation_config=GENERATION_CONFIG,
        system_instruction=SYSTEM_INSTRUCTION,
        safety_settings=SAFETY_SETTINGS
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
        role = "Sinh viên" if msg['role'] == 'user' else "AI Hỗ trợ"
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
            safety_settings=SAFETY_SETTINGS 
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
            "symptoms": summary_data.get("symptoms", "Chưa xác định")
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
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def save_chat_history_and_summarize(conversation_id, history):
    """
    Lưu lịch sử chat VÀ gọi AI để tóm tắt.
    (Hàm này nên được chạy trong một thread riêng)
    """
    try:
        now = datetime.datetime.now()
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
            "symptoms": "Chưa xác định"
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
                     summary_data["symptoms"] = existing_data.get("symptoms", "Chưa xác định")
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
            
            "messages": messages
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
COUNSELOR_FILE = "counselor_accounts.txt" # Đảm bảo biến này đã được khai báo

class User(UserMixin):
    # Hàm khởi tạo PHẢI có is_counselor và verified
    def __init__(self, id, username, email, password_hash, is_admin=False, is_counselor=False, verified=False):
        self.id = id 
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.is_admin = is_admin
        self.is_counselor = is_counselor # <-- Dòng này thiếu nên gây lỗi
        self.verified = verified         # <-- Dòng này cũng cần thêm

    @staticmethod
    def get_by_id(user_id):
        # 1. Tìm trong Admin
        try:
            if os.path.exists(ADMIN_FILE):
                with open(ADMIN_FILE, "r", encoding="utf-8") as f:
                    for line in f.readlines()[1:]:
                        parts = line.strip().split(';')
                        if len(parts) >= 3 and parts[0] == user_id:
                            return User(parts[0], parts[0], parts[1], parts[2], is_admin=True)
        except Exception: pass

        # 2. Tìm trong Counselor (Quan trọng: Cần đọc đúng file cấu trúc mới)
        try:
            if os.path.exists(COUNSELOR_FILE):
                with open(COUNSELOR_FILE, "r", encoding="utf-8") as f:
                    for line in f.readlines()[1:]: # Bỏ qua header nếu có
                        parts = line.strip().split(';')
                        # Cấu trúc: ID(0);Username(1);Name(2);Email(3);Pass(4)...
                        if len(parts) >= 10 and parts[1] == user_id:
                            is_verified = parts[9].strip().lower() == 'yes'
                            # TRUYỀN ĐỦ THAM SỐ is_counselor VÀ verified
                            return User(parts[1], parts[1], parts[3], parts[4], is_counselor=True, verified=is_verified)
        except Exception as e:
            logging.error(f"Lỗi đọc file counselor: {e}")

        # 3. Tìm trong User thường
        try:
            with open(USER_FILE, "r", encoding="utf-8") as f:
                for line in f.readlines()[1:]:
                    parts = line.strip().split(';')
                    if len(parts) >= 3 and parts[0] == user_id: 
                        return User(parts[0], parts[0], parts[1], parts[2])
        except FileNotFoundError: pass
        
        return None

    @staticmethod
    def get_by_username(username):
        return User.get_by_id(username)

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
            "Luôn luôn": 3
        }
        
        # Câu 2: Khó khăn tập trung
        q2_mapping = {
            "Không gặp khó khăn": 0,
            "Ít khi": 1,
            "Thỉnh thoảng": 2,
            "Rất thường xuyên": 3
        }
        
        # Câu 3: Giấc ngủ
        q3_mapping = {
            "Rất tốt": 0,
            "Bình thường": 1,
            "Không tốt": 2,
            "Rất tệ, thường mất ngủ": 3
        }
        
        # Tính điểm cho từng câu
        q1_score = q1_mapping.get(answers.get('q1', ''), 0)
        q2_score = q2_mapping.get(answers.get('q2', ''), 0)
        q3_score = q3_mapping.get(answers.get('q3', ''), 0)
        
        total_score = q1_score + q2_score + q3_score
        
        # Gán problem tags dựa trên điểm từng câu
        if q1_score >= 2:
            problem_tags.extend(['stress', 'lo_au'])
        
        if q2_score >= 2:
            problem_tags.append('hoc_tap')
            
        if q3_score >= 2:
            problem_tags.append('roi_loan_giac_ngu')
            
        # Thêm tags dựa trên tổng điểm
        if total_score >= 7:
            problem_tags.append('tram_cam')  # Nguy cơ cao
        
        # Loại bỏ duplicates
        problem_tags = list(set(problem_tags))
        
        return total_score, problem_tags
    
    @staticmethod
    def save_test_result(user_id, answers, problem_tags, score):
        """Lưu kết quả test vào file"""
        try:
            # Tạo file nếu chưa tồn tại
            if not os.path.exists(TEST_RESULTS_FILE):
                with open(TEST_RESULTS_FILE, 'w', encoding='utf-8') as f:
                    f.write("UserID;TestDate;TestTime;Answers;ProblemTags;Score\n")
            
            # Chuẩn bị dữ liệu
            now = datetime.now()
            test_date = now.strftime("%Y-%m-%d")
            test_time = now.strftime("%H:%M:%S")
            answers_str = json.dumps(answers)
            tags_str = ','.join(problem_tags) if problem_tags else 'none'
            
            # Ghi vào file
            with open(TEST_RESULTS_FILE, 'a', encoding='utf-8') as f:
                f.write(f"{user_id};{test_date};{test_time};{answers_str};{tags_str};{score}\n")
            
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

        if response.candidates[0].finish_reason == 'SAFETY':
            logging.warning("Phản hồi của AI bị chặn vì SAFETY.")
            return jsonify({"reply": "Xin lỗi, phản hồi của AI cho chủ đề này đã bị chặn vì lý do an toàn. Bạn có thể thử diễn đạt lại câu hỏi của mình không?"}), 200

        reply = response.text.strip() if hasattr(response, "text") and response.text else "Xin lỗi, AI chưa thể phản hồi."
        current_history = list(chat_session.history) 
        
        # 2. Tạo và chạy thread
        save_thread = threading.Thread(
            target=save_chat_history_and_summarize, # Gọi hàm mới
            args=(conversation_id, current_history)
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

# --- CẬP NHẬT: API Đăng nhập ---
@app.route("/api/login", methods=["POST"])
def login_secure():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        return jsonify({"message": "Vui lòng nhập tài khoản và mật khẩu"}), 400
        
    user = User.get_by_id(username) # Dùng get_by_id vì nó quét cả 3 file
    
    if user and bcrypt.check_password_hash(user.password_hash, password):
        # Logic riêng cho Counselor
        if user.is_counselor and not user.verified:
            return jsonify({"message": "Tài khoản chuyên gia của bạn đang chờ Admin phê duyệt."}), 403

        # Đăng nhập bằng Flask-Login (chỉ lưu user.id)
        login_user(user, remember=True)
        
        # --- 2. THÊM CODE SỬA LỖI TẠI ĐÂY ---
        # Gán thông tin vào Flask session để Socket.IO có thể đọc được
        session['user_id'] = user.id
        session['username'] = user.username
        
        # Xác định 'role' và gán vào session
        if user.is_admin:
            session['role'] = 'admin'
        elif user.is_counselor:
            session['role'] = 'counselor'
        else:
            session['role'] = 'user'
        # --- KẾT THÚC SỬA LỖI ---
            
        return jsonify({
            "message": "Đăng nhập thành công!", 
            "username": user.username,
            "is_admin": user.is_admin,
            "is_counselor": user.is_counselor,
            "user_id": user.id
        }), 200
        
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
        user_id = current_user.username if current_user.is_authenticated else "anonymous"
        
        # Lưu kết quả
        QuickTestProcessor.save_test_result(user_id, answers, problem_tags, score)
        
        # Lưu problem_tags vào session để sử dụng sau
        from flask import session
        session['last_test_tags'] = problem_tags
        session['last_test_score'] = score
        
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
        
        return jsonify({
            "success": True,
            "score": score,
            "level": level,
            "message": message,
            "problem_tags": problem_tags,
            "should_find_counselor": len(problem_tags) > 0
        }), 200
        
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
            with open(TEST_RESULTS_FILE, 'r', encoding='utf-8') as f:
                lines = f.readlines()[1:]  # Skip header
                
                for line in lines:
                    parts = line.strip().split(';')
                    if len(parts) >= 6 and parts[0] == user_id:
                        history.append({
                            "date": parts[1],
                            "time": parts[2],
                            "score": int(parts[5]),
                            "tags": parts[4].split(',') if parts[4] != 'none' else []
                        })
        
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
    only_online = data.get("only_online", True)
    min_rating = data.get("min_rating", 0.0)
    
    if not problem_tags:
        return jsonify({"error": "problem_tags is required"}), 400
    
    try:
        matches = matching_system.find_matches(
            problem_tags=problem_tags,
            only_online=only_online,
            min_rating=min_rating
        )
        
        # Convert to JSON-serializable format
        results = []
        for counselor in matches:
            results.append({
                "id": counselor.id,
                "name": counselor.name,
                "specialties": counselor.specialties,
                "rating": counselor.rating,
                "status": counselor.status,
                "experience": counselor.experience,
                "match_score": round(counselor.match_score, 1)
            })
            
        return jsonify({
            "matches": results,
            "total": len(results),
            "search_tags": problem_tags
        }), 200
        
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
            return jsonify({
                "message": "No issues detected from test results",
                "matches": []
            }), 200
        
        # Find matching counselors
        matches = matching_system.find_matches(problem_tags=tags)
        
        results = []
        for counselor in matches:
            results.append({
                "id": counselor.id,
                "name": counselor.name,
                "specialties": counselor.specialties,
                "rating": counselor.rating,
                "status": counselor.status,
                "experience": counselor.experience,
                "match_score": round(counselor.match_score, 1)
            })
            
        return jsonify({
            "detected_tags": tags,
            "matches": results,
            "total": len(results)
        }), 200
        
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
            return jsonify({
                "message": "No issues detected from chat history",
                "matches": []
            }), 200
        
        # Find matching counselors
        matches = matching_system.find_matches(problem_tags=tags)
        
        results = []
        for counselor in matches:
            results.append({
                "id": counselor.id,
                "name": counselor.name,
                "specialties": counselor.specialties,
                "rating": counselor.rating,
                "status": counselor.status,
                "experience": counselor.experience,
                "match_score": round(counselor.match_score, 1)
            })
            
        return jsonify({
            "conversation_id": conversation_id,
            "detected_tags": tags,
            "matches": results,
            "total": len(results)
        }), 200
        
    except Exception as e:
        logging.error(f"Error in chat matching: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/api/counselors/all", methods=["GET"])
def get_all_counselors():
    """API lấy tất cả chuyên gia"""
    try:
        counselors = []
        for c in matching_system.counselors:
            counselors.append({
                "id": c.id,
                "name": c.name,
                "specialties": c.specialties,
                "rating": c.rating,
                "status": c.status,
                "experience": c.experience
            })
        
        return jsonify({"counselors": counselors}), 200
        
    except Exception as e:
        logging.error(f"Error getting counselors: {e}")
        return jsonify({"error": "Internal server error"}), 500 # Hết API matching 

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

# --- API MỚI CHO VIỆC XÁC THỰC CỐ VẤN ---

@app.route("/verify_counselor", methods=["GET"])
@login_required # Yêu cầu đăng nhập để thấy trang này
def verify_counselor_page():
    """Hiển thị trang HTML cho form upload"""
    return render_template("counselor_verification.html")

@app.route("/verify_counselor", methods=["POST"])
@login_required # Yêu cầu đăng nhập để nộp form
def handle_verification_upload(): # <-- Bỏ 'async'
    """
    Xử lý upload, KHÔNG DÙNG AI, chỉ lưu file.
    """
    
    # 1. Kiểm tra file
    if 'id_card' not in request.files or 'degree' not in request.files:
        return jsonify({"success": False, "message": "Lỗi: Thiếu tệp CCCD hoặc Bằng cấp."}), 400
    
    id_card_file = request.files['id_card']
    degree_file = request.files['degree']
    
    if id_card_file.filename == '' or degree_file.filename == '':
        return jsonify({"success": False, "message": "Lỗi: Vui lòng chọn cả hai tệp."}), 400
        
    if not (allowed_file(id_card_file.filename) and allowed_file(degree_file.filename)):
        return jsonify({"success": False, "message": f"Lỗi: Chỉ chấp nhận tệp {ALLOWED_EXTENSIONS}"}), 400

    try:
        # 2. Lấy tên file an toàn
        # Lấy đuôi file gốc
        ext1 = os.path.splitext(id_card_file.filename)[1]
        ext2 = os.path.splitext(degree_file.filename)[1]
        
        # Tạo tên file an toàn, gắn với username
        id_filename = secure_filename(f"{current_user.username}_id_card{ext1}")
        degree_filename = secure_filename(f"{current_user.username}_degree{ext2}")
        
        id_path = os.path.join(app.config['UPLOAD_FOLDER'], id_filename)
        degree_path = os.path.join(app.config['UPLOAD_FOLDER'], degree_filename)
        
        # 3. Lưu file
        id_card_file.save(id_path)
        degree_file.save(degree_path)
            
        logging.info(f"Đã lưu hồ sơ (CCCD, Bằng cấp) cho user: {current_user.username}")

        # TODO: Cập nhật trạng thái 'pending_review' cho user trong database
        # (Hiện tại, chúng ta chỉ lưu file để bạn duyệt thủ công)

        return jsonify({
            "success": True, 
            "message": "Hồ sơ đã được nộp thành công! Chúng tôi sẽ xem xét và liên hệ với bạn sớm."
        }), 200

    except Exception as e:
        logging.error(f"Lỗi nghiêm trọng khi xử lý upload: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": "Lỗi hệ thống, vui lòng thử lại sau."}), 500
        
@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "model": "gemini-2.5-flash"})

# --- CÁC ROUTE CHO ADMIN ---

@app.route("/admin/dashboard")
@login_required
def admin_dashboard():
    # Kiểm tra quyền Admin
    if not current_user.is_admin:
        return "Access Denied: Bạn không có quyền truy cập trang này.", 403
        
    # Quét thư mục upload để lấy danh sách hồ sơ
    profiles = []
    if os.path.exists(app.config['UPLOAD_FOLDER']):
        files = os.listdir(app.config['UPLOAD_FOLDER'])
        # Gom nhóm file theo username (dựa vào tên file: username_id_card.jpg)
        user_files = {}
        for f in files:
            if '_' in f:
                username = f.split('_')[0]
                if username not in user_files:
                    user_files[username] = {'id_card': None, 'degree': None}
                
                if 'id_card' in f:
                    user_files[username]['id_card'] = f
                elif 'degree' in f:
                    user_files[username]['degree'] = f
        
        # Chuyển thành list để render
        for username, doc in user_files.items():
            profiles.append({
                'username': username,
                'id_card': doc['id_card'],
                'degree': doc['degree']
            })

    return render_template("admin_dashboard.html", profiles=profiles)

# Route để xem ảnh (vì thư mục upload nằm ngoài static)
@app.route('/uploads/<filename>')
@login_required
def uploaded_file(filename):
    if not current_user.is_admin:
        return "Access Denied", 403
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# --- BOOKING SYSTEM ---

AVAILABILITY_FILE = "counselor_availability.txt"
AVAILABILITY_LOGS_FILE = "availability_logs.txt"
APPOINTMENTS_FILE = "appointments.txt"

@app.route("/api/counselor/availability", methods=["POST"])
@login_required
def update_availability():
    """Counselor cập nhật giờ rảnh"""
    if not current_user.is_counselor:
        return jsonify({"error": "Unauthorized"}), 403
        
    data = request.get_json()
    date = data.get("date")
    slots = data.get("slots") 
    
    # 1. LƯU VÀO FILE CHÍNH (Để hiển thị cho User đặt lịch)
    lines = []
    if os.path.exists(AVAILABILITY_FILE):
        with open(AVAILABILITY_FILE, "r", encoding='utf-8') as f:
            lines = f.readlines()
    
    new_lines = [line for line in lines if not (line.startswith(f"{current_user.username};{date}"))]
    new_lines.append(f"{current_user.username};{date};{','.join(slots)}\n")
    
    with open(AVAILABILITY_FILE, "w", encoding='utf-8') as f:
        f.writelines(new_lines)

    # 2. GHI LOG LỊCH SỬ (Để hiển thị trong tab Lịch sử)
    try:
        log_id = str(uuid.uuid4())[:8]
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        slots_str = ','.join(slots)
        
        if not os.path.exists(AVAILABILITY_LOGS_FILE):
             with open(AVAILABILITY_LOGS_FILE, "w", encoding='utf-8') as f:
                 f.write("LogID;Username;ActionTime;TargetDate;Slots\n")

        with open(AVAILABILITY_LOGS_FILE, "a", encoding='utf-8') as f:
            f.write(f"{log_id};{current_user.username};{now_str};{date};{slots_str}\n")
            
    except Exception as e:
        logging.error(f"Lỗi ghi log: {e}")
        
    return jsonify({"message": "Cập nhật lịch thành công"}), 200

@app.route("/api/counselor/history-logs", methods=["GET"])
@login_required
def get_availability_logs():
    if not current_user.is_counselor:
        return jsonify({"error": "Unauthorized"}), 403

    logs = []
    
    # Kiểm tra file tồn tại chưa
    if not os.path.exists(AVAILABILITY_LOGS_FILE):
        return jsonify({"logs": []}), 200 # Trả về mảng rỗng ngay nếu chưa có file

    try:
        with open(AVAILABILITY_LOGS_FILE, "r", encoding='utf-8') as f:
            lines = f.readlines()
            
            # Bỏ qua dòng header (dòng đầu tiên)
            if len(lines) > 0 and "LogID" in lines[0]:
                lines = lines[1:]
                
            for line in lines:
                line = line.strip()
                if not line: continue # Bỏ qua dòng trống
                
                parts = line.split(';')
                
                # Cấu trúc chuẩn: LogID;Username;ActionTime;TargetDate;Slots
                # Cần ít nhất 5 phần tử
                if len(parts) >= 5 and parts[1] == current_user.username:
                    logs.append({
                        "log_id": parts[0],
                        "action_time": parts[2],
                        "target_date": parts[3],
                        "slots": parts[4].split(',') if parts[4] else []
                    })
                    
        # Sắp xếp: Mới nhất lên đầu
        logs.sort(key=lambda x: x['action_time'], reverse=True)
        
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
        with open(APPOINTMENTS_FILE, "r", encoding='utf-8') as f:
            for line in f:
                parts = line.strip().split(';')
                # Cấu trúc: ApptID;UserID;CounselorUsername;Date;Time;Status
                # Kiểm tra đủ độ dài và đúng user
                if len(parts) >= 6 and parts[1] == current_user.username and parts[5] == 'confirmed':
                    existing_appt = {
                        "id": parts[0],
                        "counselor": parts[2],
                        "date": parts[3],
                        "time": parts[4]
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
    """Hủy lịch hẹn"""
    appt_id = request.get_json().get("id")
    lines = []
    found = False
    
    if os.path.exists(APPOINTMENTS_FILE):
        with open(APPOINTMENTS_FILE, "r", encoding='utf-8') as f:
            lines = f.readlines()
            
    new_lines = []
    for line in lines:
        parts = line.strip().split(';')
        if len(parts) >= 6 and parts[0] == appt_id and parts[1] == current_user.username:
            # Đổi trạng thái thành cancelled
            parts[5] = 'cancelled'
            new_lines.append(';'.join(parts) + '\n')
            found = True
        else:
            new_lines.append(line)
            
    if found:
        with open(APPOINTMENTS_FILE, "w", encoding='utf-8') as f:
            f.writelines(new_lines)
        return jsonify({"message": "Đã hủy lịch hẹn."}), 200
    else:
        return jsonify({"error": "Không tìm thấy lịch hẹn."}), 404

@app.route("/api/user/appointments", methods=["GET"])
@login_required
def get_user_appointments():
    """Lấy lịch sử hẹn của User (cả confirmed và cancelled)"""
    history = []
    
    if os.path.exists(APPOINTMENTS_FILE):
        with open(APPOINTMENTS_FILE, "r", encoding='utf-8') as f:
            for line in f:
                parts = line.strip().split(';')
                if len(parts) >= 6 and parts[1] == current_user.username:
                    history.append({
                        "id": parts[0],
                        "counselor": parts[2], # Username của counselor
                        "date": parts[3],
                        "time": parts[4],
                        "status": parts[5]
                    })
    
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
        with open(AVAILABILITY_FILE, "r", encoding='utf-8') as f:
            for line in f:
                parts = line.strip().split(';')
                # Check ngày >= hôm nay
                if len(parts) >= 3 and parts[1] >= today:
                    active_counselors.add(parts[0]) # Username
                    
    # 2. Lấy thông tin chi tiết của họ
    results = []
    if os.path.exists(COUNSELOR_FILE):
        with open(COUNSELOR_FILE, "r", encoding='utf-8') as f:
            lines = f.readlines()[1:]
            for line in lines:
                parts = line.strip().split(';')
                # Username ở cột 1
                if len(parts) >= 10 and parts[1] in active_counselors and parts[9].strip().lower() == 'yes':
                    results.append({
                        "username": parts[1], # Quan trọng: Dùng username làm ID
                        "name": parts[2],
                        "specialties": parts[5],
                        "rating": parts[6],
                        "status": parts[7]
                    })
                    
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
        with open(AVAILABILITY_FILE, "r", encoding='utf-8') as f:
            for line in f:
                parts = line.strip().split(';')
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
    booked_slots = []
    
    try:
        # 1. Lấy slot gốc từ file availability (Của Counselor)
        if os.path.exists(AVAILABILITY_FILE):
            with open(AVAILABILITY_FILE, "r", encoding='utf-8') as f:
                for line in f:
                    parts = line.strip().split(';')
                    if len(parts) >= 3 and parts[0] == counselor_username and parts[1] == date:
                        # Lấy dòng cuối cùng (cập nhật mới nhất)
                        all_slots = parts[2].split(',')

        # 2. Lấy slot đã bị đặt (từ file appointments)
        if os.path.exists(APPOINTMENTS_FILE):
            with open(APPOINTMENTS_FILE, "r", encoding='utf-8') as f:
                for line in f:
                    parts = line.strip().split(';')
                    # Cấu trúc: ApptID;UserID;CounselorID;Date;Time;Status
                    if len(parts) >= 6:
                        # Chỉ chặn nếu đúng Counselor, đúng ngày và trạng thái 'confirmed'
                        if (parts[2] == counselor_username and 
                            parts[3] == date and 
                            parts[5].strip() == 'confirmed'):
                            booked_slots.append(parts[4])
        
        # 3. Trừ đi slot đã đặt
        final_slots = [s for s in all_slots if s not in booked_slots]
        final_slots.sort()
        
        return jsonify({"slots": final_slots}), 200

    except Exception as e:
        logging.error(f"Lỗi lấy slot: {e}")
        return jsonify({"slots": []}), 500

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
            with open(APPOINTMENTS_FILE, "w", encoding='utf-8') as f:
                f.write("ApptID;UserID;CounselorID;Date;Time;Status\n")

        appt_id = str(uuid.uuid4())[:8]
        
        # QUAN TRỌNG: Mở file với encoding='utf-8' và mode 'a' (append)
        with open(APPOINTMENTS_FILE, "a", encoding='utf-8') as f:
            # Đảm bảo xuống dòng (\n) ở cuối
            line = f"{appt_id};{current_user.username};{counselor_username};{date};{time};confirmed\n"
            f.write(line)
            
        return jsonify({"message": "OK", "id": appt_id}), 200
    except Exception as e:
        logging.error(f"Lỗi ghi file: {e}")
        return jsonify({"message": "Lỗi server"}), 500

        
# --- TRONG FILE app.py ---

# API Route (Giữ nguyên)
@app.route('/api/chat/check-expert-status')
def check_expert_status():
    username = request.args.get('username')
    # TODO: Cần có logic để lấy tên thật (Full Name) từ username
    # user = User.query.filter_by(username=username).first()
    # expert_name = user.full_name if user else username
    expert_name = f"TS. {username}" # Tạm thời
    
    # TODO: Logic kiểm tra online (ví dụ: CSDL hoặc 1 danh sách)
    is_online = True 
    if is_online:
        return jsonify({"status": "online", "expert_name": expert_name}) 
    else:
        return jsonify({"status": "offline"})

# --- CÁC HÀM XỬ LÝ SOCKET ĐÃ KHÔI PHỤC LOGIC ROLE ---

@socketio.on('connect')
def handle_connect():
    # Kiểm tra đăng nhập VÀ CÓ ROLE (rất quan trọng)
    if 'user_id' not in session or 'role' not in session:
        print(f"--- KẾT NỐI BỊ TỪ CHỐI: Client chưa đăng nhập hoặc thiếu role.")
        return False 
        
    session['sid'] = request.sid # Lưu lại SID để debug
    print(f"--- KẾT NỐI THÀNH CÔNG: Client {session.get('username')} (Role: {session.get('role')}) | SID: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    username = session.get('username', 'Unknown')
    print(f"--- NGẮT KẾT NỐI: Client {username} (Role: {session.get('role')})")
    # TODO: Thêm logic báo cho người trong phòng biết


# Khi CHUYÊN GIA tải trang dashboard
@socketio.on('counselor_join_room')
def handle_counselor_join(data):
    # Xác thực: Phải là counselor
    if 'role' not in session or session['role'] != 'counselor':
        print(f"--- LỖI: {session.get('username')} (không phải counselor) cố vào phòng host.")
        return False
    
    username = session['username']
    room = data['room']
    
    if username != room:
        print(f"--- LỖI: Counselor {username} cố vào phòng {room}.")
        return False
        
    join_room(room)
    print(f"*** HOST (Counselor) {username} ĐÃ VÀO PHÒNG: {room} ***")
    
    emit('receive_message', 
         {'text': 'Bạn đã kết nối với phòng chat của mình.', 'sender_type': 'system'}, 
         to=request.sid)

# Khi NGƯỜI DÙNG tham gia phòng chat
@socketio.on('join_expert_chat')
def handle_join_room(data):
    # Xác thực: Phải là user
    if 'role' not in session or session['role'] != 'user':
        print(f"--- LỖI: {session.get('username')} (không phải user) cố vào phòng chat.")
        return False

    room = data['room'] # Tên phòng (username của chuyên gia)
    user_username = session.get('username', 'Một người dùng')
    
    join_room(room)
    print(f"*** GUEST (User) {user_username} ĐÃ VÀO PHÒNG: {room} ***")
    
    # 1. Báo cho USER (chỉ họ) là đã vào phòng
    emit('receive_message', 
         {'text': 'Đã kết nối, vui lòng chờ chuyên gia chấp nhận.', 'sender_type': 'system'}, 
         to=request.sid)
    
    # 2. Báo cho CHUYÊN GIA (chủ phòng) biết có người vào
    print(f"--- GỬI THÔNG BÁO 'show_chat_notification' TỚI PHÒNG: {room} ---")
    
    emit('show_chat_notification', 
         {'user_id': session['user_id'], 'username': user_username}, 
         to=room, 
         skip_sid=request.sid) # Vẫn skip_sid cho thông báo này

# Khi BẤT KỲ AI gửi tin nhắn
@socketio.on('send_expert_message')
def handle_send_message(data):
    if 'user_id' not in session: return False
        
    room = data['room']
    message = data['message']
    
    # Lấy vai trò từ session (mặc định là 'user' nếu không có)
    sender_type = session.get('role', 'user')
    
    print(f"--- TIN NHẮN PHÒNG {room} (từ {sender_type}): {message} ---")
    
    # GỬI CHO TẤT CẢ MỌI NGƯỜI (KỂ CẢ NGƯỜI GỬI)
    emit('receive_message', 
         {'text': message, 'sender_id': session['user_id'], 'sender_type': sender_type}, 
         to=room) # <-- KHÔNG DÙNG skip_sid

# Khi CHUYÊN GIA từ chối chat
@socketio.on('reject_chat')
def handle_reject_chat(data):
    if 'role' not in session or session['role'] != 'counselor': return False

    room = data['room']
    print(f"--- HOST ĐÃ TỪ CHỐI PHÒNG: {room} ---")
    
    emit('receive_message', 
         {'text': 'Chuyên gia hiện đang bận và không thể kết nối. Vui lòng đặt lịch hẹn.', 'sender_type': 'system'}, 
         to=room)

# Khi NGƯỜI DÙNG đóng cửa sổ chat
@socketio.on('leave_room')
def handle_leave_room(data):
    if 'user_id' not in session: return False

    room = data['room']
    username = session.get('username', 'User')
    
    leave_room(room)
    print(f"User {username} đã rời phòng: {room}")
    
    emit('receive_message', 
         {'text': f'Người dùng {username} đã rời đi.', 'sender_type': 'system'}, 
         to=room,
         skip_sid=request.sid)

# --- CÁCH CHẠY SERVER ---
if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)
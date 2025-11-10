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
import json
import datetime #xử lý quicktest dể làm problem tags
from datetime import datetime
from matching import MatchingSystem, TagExtractor #thêm dòng này cho cái tính năng matching
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

# --- Khởi tạo Matching System ---
matching_system = MatchingSystem()
logging.info("Khởi tạo Matching System thành công.")

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
        response = gemini_model.generate_content(
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

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "model": "gemini-2.5-flash"})

if __name__ == "__main__":
    app.run(debug=True, port=5000)

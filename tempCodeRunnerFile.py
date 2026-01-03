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
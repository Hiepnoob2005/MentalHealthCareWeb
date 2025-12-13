# matching.py
import json
import os
from typing import List, Dict, Optional
from dataclasses import dataclass
import logging

@dataclass
class Counselor:
    """Class để lưu thông tin chuyên gia"""
    id: str
    name: str
    email: str
    specialties: List[str]
    rating: float
    status: str
    experience: str
    match_score: float = 0.0

class MatchingSystem:
    """Hệ thống matching thông minh giữa sinh viên và chuyên gia"""
    
    def __init__(self, counselor_file: str = "counselor_accounts.txt"):
        self.counselor_file = counselor_file
        self.counselors = self.load_counselors()
        
        # Định nghĩa các tags và synonyms
        self.tag_synonyms = {
            'stress': ['stress', 'căng thẳng', 'áp lực'],
            'lo_au': ['lo lắng', 'bất an', 'lo âu'], 
            'tram_cam': ['buồn chán', 'tuyệt vọng', 'trầm cảm'], 
            'hoc_tap': ['thi cử', 'điểm số', 'học tập'], 
            'giac_ngu': ['giấc ngủ', 'mất ngủ', 'rối loạn giấc ngủ'],
            'tam_ly_xa_hoi': ['tâm lý xã hội', 'quan hệ', 'giao tiếp'],
            'tinh_cam': ['tình cảm', 'tình yêu', 'chia tay'],
            'gia_dinh': ['gia đình', 'cha mẹ', 'anh chị em'],
            'tu_hai': ['tự hại', 'tự tử', 'tự giết']
        }
    
    def load_counselors(self) -> List[Counselor]:
            """Load danh sách chuyên gia từ file"""
            counselors = []
            
            if not os.path.exists(self.counselor_file):
                logging.warning(f"File {self.counselor_file} không tồn tại")
                return counselors
                
            try:
                with open(self.counselor_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()[1:]  # Bỏ qua header
                    
                    for line in lines:
                        parts = line.strip().split(';')
                        # Cấu trúc MỚI: ID(0);Username(1);Name(2);Email(3);Pass(4);Specialties(5);Rating(6);Status(7);Exp(8);Verified(9)
                        if len(parts) >= 10: 
                            # Chỉ load những người đã Verified = yes để hiển thị cho user
                            if parts[9].strip().lower() != 'yes':
                                continue

                            counselor = Counselor(
                                id=parts[0],
                                name=parts[2], # Index lệch +1 so với cũ
                                email=parts[3],
                                specialties=parts[5].split(','),
                                rating=float(parts[6]),
                                status=parts[7],
                                experience=parts[8]
                            )
                            counselors.append(counselor)
                            
            except Exception as e:
                logging.error(f"Lỗi khi load counselors: {e}")
                
            return counselors                        

    
    def normalize_tags(self, tags: List[str]) -> List[str]:
        """Chuẩn hóa tags dựa trên synonyms"""
        normalized = []
        
        for tag in tags:
            tag_lower = tag.lower().strip()
            # Tìm tag chính từ synonyms
            for main_tag, synonyms in self.tag_synonyms.items():
                if tag_lower in synonyms:
                    normalized.append(main_tag)
                    break
            else:
                # Nếu không tìm thấy synonym, giữ nguyên tag
                normalized.append(tag_lower)
                
        return list(set(normalized))  # Loại bỏ duplicates
    
    def calculate_match_score(self, student_tags: List[str], counselor_specialties: List[str]) -> float:
        """
        Tính điểm matching giữa tags của sinh viên và specialties của chuyên gia
        Score = (số tags trùng khớp / tổng số tags) * 100
        """
        if not student_tags:
            return 0.0
            
        student_tags_norm = self.normalize_tags(student_tags)
        counselor_specs_norm = self.normalize_tags(counselor_specialties)
        
        matches = len(set(student_tags_norm) & set(counselor_specs_norm))
        total = len(student_tags_norm)
        
        return (matches / total) * 100
    
    def find_matches(self, 
                    problem_tags: List[str], 
                    only_online: bool = True,
                    min_rating: float = 0.0,
                    top_k: int = 5) -> List[Counselor]:
        """
        Tìm các chuyên gia phù hợp
        
        Args:
            problem_tags: Danh sách problem tags của sinh viên
            only_online: Chỉ tìm chuyên gia đang online
            min_rating: Rating tối thiểu
            top_k: Số lượng kết quả trả về
            
        Returns:
            Danh sách chuyên gia được sắp xếp theo match_score
        """
        
        matching_counselors = []
        
        for counselor in self.counselors:
            # Lọc theo status
            if only_online and counselor.status != 'online':
                continue
                
            # Lọc theo rating
            if counselor.rating < min_rating:
                continue
                
            # Tính match score
            score = self.calculate_match_score(problem_tags, counselor.specialties)
            
            # Chỉ lấy counselor có score > 0
            if score > 0:
                counselor.match_score = score
                matching_counselors.append(counselor)
        
        # Sắp xếp theo match_score (cao nhất trước), sau đó theo rating
        matching_counselors.sort(key=lambda x: (x.match_score, x.rating), reverse=True)
        
        return matching_counselors[:top_k]
    
    def get_counselor_by_id(self, counselor_id: str) -> Optional[Counselor]:
        """Lấy thông tin chuyên gia theo ID"""
        for counselor in self.counselors:
            if counselor.id == counselor_id:
                return counselor
        return None

# Tag extraction từ Quick Test results
class TagExtractor:
    """Trích xuất Problem Tags từ kết quả Quick Test hoặc chat history"""
    
@staticmethod
def extract_from_test_results(answers: Dict[str, str]) -> List[str]:
    """
    Trích xuất tags từ câu trả lời của Quick Test
    (ĐÃ ĐỒNG BỘ VỚI QuickTestProcessor của main.py)
    """
    problem_tags = []

    # Mapping điểm
    q1_mapping = {"Không bao giờ": 0, "Đôi khi": 1, "Thường xuyên": 2, "Luôn luôn": 3}
    q2_mapping = {"Không gặp khó khăn": 0, "Ít khi": 1, "Thỉnh thoảng": 2, "Rất thường xuyên": 3}
    q3_mapping = {"Rất tốt": 0, "Bình thường": 1, "Không tốt": 2, "Rất tệ, thường mất ngủ": 3}

    # Tính điểm
    q1_score = q1_mapping.get(answers.get('q1', ''), 0)
    q2_score = q2_mapping.get(answers.get('q2', ''), 0)
    q3_score = q3_mapping.get(answers.get('q3', ''), 0)
    total_score = q1_score + q2_score + q3_score

    # Gán problem tags
    if q1_score >= 2:
        problem_tags.extend(['stress', 'lo_au'])
    if q2_score >= 2:
        problem_tags.append('hoc_tap')
    if q3_score >= 2:
        problem_tags.append('roi_loan_giac_ngu')
    if total_score >= 7:
        problem_tags.append('tram_cam')

    return list(set(problem_tags)) # Loại bỏ duplicates
    
    @staticmethod
    def extract_from_chat_history(conversation_id: str) -> List[str]:
        """
        Trích xuất tags từ lịch sử chat (đã được AI tóm tắt)
        
        Args:
            conversation_id: ID của cuộc trò chuyện
            
        Returns:
            List các problem tags
        """
        tags = []
        chat_file = f"chat_history/{conversation_id}.json"
        
        if not os.path.exists(chat_file):
            return tags
            
        try:
            with open(chat_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
                # Phân tích symptoms đã được AI tóm tắt
                symptoms = data.get('symptoms', '').lower()
                
                # Map symptoms sang tags
                if 'stress' in symptoms or 'căng thẳng' in symptoms:
                    tags.append('stress')
                if 'lo âu' in symptoms or 'lo lắng' in symptoms:
                    tags.append('lo_au')
                if 'trầm cảm' in symptoms or 'buồn' in symptoms:
                    tags.append('tram_cam')
                if 'mất ngủ' in symptoms or 'khó ngủ' in symptoms:
                    tags.append('roi_loan_giac_ngu')
                if 'học tập' in symptoms or 'thi cử' in symptoms:
                    tags.append('hoc_tap')
                    
        except Exception as e:
            logging.error(f"Lỗi khi đọc chat history: {e}")
            
        return tags
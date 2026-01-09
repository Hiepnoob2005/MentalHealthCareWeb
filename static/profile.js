document.addEventListener('DOMContentLoaded', function() {
    loadProfile();
    loadStudentTestResults();
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', updateProfile);
    }
});

async function loadProfile() {
    try {
        const response = await fetch('/api/profile');
        if (!response.ok) throw new Error('Không thể tải thông tin');

        const data = await response.json();

        // 1. Điền thông tin chung (Form)
        document.getElementById('username').value = data.username;
        document.getElementById('email').value = data.email;
        document.getElementById('phone').value = data.phone;

        // 2. Logic phân quyền hiển thị
        if (data.is_counselor) {
            // --- Hiển thị giao diện CHUYÊN GIA ---
            document.getElementById('counselorSection').classList.remove('hidden');
            document.getElementById('studentSection').classList.add('hidden');
            
            // Điền thông tin chuyên gia
            if (data.counselor_info) {
                document.getElementById('c_name').textContent = data.counselor_info.name;
                document.getElementById('c_experience').textContent = data.counselor_info.experience;
                document.getElementById('c_rating').textContent = data.counselor_info.rating;
                
                // Render tags chuyên môn
                const specsContainer = document.getElementById('c_specialties');
                specsContainer.innerHTML = '';
                const rawSpecs = data.counselor_info.specialties || "";
                
                // Dictionary map tên tag đẹp hơn
                const dict = {
                    'stress': 'Stress & Căng thẳng', 'lo_au': 'Rối loạn lo âu', 
                    'tram_cam': 'Trầm cảm', 'hoc_tap': 'Áp lực học tập', 
                    'roi_loan_giac_ngu': 'Giấc ngủ', 'tam_ly_xa_hoi': 'Tâm lý xã hội',
                    'tu_van_chung': 'Tư vấn chung'
                };

                rawSpecs.split(',').forEach(tag => {
                    const cleanTag = tag.trim();
                    if(cleanTag) {
                        const span = document.createElement('span');
                        span.className = 'spec-badge';
                        span.textContent = dict[cleanTag] || cleanTag;
                        specsContainer.appendChild(span);
                    }
                });
            }

        } else {
            // --- Hiển thị giao diện SINH VIÊN ---
            document.getElementById('studentSection').classList.remove('hidden');
            document.getElementById('counselorSection').classList.add('hidden');

            // Điền tags bài test (như cũ)
            const tagsContainer = document.getElementById('latestTagsContainer');
            tagsContainer.innerHTML = ''; // Xóa spinner

            if (data.latest_tags && data.latest_tags.length > 0 && data.latest_tags[0] !== 'none') {
                const tagNames = {
                    'stress': 'Căng thẳng (Stress)',
                    'lo_au': 'Lo âu',
                    'tram_cam': 'Trầm cảm',
                    'hoc_tap': 'Áp lực học tập',
                    'roi_loan_giac_ngu': 'Rối loạn giấc ngủ',
                    'tam_ly_xa_hoi': 'Tâm lý xã hội'
                };

                data.latest_tags.forEach(tag => {
                    const div = document.createElement('div');
                    div.className = 'tag-item';
                    // Style cho tag sinh viên (dùng class có sẵn hoặc inline tạm)
                    div.style.cssText = "background:#fee2e2; color:#b91c1c; padding:8px 12px; border-radius:8px; display:inline-block; margin:5px; font-weight:500;";
                    div.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${tagNames[tag] || tag}`;
                    tagsContainer.appendChild(div);
                });
            } else {
                tagsContainer.innerHTML = '<p style="color:#666; font-style:italic;">Bạn chưa thực hiện bài kiểm tra nào gần đây.</p>';
            }
        }

    } catch (error) {
        console.error('Error:', error);
        alert("Có lỗi khi tải hồ sơ.");
    }
}

async function updateProfile(e) {
    e.preventDefault();
    const btn = document.querySelector('.btn-submit');
    const msg = document.getElementById('formMessage');
    
    // UI Loading
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';
    btn.disabled = true;
    msg.textContent = '';
    msg.className = 'form-message';

    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;

    try {
        const response = await fetch('/api/profile/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, phone })
        });

        const data = await response.json();

        if (response.ok) {
            msg.textContent = 'Cập nhật thành công!';
            msg.classList.add('success');
            msg.style.color = 'green';
        } else {
            throw new Error(data.message || 'Lỗi cập nhật');
        }
    } catch (error) {
        msg.textContent = error.message;
        msg.classList.add('error');
        msg.style.color = 'red';
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function loadStudentTestResults() {
    const section = document.getElementById('studentSection');
    const container = document.getElementById('latestTagsContainer');

    // Reset giao diện đang tải
    if (container) container.innerHTML = '<div class="spinner"></div><p style="text-align:center">Đang tải kết quả...</p>';

    try {
        const response = await fetch('/api/user/latest-test-result');
        const data = await response.json();

        // Tìm thấy phần hiển thị
        if (section) section.classList.remove('hidden');
        if (container) container.innerHTML = '';

        if (data.found) {
            // Hiển thị ngày test (Option: Thêm vào tiêu đề hoặc dưới danh sách)
            const dateInfo = document.createElement('p');
            dateInfo.style.fontSize = '0.9rem';
            dateInfo.style.color = '#666';
            dateInfo.style.marginBottom = '10px';
            dateInfo.innerHTML = `<i class="far fa-clock"></i> Kết quả ngày: <b>${data.date}</b>`;
            container.appendChild(dateInfo);

            if (data.tags && data.tags.length > 0) {
                // Có vấn đề (Tags) -> Hiển thị Badge đỏ
                data.tags.forEach(tag => {
                    if(!tag) return; // Bỏ qua tag rỗng
                    
                    const span = document.createElement('span');
                    span.className = 'spec-badge'; 
                    // Style cảnh báo
                    span.style.background = '#fee2e2'; 
                    span.style.color = '#b91c1c';
                    span.style.border = '1px solid #fecaca';
                    span.style.padding = '6px 12px';
                    span.style.margin = '0 5px 5px 0';
                    span.style.display = 'inline-block';
                    
                    span.textContent = formatProblemTag(tag);
                    container.appendChild(span);
                });
                
                // Gợi ý nhỏ
                const hint = document.createElement('div');
                hint.style.marginTop = '15px';
                hint.innerHTML = `<a href="/#experts" style="color: var(--primary); text-decoration: underline;">Tìm chuyên gia hỗ trợ ngay</a>`;
                container.appendChild(hint);

            } else {
                // Không có tags -> Kết quả bình thường
                container.innerHTML += `
                    <div style="color: #047857; background: #d1fae5; padding: 15px; border-radius: 8px; border: 1px solid #a7f3d0;">
                        <i class="fas fa-check-circle"></i> <strong>Tuyệt vời!</strong> Các chỉ số tâm lý của bạn đang ở mức bình thường.
                    </div>
                `;
            }
        } else {
            // Chưa làm bài test
            container.innerHTML = `
                <div style="text-align: center; color: #666; padding: 20px;">
                    <p>Bạn chưa thực hiện bài đánh giá nào.</p>
                    <a href="/#test" class="btn-primary" style="display: inline-block; margin-top: 10px; padding: 8px 20px; font-size: 0.9rem;">Làm bài test ngay</a>
                </div>
            `;
        }

    } catch (error) {
        console.error("Lỗi tải kết quả test:", error);
        if (container) container.innerHTML = '<p style="color:red; text-align:center;">Không thể tải dữ liệu.</p>';
    }
}

// Hàm format tên Tag cho đẹp (Tiếng Việt)
function formatProblemTag(tag) {
    const tagMap = {
        'stress': 'Stress (Căng thẳng)',
        'lo_au': 'Lo âu',
        'tram_cam': 'Trầm cảm',
        'hoc_tap': 'Áp lực học tập',
        'roi_loan_giac_ngu': 'Rối loạn giấc ngủ',
        'tam_ly_xa_hoi': 'Tâm lý xã hội',
        'ap_luc_cong_viec': 'Áp lực công việc',
        'quan_he_gia_dinh': 'Quan hệ gia đình',
        'quan_he_tinh_cam': 'Quan hệ tình cảm',
        'ap_luc_xa_hoi': 'Áp lực xã hội',
        'ap_luc_thi_cu': 'Áp lực thi cử'
    };
    return tagMap[tag] || tag; // Fallback về tag gốc nếu không tìm thấy
}
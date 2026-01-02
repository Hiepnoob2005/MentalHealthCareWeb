document.addEventListener('DOMContentLoaded', function() {
    loadProfile();

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